"use server";

import {
  createIntent,
  getIntent,
  updateIntent,
  getAllIntents,
  getIntentsByStatus,
  getAuditLog,
  getPolicy,
  updatePolicy,
  addAuditEntry,
  getStats,
  type PaymentIntent,
  type AuditLogEntry,
  type PolicyConfig,
} from "@/lib/store";
import { evaluatePolicy, type PolicyResult } from "@/lib/policy";
import {
  submitAuditEvent,
  createScheduledTransfer,
  executeTransfer,
  signScheduledTransaction,
  isHederaConfigured,
  getOrCreateTopic,
  getOperatorId,
} from "@/lib/hedera";

// ── Submit a new payment intent ─────────────────────────────────────
export async function submitIntent(formData: {
  actorName: string;
  actorId: string;
  recipientId: string;
  amount: number;
  currency: string;
  purpose: string;
}): Promise<{ intent: PaymentIntent; policy: PolicyResult }> {
  // 1. Create the intent record
  const intent = createIntent({
    actorId: formData.actorId,
    actorName: formData.actorName,
    recipientId: formData.recipientId,
    amount: formData.amount,
    currency: formData.currency || "HBAR",
    purpose: formData.purpose,
  });

  // 2. Log INTENT_CREATED to HCS
  let hcsResult = { topicId: "", sequenceNumber: "0", transactionId: "" };
  if (isHederaConfigured()) {
    try {
      hcsResult = await submitAuditEvent({
        type: "INTENT_CREATED",
        intentId: intent.id,
        actor: intent.actorName,
        timestamp: intent.createdAt,
        details: {
          recipient: intent.recipientId,
          amount: intent.amount,
          purpose: intent.purpose,
        },
      });
    } catch (err) {
      console.error("[Hedera] Failed to log INTENT_CREATED:", err);
    }
  }

  const topicId = hcsResult.topicId || process.env.HCS_TOPIC_ID || "—";

  addAuditEntry({
    type: "INTENT_CREATED",
    intentId: intent.id,
    actor: intent.actorName,
    txHash: hcsResult.transactionId || "—",
    hcsTopic: topicId,
    hcsSequence: hcsResult.sequenceNumber,
    time: "Just now",
    badge: "Proposed",
  });

  // 3. Evaluate policy
  const policyResult = evaluatePolicy(intent.amount, intent.recipientId);

  // 4. Apply policy decision
  updateIntent(intent.id, {
    status: policyResult.decision,
    policyReason: policyResult.reason,
    policyRule: policyResult.rule,
    hcsTopicId: topicId,
    hcsSequence: hcsResult.sequenceNumber,
  });

  // 5. Log policy decision to HCS
  const policyEventType =
    policyResult.decision === "approved"
      ? "POLICY_APPROVED"
      : policyResult.decision === "escalated"
        ? "POLICY_ESCALATED"
        : "POLICY_BLOCKED";

  let policyHcsResult = { topicId: "", sequenceNumber: "0", transactionId: "" };
  if (isHederaConfigured()) {
    try {
      policyHcsResult = await submitAuditEvent({
        type: policyEventType as any,
        intentId: intent.id,
        actor: "PolicyEngine",
        timestamp: new Date().toISOString(),
        details: {
          decision: policyResult.decision,
          rule: policyResult.rule,
          reason: policyResult.reason,
        },
      });
    } catch (err) {
      console.error(`[Hedera] Failed to log ${policyEventType}:`, err);
    }
  }

  addAuditEntry({
    type: policyEventType,
    intentId: intent.id,
    actor: "PolicyEngine",
    txHash: policyHcsResult.transactionId || "—",
    hcsTopic: policyHcsResult.topicId || topicId,
    hcsSequence: policyHcsResult.sequenceNumber,
    time: "Just now",
    badge:
      policyResult.decision === "approved"
        ? "Approved"
        : policyResult.decision === "escalated"
          ? "Escalated"
          : "Blocked",
  });

  // 6. If approved, execute immediately via scheduled transaction
  if (policyResult.decision === "approved" && isHederaConfigured()) {
    try {
      const scheduleResult = await createScheduledTransfer(
        intent.recipientId,
        intent.amount,
        `${intent.id}: ${intent.purpose}`
      );

      updateIntent(intent.id, {
        status: "executed",
        scheduleId: scheduleResult.scheduleId,
        txId: scheduleResult.transactionId,
      });

      const execHcsResult = await submitAuditEvent({
        type: "EXECUTION_SUCCESS",
        intentId: intent.id,
        actor: "System",
        timestamp: new Date().toISOString(),
        details: {
          scheduleId: scheduleResult.scheduleId,
          transactionId: scheduleResult.transactionId,
        },
      });

      addAuditEntry({
        type: "EXECUTION_SUCCESS",
        intentId: intent.id,
        actor: "System",
        txHash: scheduleResult.transactionId,
        hcsTopic: execHcsResult.topicId || topicId,
        hcsSequence: execHcsResult.sequenceNumber,
        time: "Just now",
        badge: "Settled",
      });
    } catch (err) {
      console.error("[Hedera] Scheduled transfer failed:", err);
      // Still mark as approved even if Hedera execution fails
      // The policy decision was approved, execution is a separate concern
      addAuditEntry({
        type: "EXECUTION_FAILED",
        intentId: intent.id,
        actor: "System",
        txHash: "—",
        hcsTopic: topicId,
        hcsSequence: "0",
        time: "Just now",
        badge: "Failed",
      });
    }
  }

  return { intent: getIntent(intent.id)!, policy: policyResult };
}

// ── Approve an escalated intent ───────────────────────────────────────
export async function approveIntent(
  intentId: string,
  reviewerName: string = "Treasury Operator"
): Promise<PaymentIntent | null> {
  const intent = getIntent(intentId);
  if (!intent || intent.status !== "escalated") return null;

  const topicId = intent.hcsTopicId || process.env.HCS_TOPIC_ID || "—";

  // Log approval to HCS
  let hcsResult = { topicId: "", sequenceNumber: "0", transactionId: "" };
  if (isHederaConfigured()) {
    try {
      hcsResult = await submitAuditEvent({
        type: "APPROVAL_GRANTED",
        intentId,
        actor: reviewerName,
        timestamp: new Date().toISOString(),
        details: { action: "approve", reviewer: reviewerName },
      });
    } catch (err) {
      console.error("[Hedera] Failed to log APPROVAL_GRANTED:", err);
    }
  }

  addAuditEntry({
    type: "APPROVAL_GRANTED",
    intentId,
    actor: reviewerName,
    txHash: hcsResult.transactionId || "—",
    hcsTopic: hcsResult.topicId || topicId,
    hcsSequence: hcsResult.sequenceNumber,
    time: "Just now",
    badge: "Approved",
  });

  // Execute the transfer via scheduled transaction
  if (isHederaConfigured()) {
    try {
      const scheduleResult = await createScheduledTransfer(
        intent.recipientId,
        intent.amount,
        `${intent.id}: ${intent.purpose} [Escalation approved by ${reviewerName}]`
      );

      updateIntent(intentId, {
        status: "executed",
        scheduleId: scheduleResult.scheduleId,
        txId: scheduleResult.transactionId,
        reviewedBy: reviewerName,
        reviewedAt: new Date().toISOString(),
      });

      const execHcsResult = await submitAuditEvent({
        type: "EXECUTION_SUCCESS",
        intentId,
        actor: "System",
        timestamp: new Date().toISOString(),
        details: {
          scheduleId: scheduleResult.scheduleId,
          transactionId: scheduleResult.transactionId,
          approvedBy: reviewerName,
        },
      });

      addAuditEntry({
        type: "EXECUTION_SUCCESS",
        intentId,
        actor: "System",
        txHash: scheduleResult.transactionId,
        hcsTopic: execHcsResult.topicId || topicId,
        hcsSequence: execHcsResult.sequenceNumber,
        time: "Just now",
        badge: "Settled",
      });
    } catch (err) {
      console.error("[Hedera] Post-approval execution failed:", err);
      updateIntent(intentId, {
        status: "approved",
        reviewedBy: reviewerName,
        reviewedAt: new Date().toISOString(),
      });
    }
  } else {
    updateIntent(intentId, {
      status: "executed",
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
    });
  }

  return getIntent(intentId)!;
}

// ── Reject an escalated intent ────────────────────────────────────────
export async function rejectIntent(
  intentId: string,
  reviewerName: string = "Treasury Operator"
): Promise<PaymentIntent | null> {
  const intent = getIntent(intentId);
  if (!intent || intent.status !== "escalated") return null;

  const topicId = intent.hcsTopicId || process.env.HCS_TOPIC_ID || "—";

  let hcsResult = { topicId: "", sequenceNumber: "0", transactionId: "" };
  if (isHederaConfigured()) {
    try {
      hcsResult = await submitAuditEvent({
        type: "APPROVAL_REJECTED",
        intentId,
        actor: reviewerName,
        timestamp: new Date().toISOString(),
        details: { action: "reject", reviewer: reviewerName },
      });
    } catch (err) {
      console.error("[Hedera] Failed to log APPROVAL_REJECTED:", err);
    }
  }

  addAuditEntry({
    type: "APPROVAL_REJECTED",
    intentId,
    actor: reviewerName,
    txHash: hcsResult.transactionId || "—",
    hcsTopic: hcsResult.topicId || topicId,
    hcsSequence: hcsResult.sequenceNumber,
    time: "Just now",
    badge: "Rejected",
  });

  updateIntent(intentId, {
    status: "rejected",
    reviewedBy: reviewerName,
    reviewedAt: new Date().toISOString(),
  });

  return getIntent(intentId)!;
}

// ── Update policy config ──────────────────────────────────────────────
export async function savePolicyConfig(
  updates: Partial<PolicyConfig>
): Promise<PolicyConfig> {
  return updatePolicy(updates);
}

// ── Data fetchers ─────────────────────────────────────────────────────
export async function fetchAllIntents(): Promise<PaymentIntent[]> {
  return getAllIntents();
}

export async function fetchEscalatedIntents(): Promise<PaymentIntent[]> {
  return getIntentsByStatus("escalated");
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  return getAuditLog();
}

export async function fetchPolicy(): Promise<PolicyConfig> {
  return getPolicy();
}

export async function fetchStats() {
  return getStats();
}

export async function fetchTopicId(): Promise<string> {
  if (isHederaConfigured()) {
    try {
      return await getOrCreateTopic();
    } catch {
      return process.env.HCS_TOPIC_ID || "—";
    }
  }
  return process.env.HCS_TOPIC_ID || "—";
}

export async function fetchOperatorId(): Promise<string> {
  return getOperatorId() || "0.0.3459114";
}

export async function fetchHederaStatus(): Promise<boolean> {
  return isHederaConfigured();
}

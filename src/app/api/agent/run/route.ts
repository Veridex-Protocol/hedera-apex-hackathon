import { NextResponse } from "next/server";
import { runAgent, AGENT_SCENARIOS, isAgentConfigured } from "@/lib/agent";
import { createIntent, updateIntent, addAuditEntry } from "@/lib/store";
import { evaluatePolicy } from "@/lib/policy";
import {
  isHederaConfigured,
  submitAuditEvent,
  createScheduledTransfer,
} from "@/lib/hedera";

/**
 * AI Agent Endpoint — Gemini-powered autonomous payment agent
 *
 * POST /api/agent/run  { scenarioId: "month-end-ops" }
 * GET  /api/agent/run  → returns available scenarios
 */

export async function GET() {
  return NextResponse.json({
    scenarios: AGENT_SCENARIOS.map((s) => ({
      id: s.id,
      label: s.label,
      prompt: s.prompt,
    })),
    agentConfigured: isAgentConfigured(),
    hederaConfigured: isHederaConfigured(),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const scenarioId = body.scenarioId || "month-end-ops";

  // 1. Run the AI agent — Gemini reasons about the scenario
  const agentResult = await runAgent(scenarioId);

  // 2. Route each proposal through the policy engine → Hedera
  const executionResults: Array<{
    intentId: string;
    recipientLabel: string;
    amount: number;
    decision: string;
    reason: string;
    hcsLogged: boolean;
    txId: string | null;
    scheduleId: string | null;
    agentReasoning: string;
  }> = [];

  const hederaReady = isHederaConfigured();

  for (const proposal of agentResult.proposals) {
    // Create the intent in store
    const intent = createIntent({
      actorId: agentResult.agentId,
      actorName: agentResult.agentName,
      recipientId: proposal.recipientId,
      amount: proposal.amount,
      currency: proposal.currency,
      purpose: proposal.purpose,
    });

    // Run policy evaluation
    const policyResult = evaluatePolicy(intent.amount, intent.recipientId);
    updateIntent(intent.id, {
      status: policyResult.decision,
      policyRule: policyResult.rule,
      policyReason: policyResult.reason,
    });

    // Audit entries
    addAuditEntry({
      type: "INTENT_CREATED",
      intentId: intent.id,
      actor: agentResult.agentName,
      txHash: "—",
      hcsTopic: "—",
      hcsSequence: "—",
      time: "Just now",
      badge: "AI Agent",
    });

    const decisionType =
      policyResult.decision === "approved"
        ? "POLICY_APPROVED"
        : policyResult.decision === "escalated"
          ? "POLICY_ESCALATED"
          : "POLICY_BLOCKED";

    addAuditEntry({
      type: decisionType,
      intentId: intent.id,
      actor: agentResult.agentName,
      txHash: "—",
      hcsTopic: "—",
      hcsSequence: "—",
      time: "Just now",
      badge:
        policyResult.decision === "approved"
          ? "Approved"
          : policyResult.decision === "escalated"
            ? "Escalated"
            : "Blocked",
    });

    let hcsLogged = false;
    let txId: string | null = null;
    let scheduleId: string | null = null;

    if (hederaReady) {
      try {
        // Log to HCS — the AI agent's reasoning + policy decision
        const hcsResult = await submitAuditEvent({
          type: decisionType as "POLICY_APPROVED" | "POLICY_ESCALATED" | "POLICY_BLOCKED",
          intentId: intent.id,
          actor: agentResult.agentName,
          timestamp: new Date().toISOString(),
          details: {
            source: "gemini_ai_agent",
            model: agentResult.modelUsed,
            scenario: agentResult.scenario,
            agentReasoning: proposal.reasoning,
            amount: proposal.amount,
            recipient: proposal.recipientId,
            recipientLabel: proposal.recipientLabel,
            urgency: proposal.urgency,
            policyDecision: policyResult.decision,
            policyRule: policyResult.rule,
          },
        });
        hcsLogged = true;
        txId = hcsResult.transactionId;

        updateIntent(intent.id, {
          hcsTopicId: hcsResult.topicId,
          hcsSequence: hcsResult.sequenceNumber,
        });

        // If approved, create scheduled transaction
        if (policyResult.decision === "approved") {
          const scheduled = await createScheduledTransfer(
            proposal.recipientId,
            proposal.amount,
            `AI Agent: ${proposal.purpose}`
          );
          scheduleId = scheduled.scheduleId;
          updateIntent(intent.id, {
            status: "executed",
            scheduleId: scheduled.scheduleId,
            txId: scheduled.transactionId,
          });

          addAuditEntry({
            type: "EXECUTION_SUCCESS",
            intentId: intent.id,
            actor: agentResult.agentName,
            txHash: scheduled.transactionId,
            hcsTopic: hcsResult.topicId,
            hcsSequence: "—",
            time: "Just now",
            badge: "Settled",
          });
        }
      } catch {
        // Hedera unavailable — intent still recorded
      }
    }

    executionResults.push({
      intentId: intent.id,
      recipientLabel: proposal.recipientLabel,
      amount: proposal.amount,
      decision: policyResult.decision,
      reason: policyResult.reason,
      hcsLogged,
      txId,
      scheduleId,
      agentReasoning: proposal.reasoning,
    });
  }

  const summary = {
    approved: executionResults.filter((r) => r.decision === "approved").length,
    escalated: executionResults.filter((r) => r.decision === "escalated")
      .length,
    blocked: executionResults.filter((r) => r.decision === "blocked").length,
  };

  return NextResponse.json({
    agent: {
      id: agentResult.agentId,
      name: agentResult.agentName,
      model: agentResult.modelUsed,
      scenario: agentResult.scenario,
    },
    thoughts: agentResult.thoughts,
    proposals: agentResult.proposals,
    totalProposed: agentResult.totalProposed,
    execution: {
      summary,
      results: executionResults,
    },
    message: `AI agent analyzed "${agentResult.scenario}" and proposed ${agentResult.proposals.length} payments ($${agentResult.totalProposed.toLocaleString()}). ${summary.approved} auto-approved, ${summary.escalated} escalated, ${summary.blocked} blocked.`,
  });
}

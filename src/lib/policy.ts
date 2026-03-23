import { getPolicy } from "./store";

export interface PolicyResult {
  decision: "approved" | "escalated" | "blocked";
  rule: string;
  reason: string;
}

/**
 * Evaluate a payment intent against the active policy configuration.
 * Returns the decision and the rule that matched.
 */
export function evaluatePolicy(
  amount: number,
  recipientId: string
): PolicyResult {
  const config = getPolicy();

  // Rule 1: Hard block — amount exceeds maximum
  if (amount > config.blockMaxTx) {
    return {
      decision: "blocked",
      rule: "HARD_BLOCK_MAX_TX",
      reason: `Transaction amount $${amount.toLocaleString()} exceeds hard block limit of $${config.blockMaxTx.toLocaleString()}. Intent rejected before execution.`,
    };
  }

  // Rule 2: Hard block — daily volume exceeded (simplified — per-transaction for MVP)
  if (amount > config.blockMaxDaily) {
    return {
      decision: "blocked",
      rule: "HARD_BLOCK_MAX_DAILY",
      reason: `Transaction would exceed daily volume limit of $${config.blockMaxDaily.toLocaleString()}.`,
    };
  }

  // Rule 3: Escalate — counterparty not in whitelist
  const isWhitelisted = config.whitelist.some(
    (w) => w.address === recipientId
  );

  // Rule 4: Escalate — amount above auto-approval threshold
  if (amount > config.autoApproveMaxTx) {
    return {
      decision: "escalated",
      rule: "ESCALATE_AMOUNT_THRESHOLD",
      reason: `Amount $${amount.toLocaleString()} exceeds auto-approval threshold of $${config.autoApproveMaxTx.toLocaleString()}. Requires human review.`,
    };
  }

  // Rule 5: Escalate — unknown counterparty
  if (!isWhitelisted) {
    return {
      decision: "escalated",
      rule: "ESCALATE_UNKNOWN_COUNTERPARTY",
      reason: `Recipient ${recipientId} is not in the counterparty whitelist. Requires human review.`,
    };
  }

  // Rule 6: Auto-approve — all checks passed
  return {
    decision: "approved",
    rule: "AUTO_APPROVE",
    reason: `Auto-approved: amount $${amount.toLocaleString()} is within threshold and recipient ${recipientId} is whitelisted.`,
  };
}

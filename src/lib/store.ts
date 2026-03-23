// ── Types ──────────────────────────────────────────────────────────────
export type IntentStatus =
  | "proposed"
  | "approved"
  | "escalated"
  | "blocked"
  | "executed"
  | "rejected"
  | "expired";

export interface PaymentIntent {
  id: string;
  actorId: string;
  actorName: string;
  recipientId: string;
  amount: number;
  currency: string;
  purpose: string;
  status: IntentStatus;
  policyReason: string;
  policyRule: string;
  scheduleId: string | null;
  txId: string | null;
  hcsSequence: string | null;
  hcsTopicId: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  type: string;
  intentId: string;
  actor: string;
  txHash: string;
  hcsTopic: string;
  hcsSequence: string;
  time: string;
  timestamp: number;
  badge: string;
}

export interface PolicyConfig {
  autoApproveMaxTx: number;
  autoApproveMaxDaily: number;
  blockMaxTx: number;
  blockMaxDaily: number;
  whitelist: { address: string; label: string }[];
}

// ── In-Memory Store ───────────────────────────────────────────────────
// In production this would be a database. For MVP, global state across
// server actions is sufficient since Next.js server actions run in the
// same Node process.

const intents: Map<string, PaymentIntent> = new Map();
const auditLog: AuditLogEntry[] = [];
let intentCounter = 800;
let auditCounter = 90200;

const defaultPolicy: PolicyConfig = {
  autoApproveMaxTx: 1000,
  autoApproveMaxDaily: 10000,
  blockMaxTx: 10000,
  blockMaxDaily: 50000,
  whitelist: [
    { address: "0.0.984210", label: "Operations Wallet" },
    { address: "0.0.457891", label: "SaaS Provider Payout" },
  ],
};

let policy: PolicyConfig = { ...defaultPolicy };

// ── Intent CRUD ───────────────────────────────────────────────────────
export function createIntent(
  data: Omit<
    PaymentIntent,
    | "id"
    | "status"
    | "policyReason"
    | "policyRule"
    | "scheduleId"
    | "txId"
    | "hcsSequence"
    | "hcsTopicId"
    | "createdAt"
    | "updatedAt"
    | "reviewedBy"
    | "reviewedAt"
  >
): PaymentIntent {
  intentCounter++;
  const now = new Date().toISOString();
  const intent: PaymentIntent = {
    id: `INT-${intentCounter}`,
    ...data,
    status: "proposed",
    policyReason: "",
    policyRule: "",
    scheduleId: null,
    txId: null,
    hcsSequence: null,
    hcsTopicId: null,
    createdAt: now,
    updatedAt: now,
    reviewedBy: null,
    reviewedAt: null,
  };
  intents.set(intent.id, intent);
  return intent;
}

export function getIntent(id: string): PaymentIntent | undefined {
  return intents.get(id);
}

export function updateIntent(
  id: string,
  updates: Partial<PaymentIntent>
): PaymentIntent | undefined {
  const intent = intents.get(id);
  if (!intent) return undefined;
  Object.assign(intent, updates, { updatedAt: new Date().toISOString() });
  return intent;
}

export function getAllIntents(): PaymentIntent[] {
  return Array.from(intents.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getIntentsByStatus(status: IntentStatus): PaymentIntent[] {
  return getAllIntents().filter((i) => i.status === status);
}

// ── Audit Log ─────────────────────────────────────────────────────────
export function addAuditEntry(
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): AuditLogEntry {
  auditCounter++;
  const full: AuditLogEntry = {
    ...entry,
    id: `evt_${auditCounter}`,
    timestamp: Date.now(),
  };
  auditLog.unshift(full); // newest first
  return full;
}

export function getAuditLog(): AuditLogEntry[] {
  return auditLog;
}

export function getAuditLogForIntent(intentId: string): AuditLogEntry[] {
  return auditLog.filter((e) => e.intentId === intentId);
}

// ── Policy ────────────────────────────────────────────────────────────
export function getPolicy(): PolicyConfig {
  return { ...policy };
}

export function updatePolicy(updates: Partial<PolicyConfig>): PolicyConfig {
  policy = { ...policy, ...updates };
  return getPolicy();
}

// ── Stats ─────────────────────────────────────────────────────────────
export function getStats() {
  const all = getAllIntents();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const recent = all.filter(
    (i) => new Date(i.createdAt).getTime() > dayAgo
  );

  const approved = recent.filter(
    (i) => i.status === "approved" || i.status === "executed"
  ).length;
  const escalated = all.filter((i) => i.status === "escalated").length;
  const blocked = recent.filter((i) => i.status === "blocked").length;
  const totalVolume = recent
    .filter((i) => i.status === "executed" || i.status === "approved")
    .reduce((sum, i) => sum + i.amount, 0);

  return { approved, escalated, blocked, totalVolume };
}

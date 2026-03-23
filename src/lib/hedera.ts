import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  Hbar,
  AccountId,
  PrivateKey,
  TopicId,
  ScheduleId,
  Status,
  TransactionReceipt,
} from "@hashgraph/sdk";

// ── Hedera Client Singleton ────────────────────────────────────────────
let _client: Client | null = null;

export function getClient(): Client {
  if (_client) return _client;

  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;

  if (!accountId || !privateKey) {
    throw new Error(
      "HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in environment"
    );
  }

  const network = process.env.HEDERA_NETWORK || "testnet";
  _client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  _client.setOperator(accountId, privateKey);
  _client.setDefaultMaxTransactionFee(new Hbar(5));
  _client.setDefaultMaxQueryPayment(new Hbar(1));

  return _client;
}

export function getOperatorId(): string {
  return process.env.HEDERA_ACCOUNT_ID || "";
}

// ── HCS Topic Management ──────────────────────────────────────────────
let _topicId: string | null = null;

export async function getOrCreateTopic(): Promise<string> {
  if (_topicId) return _topicId;

  const envTopic = process.env.HCS_TOPIC_ID;
  if (envTopic) {
    _topicId = envTopic;
    return _topicId;
  }

  const client = getClient();
  const tx = new TopicCreateTransaction().setTopicMemo(
    "Veridex Agent Firewall — Audit Evidence Stream"
  );

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  if (!receipt.topicId) {
    throw new Error("Failed to create HCS topic");
  }

  _topicId = receipt.topicId.toString();
  console.log(`[Hedera] Created HCS Topic: ${_topicId}`);
  return _topicId;
}

// ── HCS Message Submission ────────────────────────────────────────────
export interface AuditEvent {
  type:
    | "INTENT_CREATED"
    | "POLICY_APPROVED"
    | "POLICY_ESCALATED"
    | "POLICY_BLOCKED"
    | "APPROVAL_GRANTED"
    | "APPROVAL_REJECTED"
    | "EXECUTION_SUCCESS"
    | "EXECUTION_FAILED";
  intentId: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface HCSSubmitResult {
  topicId: string;
  sequenceNumber: string;
  transactionId: string;
}

export async function submitAuditEvent(
  event: AuditEvent
): Promise<HCSSubmitResult> {
  const client = getClient();
  const topicId = await getOrCreateTopic();

  const message = JSON.stringify(event);
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(message);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  return {
    topicId,
    sequenceNumber: receipt.topicSequenceNumber?.toString() || "0",
    transactionId: response.transactionId.toString(),
  };
}

// ── HBAR Transfer (direct) ────────────────────────────────────────────
export interface TransferResult {
  transactionId: string;
  status: string;
}

export async function executeTransfer(
  recipientId: string,
  amountHbar: number
): Promise<TransferResult> {
  const client = getClient();
  const operatorId = getOperatorId();

  const tx = new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(operatorId), new Hbar(-amountHbar))
    .addHbarTransfer(AccountId.fromString(recipientId), new Hbar(amountHbar));

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  return {
    transactionId: response.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

// ── Scheduled Transaction ─────────────────────────────────────────────
export interface ScheduledTransferResult {
  scheduleId: string;
  scheduledTransactionId: string;
  transactionId: string;
}

export async function createScheduledTransfer(
  recipientId: string,
  amountHbar: number,
  memo: string
): Promise<ScheduledTransferResult> {
  const client = getClient();
  const operatorId = getOperatorId();

  // Build the inner transfer that will be scheduled
  const innerTransfer = new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(operatorId), new Hbar(-amountHbar))
    .addHbarTransfer(AccountId.fromString(recipientId), new Hbar(amountHbar));

  // Create the schedule
  const scheduleTx = new ScheduleCreateTransaction()
    .setScheduledTransaction(innerTransfer)
    .setScheduleMemo(`Veridex: ${memo}`)
    .setAdminKey(PrivateKey.fromStringDer(process.env.HEDERA_PRIVATE_KEY!));

  const response = await scheduleTx.execute(client);
  const receipt = await response.getReceipt(client);

  if (!receipt.scheduleId) {
    throw new Error("Failed to create scheduled transaction");
  }

  return {
    scheduleId: receipt.scheduleId.toString(),
    scheduledTransactionId:
      receipt.scheduledTransactionId?.toString() || "",
    transactionId: response.transactionId.toString(),
  };
}

// ── Sign / Execute a Scheduled Transaction ────────────────────────────
export async function signScheduledTransaction(
  scheduleId: string
): Promise<TransferResult> {
  const client = getClient();

  const tx = new ScheduleSignTransaction().setScheduleId(
    ScheduleId.fromString(scheduleId)
  );

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  return {
    transactionId: response.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

// ── Utility: Check if Hedera client is configured ────────────────────
export function isHederaConfigured(): boolean {
  return !!(process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY);
}

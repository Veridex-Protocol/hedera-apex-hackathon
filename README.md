# Veridex — AI Agent Payment Firewall on Hedera

> **Hedera Hello Future Apex Hackathon 2026 — Theme 1: AI & Agents**

Veridex is a real-time policy engine and settlement layer that governs autonomous AI agent payments on the Hedera network. When AI agents need to move money, Veridex evaluates every payment intent against configurable policies, logs immutable audit trails to the **Hedera Consensus Service (HCS)**, and settles approved transfers via **Hedera Scheduled Transactions**.

## The Problem

Autonomous AI agents are increasingly empowered to make financial decisions — paying vendors, settling trades, disbursing funds. But without guardrails, a rogue or misconfigured agent can drain treasury accounts in seconds. There's no standard infrastructure for **governing agent payments** before they hit the blockchain.

## The Solution

Veridex sits between the AI agent's intent and the blockchain settlement:

```
AI Agent → Payment Intent → Policy Engine → HCS Audit Log → Scheduled Transaction → Settlement
```

1. **Agent declares intent** — "I want to pay 0.0.984210 $5,000 for contractor milestone"
2. **Policy engine evaluates** — Checks amount thresholds, counterparty whitelist, daily limits
3. **Decision routes** — Auto-approve (< $1K + whitelisted), escalate (human review), or hard block (> $10K)
4. **HCS audit trail** — Every decision is logged immutably to a Hedera Consensus Service topic
5. **Scheduled Transaction** — Approved payments settle via Hedera Scheduled Transactions with multi-sig support

## Hedera Integration

| Service | Usage |
|---|---|
| **HCS (Consensus Service)** | Immutable audit log — every intent, policy decision, approval, and execution is recorded as an HCS message with on-chain sequence numbers |
| **Scheduled Transactions** | Approved payments create scheduled transfers that can require multi-sig approval before execution |
| **HBAR Transfers** | Settlement of approved intents via native HBAR transfers |
| **HashScan Verification** | All HCS topics and transactions are verifiable on [HashScan](https://hashscan.io/testnet/) |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Agent Fleet │────▶│  Policy Engine    │────▶│  Hedera Network │
│  (4 agents)     │     │  (6 rules)        │     │  • HCS Topics   │
│                 │     │  • Auto-approve   │     │  • Scheduled Tx  │
│  Veridex_H1     │     │  • Escalate       │     │  • HBAR Transfer │
│  PayoutAgent    │     │  • Hard block     │     │                 │
│  ExpenseBot     │     │  • Whitelist      │     └─────────────────┘
│  Arbitrage_Core │     │  • Daily limits   │              │
└─────────────────┘     └──────────────────┘     ┌─────────────────┐
                               │                  │  HashScan       │
                        ┌──────────────────┐     │  (Verification) │
                        │  Operator Console│     └─────────────────┘
                        │  • Dashboard     │
                        │  • Approval Queue│
                        │  • Audit Feed    │
                        │  • Policy Config │
                        └──────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- A Hedera Testnet account ([portal.hedera.com](https://portal.hedera.com))

### Setup

```bash
cd app
npm install

# Configure your Hedera testnet credentials
cp .env.example .env.local
# Edit .env.local with your HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Flow

1. **Dashboard** — Overview of all agent activity, live stats, HCS topic link
2. **Create Intent** (`/intent/new`) — Submit a payment intent as any of the 4 AI agents
3. **Approval Queue** (`/queue`) — Review and approve/reject escalated intents (creates Hedera Scheduled Transactions)
4. **Audit Feed** (`/audit`) — View the immutable HCS audit trail with HashScan verification links
5. **Policy Console** (`/policy`) — Configure thresholds, whitelist addresses, toggle rules live

### AI Agent Simulation

Hit the simulation endpoint to generate a batch of diverse agent payment intents:

```bash
# Simulate 5 agent intents (auto-routed through policy engine + HCS)
curl http://localhost:3000/api/agent/simulate

# Or customize
curl -X POST http://localhost:3000/api/agent/simulate \
  -H "Content-Type: application/json" \
  -d '{"count": 8}'
```

## Tech Stack

- **Next.js 16** — React 19, Server Actions, App Router
- **Hedera SDK** (`@hashgraph/sdk` v2.81.0) — Native HCS, Scheduled Transactions, Transfers
- **TypeScript** — Full type safety across the stack
- **Framer Motion** — Smooth UI transitions
- **Custom Design System** — Glassmorphism dark theme

## Policy Rules

| Rule | Threshold | Action |
|---|---|---|
| Auto-Approve | Amount ≤ $1,000 + whitelisted recipient | Execute immediately via Scheduled Tx |
| Escalate (Amount) | $1,000 < Amount ≤ $10,000 | Route to human approval queue |
| Escalate (Unknown) | Recipient not on whitelist | Route to human approval queue |
| Hard Block | Amount > $10,000 | Reject immediately, log to HCS |
| Daily Limit | Cumulative volume exceeded | Block until next period |

All thresholds are configurable live from the Policy Console.

## Team

**Veridex** — Building the trust layer for autonomous agent payments.

## License

MIT

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

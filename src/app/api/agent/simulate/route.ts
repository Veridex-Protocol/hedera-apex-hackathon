import { NextResponse } from 'next/server';
import { createIntent, updateIntent } from '@/lib/store';
import { evaluatePolicy } from '@/lib/policy';
import { addAuditEntry } from '@/lib/store';
import {
  isHederaConfigured,
  submitAuditEvent,
  createScheduledTransfer,
} from '@/lib/hedera';

/**
 * AI Agent Simulation Endpoint
 * 
 * Simulates an autonomous AI agent proposing a batch of payment intents
 * with varied amounts and counterparties. Each intent flows through
 * the real policy engine → HCS audit logging → Hedera scheduled transactions.
 * 
 * GET /api/agent/simulate  → run a batch of 5 diverse agent intents
 * POST /api/agent/simulate → run with custom { count, agentName }
 */

const SCENARIOS = [
  { actorId: 'agent-h1', actorName: 'Veridex_Agent_H1', recipientId: '0.0.984210', amount: 150, currency: 'USD', purpose: 'Weekly cloud hosting bill – auto-pay' },
  { actorId: 'payout-01', actorName: 'PayoutAgent_01', recipientId: '0.0.457891', amount: 2500, currency: 'USD', purpose: 'Contractor milestone payout' },
  { actorId: 'expense-bot', actorName: 'ExpenseBot', recipientId: '0.0.112233', amount: 42.50, currency: 'USD', purpose: 'Office supply reimbursement' },
  { actorId: 'arb-core', actorName: 'Arbitrage_Core', recipientId: '0.0.999000', amount: 75000, currency: 'USD', purpose: 'Cross-DEX arbitrage settlement' },
  { actorId: 'agent-h1', actorName: 'Veridex_Agent_H1', recipientId: '0.0.984210', amount: 800, currency: 'USD', purpose: 'SaaS license renewal – monthly' },
  { actorId: 'payout-01', actorName: 'PayoutAgent_01', recipientId: '0.0.556677', amount: 5500, currency: 'USD', purpose: 'Quarterly bonus distribution' },
  { actorId: 'expense-bot', actorName: 'ExpenseBot', recipientId: '0.0.457891', amount: 19.99, currency: 'USD', purpose: 'Developer tool subscription' },
  { actorId: 'arb-core', actorName: 'Arbitrage_Core', recipientId: '0.0.111929', amount: 150000, currency: 'USD', purpose: 'Large block trade settlement' },
];

async function runSimulation(count: number) {
  const results: Array<{
    intentId: string;
    decision: string;
    reason: string;
    hcsLogged: boolean;
    scheduledTxId: string | null;
  }> = [];

  const shuffled = [...SCENARIOS].sort(() => Math.random() - 0.5).slice(0, count);
  const hederaReady = isHederaConfigured();

  for (const scenario of shuffled) {
    const intent = createIntent({
      actorId: scenario.actorId,
      actorName: scenario.actorName,
      recipientId: scenario.recipientId,
      amount: scenario.amount,
      currency: scenario.currency,
      purpose: scenario.purpose,
    });

    const policyResult = evaluatePolicy(intent.amount, intent.recipientId);
    updateIntent(intent.id, { status: policyResult.decision, policyRule: policyResult.rule, policyReason: policyResult.reason });

    addAuditEntry({
      type: 'INTENT_CREATED',
      intentId: intent.id,
      actor: scenario.actorName,
      txHash: '—',
      hcsTopic: '—',
      hcsSequence: '—',
      time: 'Just now',
      badge: 'Proposed',
    });

    const decisionType = policyResult.decision === 'approved'
      ? 'POLICY_APPROVED'
      : policyResult.decision === 'escalated'
        ? 'POLICY_ESCALATED'
        : 'POLICY_BLOCKED';

    const badgeLabel = policyResult.decision === 'approved' ? 'Approved' : policyResult.decision === 'escalated' ? 'Escalated' : 'Blocked';

    addAuditEntry({
      type: decisionType,
      intentId: intent.id,
      actor: scenario.actorName,
      txHash: '—',
      hcsTopic: '—',
      hcsSequence: '—',
      time: 'Just now',
      badge: badgeLabel,
    });

    let hcsLogged = false;
    let scheduledTxId: string | null = null;

    if (hederaReady) {
      try {
        await submitAuditEvent({
          type: 'INTENT_CREATED',
          intentId: intent.id,
          actor: scenario.actorName,
          timestamp: new Date().toISOString(),
          details: {
            amount: scenario.amount,
            recipient: scenario.recipientId,
            decision: policyResult.decision,
            rule: policyResult.rule,
            source: 'agent_simulation',
          },
        });
        hcsLogged = true;

        if (policyResult.decision === 'approved') {
          const result = await createScheduledTransfer(scenario.recipientId, scenario.amount, scenario.purpose);
          scheduledTxId = result.scheduleId;
          updateIntent(intent.id, { status: 'executed', scheduleId: result.scheduleId, txId: result.transactionId });

          addAuditEntry({
            type: 'EXECUTION_SUCCESS',
            intentId: intent.id,
            actor: scenario.actorName,
            txHash: result.transactionId || '—',
            hcsTopic: '—',
            hcsSequence: '—',
            time: 'Just now',
            badge: 'Settled',
          });
        }
      } catch {
        // Hedera call failed — intent still recorded in store
      }
    }

    results.push({
      intentId: intent.id,
      decision: policyResult.decision,
      reason: policyResult.reason,
      hcsLogged,
      scheduledTxId,
    });
  }

  return results;
}

export async function GET() {
  const results = await runSimulation(5);
  
  const summary = {
    approved: results.filter(r => r.decision === 'approved').length,
    escalated: results.filter(r => r.decision === 'escalated').length,
    blocked: results.filter(r => r.decision === 'blocked').length,
  };

  return NextResponse.json({
    status: 'simulation_complete',
    agent: 'Veridex AI Agent Fleet',
    intentsProcessed: results.length,
    summary,
    results,
    message: `Simulated ${results.length} agent payment intents. ${summary.approved} auto-approved, ${summary.escalated} escalated for human review, ${summary.blocked} blocked by policy.`,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const count = Math.min(Math.max(body.count || 5, 1), 8);
  const results = await runSimulation(count);
  
  const summary = {
    approved: results.filter(r => r.decision === 'approved').length,
    escalated: results.filter(r => r.decision === 'escalated').length,
    blocked: results.filter(r => r.decision === 'blocked').length,
  };

  return NextResponse.json({
    status: 'simulation_complete',
    agent: body.agentName || 'Veridex AI Agent Fleet',
    intentsProcessed: results.length,
    summary,
    results,
  });
}

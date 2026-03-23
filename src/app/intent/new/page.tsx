"use client";

import { useState, useTransition } from 'react';
import { Send, FileText, User, Loader2, Bot } from 'lucide-react';
import { submitIntent } from '@/app/actions';

type Outcome = 'draft' | 'approved' | 'escalated' | 'blocked' | 'executed';

interface ResultData {
  intentId: string;
  decision: Outcome;
  reason: string;
  rule: string;
  scheduleId: string | null;
  txId: string | null;
  hcsTopicId: string | null;
  hcsSequence: string | null;
}

export default function NewIntent() {
  const [outcome, setOutcome] = useState<Outcome>('draft');
  const [result, setResult] = useState<ResultData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actorName, setActorName] = useState('Veridex_Agent_H1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const recipient = (form.recipient as HTMLInputElement).value;
    const amount = parseFloat((form.amount as HTMLInputElement).value);
    const memo = (form.memo as HTMLTextAreaElement).value;

    startTransition(async () => {
      const { intent, policy } = await submitIntent({
        actorName,
        actorId: '0.0.123456',
        recipientId: recipient,
        amount,
        currency: 'HBAR',
        purpose: memo,
      });

      const decision = (intent.status === 'executed' ? 'approved' : intent.status) as Outcome;
      setOutcome(decision);
      setResult({
        intentId: intent.id,
        decision,
        reason: policy.reason,
        rule: policy.rule,
        scheduleId: intent.scheduleId,
        txId: intent.txId,
        hcsTopicId: intent.hcsTopicId,
        hcsSequence: intent.hcsSequence,
      });
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="mb-8">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Create Payment Intent</h1>
        <p className="text-sm">Initiate a software-driven payment on Hedera. Your intent will be evaluated against active treasury policies.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel animate-slide-up" style={{ padding: '32px' }}>
        <div className="flex-col gap-6">
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Actor Identity
            </label>
            <div className="flex items-center gap-2" style={{ padding: '12px 16px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <Bot size={16} color="var(--brand-primary)" />
              <select 
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'monospace', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Veridex_Agent_H1">Veridex_Agent_H1 (0.0.123456)</option>
                <option value="PayoutAgent_01">PayoutAgent_01 (0.0.234567)</option>
                <option value="ExpenseBot">ExpenseBot (0.0.345678)</option>
                <option value="Arbitrage_Core">Arbitrage_Core (0.0.456789)</option>
              </select>
            </div>
            <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>The AI agent identity submitting this transaction intention.</p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Recipient Hedera ID
            </label>
            <input name="recipient" required className="glass-input" placeholder="0.0.XYZ" defaultValue="0.0.984210" />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Amount (HBAR)
            </label>
            <input name="amount" type="number" step="0.01" required className="glass-input" placeholder="0.00" defaultValue="500" />
            <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              &lt;$1,000 + whitelisted = auto-approved. &gt;$1,000 = escalated. &gt;$10,000 = blocked.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Purpose / Memo
            </label>
            <textarea name="memo" required className="glass-input" rows={3} placeholder="Provide purpose for audit log..." defaultValue="Weekly service provider payout."></textarea>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button type="submit" className="glass-button w-full" style={{ padding: '16px' }} disabled={isPending}>
              {isPending ? (
                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Evaluating on Hedera...</>
              ) : (
                <><Send size={18} /> Submit Intent &amp; Evaluate</>
              )}
            </button>
          </div>
        </div>
      </form>

      {outcome !== 'draft' && result && (
        <div className="animate-slide-up" style={{ marginTop: '32px', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Policy Evaluation Result</h3>
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{result.intentId}</span>
          </div>
          
          <div className="flex items-center gap-4">
            {outcome === 'approved' && (
               <div style={{ flex: 1, padding: '24px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                 <div className="flex items-center gap-2 mb-2">
                   <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)' }}></div>
                   <h4 style={{ color: 'var(--success)', fontSize: '1.125rem', fontWeight: 600 }}>Approved &amp; Executed</h4>
                 </div>
                 <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{result.reason}</p>
                 {result.txId && (
                   <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px', marginBottom: '8px' }}>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hedera Tx: </span>
                     <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--success)' }}>{result.txId}</span>
                   </div>
                 )}
                 {result.scheduleId && (
                   <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px', marginBottom: '8px' }}>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Schedule ID: </span>
                     <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--success)' }}>{result.scheduleId}</span>
                   </div>
                 )}
                 <a href="/audit" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', marginTop: '4px' }}>
                   View audit evidence <FileText size={14} />
                 </a>
               </div>
            )}

            {outcome === 'escalated' && (
               <div style={{ flex: 1, padding: '24px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px' }}>
                 <div className="flex items-center gap-2 mb-2">
                   <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--warning)', animation: 'pulse-glow 2s infinite' }}></div>
                   <h4 style={{ color: 'var(--warning)', fontSize: '1.125rem', fontWeight: 600 }}>Escalated to Review</h4>
                 </div>
                 <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{result.reason}</p>
                 {result.hcsTopicId && result.hcsTopicId !== '—' && (
                   <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '6px', marginBottom: '8px' }}>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logged to HCS Topic: </span>
                     <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--warning)' }}>{result.hcsTopicId}</span>
                   </div>
                 )}
                 <a href="/queue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', marginTop: '4px', color: 'var(--warning)' }}>
                   Go to approval queue <FileText size={14} />
                 </a>
               </div>
            )}

            {outcome === 'blocked' && (
               <div style={{ flex: 1, padding: '24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
                 <div className="flex items-center gap-2 mb-2">
                   <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--danger)' }}></div>
                   <h4 style={{ color: 'var(--danger)', fontSize: '1.125rem', fontWeight: 600 }}>Blocked by Policy</h4>
                 </div>
                 <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{result.reason}</p>
                 {result.hcsTopicId && result.hcsTopicId !== '—' && (
                   <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', marginBottom: '8px' }}>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Evidence logged to HCS: </span>
                     <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--danger)' }}>{result.hcsTopicId}</span>
                   </div>
                 )}
                 <a href="/audit" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', marginTop: '4px', color: 'var(--danger)' }}>
                   View HCS evidence log <FileText size={14} />
                 </a>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

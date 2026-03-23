"use client";

import { useState, useEffect, useTransition } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { fetchEscalatedIntents, approveIntent, rejectIntent } from '@/app/actions';

interface EscalatedItem {
  id: string;
  actorName: string;
  recipientId: string;
  amount: number;
  policyReason: string;
  policyRule: string;
  purpose: string;
  createdAt: string;
}

export default function ApprovalQueue() {
  const [items, setItems] = useState<EscalatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadItems = async () => {
    setLoading(true);
    const intents = await fetchEscalatedIntents();
    setItems(intents.map(i => ({
      id: i.id,
      actorName: i.actorName,
      recipientId: i.recipientId,
      amount: i.amount,
      policyReason: i.policyReason,
      policyRule: i.policyRule,
      purpose: i.purpose,
      createdAt: i.createdAt,
    })));
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, []);

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    startTransition(async () => {
      if (action === 'approve') {
        await approveIntent(id, 'Treasury Operator');
      } else {
        await rejectIntent(id, 'Treasury Operator');
      }
      setProcessingId(null);
      await loadItems();
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Approval Queue</h1>
          <p className="text-sm">Review escalated intents before final authorization to Hedera.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={loadItems} className="glass-button secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <div className="status-badge escalated">
            <AlertTriangle size={14} /> {items.length} Escalations Pending
          </div>
        </div>
      </div>

      <div className="flex-col gap-6 animate-slide-up">
        {loading ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <Loader2 size={48} color="var(--brand-primary)" style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Loading Queue...</h3>
          </div>
        ) : items.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
            <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Queue Empty</h3>
            <p className="text-sm">No intents currently require operator approval.</p>
            <p className="text-sm" style={{ marginTop: '8px' }}>
              <a href="/intent/new" style={{ color: 'var(--brand-primary)' }}>Create an intent</a> with amount &gt; $1,000 to see escalation in action.
            </p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="glass-panel" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', alignItems: 'center', padding: '24px', opacity: processingId === item.id ? 0.6 : 1, transition: 'opacity 0.3s' }}>
              <div className="flex-col gap-2">
                <div className="flex items-center gap-4 mb-2">
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '1.125rem' }}>{item.id}</span>
                  <span className="status-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    {item.policyRule === 'ESCALATE_AMOUNT_THRESHOLD' ? 'Amount exceeds threshold' : 'Counterparty not whitelisted'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{timeAgo(item.createdAt)}</span>
                </div>
                
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.policyReason}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '8px' }}>
                  <div className="glass-panel" style={{ padding: '12px 16px', background: 'var(--bg-glass)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actor</span>
                    <div style={{ fontWeight: 500, marginTop: '4px' }}>{item.actorName}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '12px 16px', background: 'var(--bg-glass)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient</span>
                    <div style={{ fontWeight: 500, fontFamily: 'monospace', marginTop: '4px' }}>{item.recipientId}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '12px 16px', background: 'var(--bg-glass)', borderLeft: '3px solid var(--brand-primary)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</span>
                    <div style={{ fontWeight: 700, fontSize: '1.125rem', marginTop: '4px', color: 'var(--brand-primary)' }}>{formatAmount(item.amount)}</div>
                  </div>
                </div>
                
                {item.purpose && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Purpose: {item.purpose}
                  </div>
                )}
              </div>

              <div className="flex-col gap-3">
                <button 
                  onClick={() => handleAction(item.id, 'approve')}
                  disabled={processingId === item.id}
                  className="glass-button w-full" 
                  style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', minWidth: '180px' }}>
                  {processingId === item.id ? (
                    <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Signing...</>
                  ) : (
                    <><CheckCircle size={18} /> Approve &amp; Execute</>
                  )}
                </button>
                <button 
                  onClick={() => handleAction(item.id, 'reject')}
                  disabled={processingId === item.id}
                  className="glass-button w-full" 
                  style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <XCircle size={18} /> Reject Intent
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { ShieldCheck, Crosshair, ArrowUpRight, Activity, RefreshCw, Bot, ExternalLink } from 'lucide-react';
import { fetchAllIntents, fetchStats, fetchTopicId, fetchHederaStatus } from '@/app/actions';

interface IntentRow {
  id: string;
  actorName: string;
  recipientId: string;
  amount: number;
  status: string;
  txId: string | null;
  scheduleId: string | null;
}

export default function Dashboard() {
  const [intents, setIntents] = useState<IntentRow[]>([]);
  const [stats, setStats] = useState({ approved: 0, escalated: 0, blocked: 0, totalVolume: 0 });
  const [topicId, setTopicId] = useState('—');
  const [hederaActive, setHederaActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [allIntents, liveStats, topic, active] = await Promise.all([
      fetchAllIntents(),
      fetchStats(),
      fetchTopicId(),
      fetchHederaStatus(),
    ]);
    setIntents(allIntents.slice(0, 10).map(i => ({
      id: i.id,
      actorName: i.actorName,
      recipientId: i.recipientId,
      amount: i.amount,
      status: i.status,
      txId: i.txId,
      scheduleId: i.scheduleId,
    })));
    setStats(liveStats);
    setTopicId(topic);
    setHederaActive(active);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const formatAmount = (n: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: 'approved', executed: 'approved',
      escalated: 'escalated',
      blocked: 'blocked', rejected: 'blocked',
    };
    const label: Record<string, string> = {
      approved: 'Approved', executed: 'Settled',
      escalated: 'Escalated',
      blocked: 'Blocked', rejected: 'Rejected',
    };
    return <span className={`status-badge ${map[status] || ''}`}>{label[status] || status}</span>;
  };

  const actorColors: Record<string, string> = {
    Veridex_Agent_H1: 'var(--brand-primary)',
    PayoutAgent_01: 'var(--accent-cyan)',
    ExpenseBot: 'var(--accent-purple)',
    Arbitrage_Core: 'var(--danger)',
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Operator Dashboard</h1>
          <p className="text-sm">Manage agent intents, oversee execution queues, and monitor the Hedera settlement layer.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={loadData} className="glass-button secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <div className="status-badge" style={{ 
            background: hederaActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
            color: hederaActive ? 'var(--success)' : 'var(--warning)', 
            border: `1px solid ${hederaActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}` 
          }}>
            <Activity size={14} /> {hederaActive ? 'Settlement Layer Active' : 'Demo Mode (Configure .env)'}
          </div>
        </div>
      </div>

      {/* HCS Topic Banner */}
      {topicId !== '—' && (
        <div className="glass-panel" style={{ padding: '12px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px solid var(--brand-primary)' }}>
          <div className="flex items-center gap-4">
            <Bot size={18} color="var(--brand-primary)" />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              HCS Audit Topic: <span style={{ fontFamily: 'monospace', color: 'var(--brand-primary)', fontWeight: 600 }}>{topicId}</span>
            </span>
          </div>
          <a href={`https://hashscan.io/testnet/topic/${topicId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ fontSize: '0.75rem' }}>
            View on HashScan <ExternalLink size={12} />
          </a>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        <div className="glass-panel stat-card">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">Auto-Approved (24h)</span>
            <ShieldCheck size={20} color="var(--success)" />
          </div>
          <span className="stat-value">{stats.approved.toLocaleString()}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Via Hedera Scheduled Tx</span>
        </div>
        
        <div className="glass-panel stat-card">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">Escalated to Queue</span>
            <Crosshair size={20} color="var(--warning)" />
          </div>
          <span className="stat-value">{stats.escalated.toLocaleString()}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>
            {stats.escalated > 0 ? (
              <a href="/queue" style={{ color: 'var(--warning)' }}>Requires human review →</a>
            ) : 'No pending reviews'}
          </span>
        </div>
        
        <div className="glass-panel stat-card">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm">Blocked by Policy</span>
            <ShieldCheck size={20} color="var(--danger)" />
          </div>
          <span className="stat-value">{stats.blocked.toLocaleString()}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Stopped before settlement</span>
        </div>

        <div className="glass-panel stat-card" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm" style={{ color: 'var(--brand-primary)' }}>Total Volume Validated</span>
            <ArrowUpRight size={20} color="var(--brand-primary)" />
          </div>
          <span className="stat-value">{formatAmount(stats.totalVolume)}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Via Hedera Testnet</span>
        </div>
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>Recent Intents</h2>
        <a href="/intent/new" className="glass-button" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
          + New Intent
        </a>
      </div>
      
      {intents.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Bot size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No Intents Yet</h3>
          <p className="text-sm" style={{ marginBottom: '16px' }}>
            Create a payment intent to see the policy engine and Hedera integration in action.
          </p>
          <div className="flex gap-4" style={{ justifyContent: 'center' }}>
            <a href="/intent/new" className="glass-button">Create Payment Intent</a>
            <a href="/api/agent/simulate" className="glass-button secondary">Run AI Agent Simulation</a>
          </div>
        </div>
      ) : (
        <div className="glass-panel animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-glass-hover)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Intent ID</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Actor</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Recipient</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Amount</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Outcome</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Hedera Ref</th>
              </tr>
            </thead>
            <tbody>
              {intents.map((intent) => (
                <tr key={intent.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.875rem' }}>{intent.id}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div className="flex items-center gap-2">
                      <div style={{ width: '24px', height: '24px', borderRadius: '12px', background: actorColors[intent.actorName] || 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={12} color="white" />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{intent.actorName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '0.875rem', fontFamily: 'monospace' }}>{intent.recipientId}</td>
                  <td style={{ padding: '16px 24px', fontWeight: 600 }}>{formatAmount(intent.amount)}</td>
                  <td style={{ padding: '16px 24px' }}>
                    {statusBadge(intent.status)}
                  </td>
                  <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {intent.scheduleId ? (
                      <a
                        href={`https://hashscan.io/testnet/schedule/${intent.scheduleId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                        style={{ color: 'var(--brand-primary)' }}
                      >
                        {intent.scheduleId} <ExternalLink size={10} />
                      </a>
                    ) : intent.txId && intent.txId !== '—' ? (
                      <a
                        href={`https://hashscan.io/testnet/transaction/${intent.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                        style={{ color: 'var(--accent-cyan)' }}
                      >
                        {intent.txId.substring(0, 24)}... <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

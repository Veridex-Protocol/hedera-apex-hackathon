"use client";

import { useState, useEffect } from 'react';
import { Activity, Search, ShieldAlert, Cpu, Check, Box, AlertTriangle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { fetchAuditLog, fetchTopicId } from '@/app/actions';

interface AuditEvent {
  id: string;
  type: string;
  intentId: string;
  actor: string;
  txHash: string;
  hcsTopic: string;
  hcsSequence: string;
  time: string;
  badge: string;
}

const eventConfig: Record<string, { color: string; badgeColor: string }> = {
  EXECUTION_SUCCESS: { color: 'var(--brand-primary)', badgeColor: 'rgba(59, 130, 246, 0.2)' },
  POLICY_APPROVED: { color: 'var(--success)', badgeColor: 'rgba(16, 185, 129, 0.2)' },
  INTENT_CREATED: { color: 'var(--text-secondary)', badgeColor: 'rgba(255,255,255,0.05)' },
  POLICY_BLOCKED: { color: 'var(--danger)', badgeColor: 'rgba(239, 68, 68, 0.2)' },
  POLICY_ESCALATED: { color: 'var(--warning)', badgeColor: 'rgba(245, 158, 11, 0.2)' },
  APPROVAL_GRANTED: { color: 'var(--success)', badgeColor: 'rgba(16, 185, 129, 0.2)' },
  APPROVAL_REJECTED: { color: 'var(--danger)', badgeColor: 'rgba(239, 68, 68, 0.2)' },
  EXECUTION_FAILED: { color: 'var(--danger)', badgeColor: 'rgba(239, 68, 68, 0.2)' },
};

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'EXECUTION_SUCCESS': return <Box size={16} color={eventConfig[type]?.color} />;
    case 'POLICY_APPROVED':
    case 'APPROVAL_GRANTED': return <Check size={16} color={eventConfig[type]?.color} />;
    case 'INTENT_CREATED': return <Cpu size={16} color={eventConfig[type]?.color} />;
    case 'POLICY_BLOCKED':
    case 'EXECUTION_FAILED': return <ShieldAlert size={16} color={eventConfig[type]?.color} />;
    case 'POLICY_ESCALATED': return <AlertTriangle size={16} color={eventConfig[type]?.color} />;
    case 'APPROVAL_REJECTED': return <XCircle size={16} color={eventConfig[type]?.color} />;
    default: return <Activity size={16} color="var(--text-secondary)" />;
  }
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [topicId, setTopicId] = useState('—');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [log, topic] = await Promise.all([fetchAuditLog(), fetchTopicId()]);
    setEvents(log);
    setTopicId(topic);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = search
    ? events.filter(e =>
        e.intentId.toLowerCase().includes(search.toLowerCase()) ||
        e.actor.toLowerCase().includes(search.toLowerCase()) ||
        e.hcsSequence.includes(search) ||
        e.type.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Audit Evidence Stream</h1>
          <p className="text-sm">Hedera Consensus Service (HCS) verifiable logs for all agent evaluations and executions.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={loadData} className="glass-button secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '24px' }}>
            <Activity size={16} color="var(--brand-primary)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Topic: {topicId}</span>
            {topicId !== '—' && (
              <a 
                href={`https://hashscan.io/testnet/topic/${topicId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ display: 'inline-flex' }}
              >
                <ExternalLink size={12} color="var(--brand-primary)" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="glass-input" 
            placeholder="Search by Intent ID, Actor, Event Type, or HCS Sequence Number..." 
            style={{ paddingLeft: '48px', background: 'var(--bg-base)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="glass-button secondary" style={{ whiteSpace: 'nowrap' }}>
          {filtered.length} Events
        </span>
      </div>

      {events.length === 0 && !loading ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
          <Activity size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No Audit Events Yet</h3>
          <p className="text-sm">
            <a href="/intent/new" style={{ color: 'var(--brand-primary)' }}>Create a payment intent</a> to see audit events appear here.
          </p>
        </div>
      ) : (
        <div className="glass-panel animate-slide-up" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-glass-hover)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Event Time</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Event Type</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Intent Ref</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Trigger Actor</th>
                <th style={{ padding: '16px 24px', fontWeight: 500 }}>Hedera Tx / HCS Seq</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evt) => {
                const config = eventConfig[evt.type] || { color: 'var(--text-secondary)', badgeColor: 'rgba(255,255,255,0.05)' };
                return (
                  <tr key={evt.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 24px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {evt.time}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                          <EventIcon type={evt.type} />
                        </div>
                        <div className="flex-col">
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{evt.type}</span>
                          <span className="status-badge" style={{ background: config.badgeColor, color: config.color, padding: '2px 8px', fontSize: '0.65rem' }}>
                            {evt.badge}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--brand-primary)' }}>
                      {evt.intentId}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.875rem' }}>
                      {evt.actor}
                    </td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {evt.txHash !== "—" ? (
                        <div className="flex-col gap-2">
                          <span style={{ color: 'var(--success)' }}>{evt.txHash.substring(0, 30)}...</span>
                          {evt.hcsSequence !== '0' && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>HCS Seq #{evt.hcsSequence}</span>
                          )}
                        </div>
                      ) : (
                        <span>Logged to {evt.hcsTopic}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

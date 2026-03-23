"use client";

import { useState, useEffect, useTransition } from 'react';
import { ToggleRight, Link, Search, Check, Save, Loader2 } from 'lucide-react';
import { fetchPolicy, savePolicyConfig } from '@/app/actions';

export default function PolicyConsole() {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isPending, startTransition] = useTransition();
  const [autoMaxTx, setAutoMaxTx] = useState(1000);
  const [autoMaxDaily, setAutoMaxDaily] = useState(10000);
  const [blockMaxTx, setBlockMaxTx] = useState(10000);
  const [blockMaxDaily, setBlockMaxDaily] = useState(50000);
  const [whitelist, setWhitelist] = useState<{address: string; label: string}[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    fetchPolicy().then((p) => {
      setAutoMaxTx(p.autoApproveMaxTx);
      setAutoMaxDaily(p.autoApproveMaxDaily);
      setBlockMaxTx(p.blockMaxTx);
      setBlockMaxDaily(p.blockMaxDaily);
      setWhitelist(p.whitelist);
    });
  }, []);

  const handleSave = () => {
    setSaveState('saving');
    startTransition(async () => {
      await savePolicyConfig({
        autoApproveMaxTx: autoMaxTx,
        autoApproveMaxDaily: autoMaxDaily,
        blockMaxTx: blockMaxTx,
        blockMaxDaily: blockMaxDaily,
        whitelist,
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    });
  };

  const addAddress = () => {
    if (newAddress && newLabel) {
      setWhitelist([...whitelist, { address: newAddress, label: newLabel }]);
      setNewAddress('');
      setNewLabel('');
    }
  };

  const removeAddress = (address: string) => {
    setWhitelist(whitelist.filter(w => w.address !== address));
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Policy Console</h1>
          <p className="text-sm">Configure execution boundaries for autonomous agents on Hedera. All policy decisions are logged to HCS.</p>
        </div>
        <button className="glass-button" onClick={handleSave} style={{ width: '180px' }} disabled={isPending}>
          {saveState === 'saving' ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> :
           saveState === 'saved' ? <><Check size={18} /> Policy Saved</> :
           <><Save size={18} /> Save Policies</>}
        </button>
      </div>

      <div className="flex-col gap-6 animate-slide-up">
        {/* Card 1 */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div className="flex justify-between items-center mb-6">
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Auto-Approval Thresholds</h2>
            <ToggleRight size={28} color="var(--success)" />
          </div>
          <p className="text-sm mb-6">Automatically approve and execute agent intents that fall below these values via Hedera Scheduled Transactions.</p>
          
          <div className="flex-col gap-4">
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Maximum Transaction Size ($ USD)</label>
              <input type="number" className="glass-input" value={autoMaxTx} onChange={(e) => setAutoMaxTx(Number(e.target.value))} style={{ maxWidth: '200px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Maximum Daily Volume ($ USD)</label>
              <input type="number" className="glass-input" value={autoMaxDaily} onChange={(e) => setAutoMaxDaily(Number(e.target.value))} style={{ maxWidth: '200px' }} />
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div className="flex justify-between items-center mb-6">
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Hard Block Limits</h2>
            <ToggleRight size={28} color="var(--danger)" />
          </div>
          <p className="text-sm mb-6">Reject agent intents outright if they exceed these values. No human escalation — blocked before execution.</p>
          
          <div className="flex-col gap-4">
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Maximum Transaction Size ($ USD)</label>
              <input type="number" className="glass-input" value={blockMaxTx} onChange={(e) => setBlockMaxTx(Number(e.target.value))} style={{ maxWidth: '200px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Maximum Daily Volume ($ USD)</label>
              <input type="number" className="glass-input" value={blockMaxDaily} onChange={(e) => setBlockMaxDaily(Number(e.target.value))} style={{ maxWidth: '200px' }} />
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div className="flex justify-between items-center mb-6">
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Counterparty Whitelist</h2>
            <ToggleRight size={28} color="var(--brand-primary)" />
          </div>
          <p className="text-sm mb-6">Only allow auto-approval to these verified Hedera IDs. All others require escalation review.</p>
          
          <div className="flex gap-4 mb-4" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hedera Account ID</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="0.0.XXXXX" 
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Label</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="Wallet label" 
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <button onClick={addAddress} className="glass-button" style={{ padding: '12px 16px', height: '45px' }}>Add</button>
          </div>

          <div className="flex-col gap-2">
            {whitelist.map((entry) => (
              <div key={entry.address} className="flex justify-between items-center" style={{ padding: '16px', background: 'var(--bg-glass)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div className="flex gap-4 items-center">
                  <Link size={16} color="var(--text-secondary)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'monospace' }}>{entry.address}</span>
                  <span className="status-badge approved">{entry.label}</span>
                </div>
                <button 
                  onClick={() => removeAddress(entry.address)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', fontSize: '0.75rem' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Policy Summary */}
        <div className="glass-panel" style={{ padding: '24px', background: 'var(--bg-glass)', borderLeft: '3px solid var(--brand-primary)' }}>
          <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)', marginBottom: '12px' }}>Active Policy Summary</h3>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <div>Amount &le; <strong style={{ color: 'var(--success)' }}>${autoMaxTx.toLocaleString()}</strong> + whitelisted recipient = <span className="status-badge approved" style={{ verticalAlign: 'middle' }}>Auto-Approved</span></div>
            <div>Amount &gt; ${autoMaxTx.toLocaleString()} or unknown recipient = <span className="status-badge escalated" style={{ verticalAlign: 'middle' }}>Escalated</span></div>
            <div>Amount &gt; <strong style={{ color: 'var(--danger)' }}>${blockMaxTx.toLocaleString()}</strong> = <span className="status-badge blocked" style={{ verticalAlign: 'middle' }}>Blocked</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

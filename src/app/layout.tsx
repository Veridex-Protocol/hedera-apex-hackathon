import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Home, PlusCircle, ListTodo, Shield, History, Wallet } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Veridex Agent Firewall | Hedera',
  description: 'Production grade policy control layer for autonomous agents on Hedera.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="layout-grid">
          {/* Sidebar */}
          <aside className="sidebar glass-panel" style={{ borderRadius: '0', borderLeft: 'none', borderTop: 'none', borderBottom: 'none' }}>
            <div className="flex-col gap-2">
              <div className="flex items-center gap-2 mb-8" style={{ padding: '0 8px' }}>
                <Shield color="var(--brand-primary)" size={28} />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.03em' }}>
                  Veridex
                </span>
                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '4px', color: 'var(--brand-primary)', marginLeft: '4px', fontWeight: 600 }}>
                  v2.0
                </span>
              </div>
              
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px', padding: '0 16px' }}>
                Main Menu
              </div>
              
              <Link href="/">
                <div className="nav-item">
                  <Home size={18} />
                  <span>Dashboard</span>
                </div>
              </Link>
              
              <Link href="/intent/new">
                <div className="nav-item">
                  <PlusCircle size={18} />
                  <span>New Intent</span>
                </div>
              </Link>
              
              <Link href="/queue">
                <div className="nav-item">
                  <ListTodo size={18} />
                  <span>Approval Queue</span>
                </div>
              </Link>
              
              <Link href="/policy">
                <div className="nav-item">
                  <Shield size={18} />
                  <span>Policy Console</span>
                </div>
              </Link>
              
              <Link href="/audit">
                <div className="nav-item">
                  <History size={18} />
                  <span>Audit Evidence</span>
                </div>
              </Link>
            </div>
            
            <div style={{ marginTop: 'auto' }}>
              <div className="glass-panel" style={{ padding: '16px', background: 'var(--bg-glass)' }}>
                <div className="flex items-center gap-4">
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={16} color="var(--brand-primary)" />
                  </div>
                  <div className="flex-col">
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Treasury Team</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>0.0.3459114</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="main-content">
            <div className="container">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

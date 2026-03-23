"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bot,
  Brain,
  Zap,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Play,
  Loader2,
  Sparkles,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

interface Scenario {
  id: string;
  label: string;
  prompt: string;
}

interface Thought {
  step: number;
  type: string;
  content: string;
}

interface Proposal {
  recipientId: string;
  recipientLabel: string;
  amount: number;
  currency: string;
  purpose: string;
  urgency: string;
  reasoning: string;
}

interface ExecutionResult {
  intentId: string;
  recipientLabel: string;
  amount: number;
  decision: string;
  reason: string;
  hcsLogged: boolean;
  txId: string | null;
  scheduleId: string | null;
  agentReasoning: string;
}

interface AgentResponse {
  agent: { id: string; name: string; model: string; scenario: string };
  thoughts: Thought[];
  proposals: Proposal[];
  totalProposed: number;
  execution: {
    summary: { approved: number; escalated: number; blocked: number };
    results: ExecutionResult[];
  };
  message: string;
}

type Phase = "idle" | "thinking" | "proposing" | "executing" | "complete";

export default function AgentPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [agentInfo, setAgentInfo] = useState<AgentResponse["agent"] | null>(null);
  const [summary, setSummary] = useState<{ approved: number; escalated: number; blocked: number } | null>(null);
  const [totalProposed, setTotalProposed] = useState(0);
  const [visibleThoughts, setVisibleThoughts] = useState(0);
  const [visibleProposals, setVisibleProposals] = useState(0);
  const [visibleResults, setVisibleResults] = useState(0);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agent/run")
      .then((r) => r.json())
      .then((data) => {
        setScenarios(data.scenarios);
        if (data.scenarios.length > 0) setSelectedScenario(data.scenarios[0].id);
      });
  }, []);

  // Animate thoughts appearing one by one
  useEffect(() => {
    if (phase === "thinking" && visibleThoughts < thoughts.length) {
      const timer = setTimeout(() => setVisibleThoughts((v) => v + 1), 800);
      return () => clearTimeout(timer);
    }
    if (phase === "thinking" && visibleThoughts === thoughts.length && thoughts.length > 0) {
      setTimeout(() => setPhase("proposing"), 600);
    }
  }, [phase, visibleThoughts, thoughts.length]);

  // Animate proposals appearing
  useEffect(() => {
    if (phase === "proposing" && visibleProposals < proposals.length) {
      const timer = setTimeout(() => setVisibleProposals((v) => v + 1), 500);
      return () => clearTimeout(timer);
    }
    if (phase === "proposing" && visibleProposals === proposals.length && proposals.length > 0) {
      setTimeout(() => setPhase("executing"), 800);
    }
  }, [phase, visibleProposals, proposals.length]);

  // Animate results appearing
  useEffect(() => {
    if (phase === "executing" && visibleResults < results.length) {
      const timer = setTimeout(() => setVisibleResults((v) => v + 1), 400);
      return () => clearTimeout(timer);
    }
    if (phase === "executing" && visibleResults === results.length && results.length > 0) {
      setTimeout(() => setPhase("complete"), 500);
    }
  }, [phase, visibleResults, results.length]);

  // Auto-scroll
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleThoughts, visibleProposals, visibleResults, phase]);

  const runAgent = async () => {
    setPhase("thinking");
    setThoughts([]);
    setProposals([]);
    setResults([]);
    setAgentInfo(null);
    setSummary(null);
    setVisibleThoughts(0);
    setVisibleProposals(0);
    setVisibleResults(0);
    setTotalProposed(0);

    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: selectedScenario }),
    });
    const data: AgentResponse = await res.json();

    setAgentInfo(data.agent);
    setThoughts(data.thoughts);
    setProposals(data.proposals);
    setResults(data.execution.results);
    setSummary(data.execution.summary);
    setTotalProposed(data.totalProposed);
  };

  const formatAmount = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const urgencyColor: Record<string, string> = {
    low: "var(--text-muted)",
    medium: "var(--warning)",
    high: "var(--accent-cyan)",
    critical: "var(--danger)",
  };

  const decisionIcon = (d: string) => {
    if (d === "approved") return <ShieldCheck size={16} color="var(--success)" />;
    if (d === "escalated") return <AlertTriangle size={16} color="var(--warning)" />;
    return <XCircle size={16} color="var(--danger)" />;
  };

  const thoughtIcon = (type: string) => {
    if (type === "analysis") return <Brain size={16} color="var(--accent-cyan)" />;
    if (type === "reasoning") return <Sparkles size={16} color="var(--accent-purple)" />;
    return <Zap size={16} color="var(--success)" />;
  };

  const selectedScenarioData = scenarios.find((s) => s.id === selectedScenario);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, var(--brand-primary), var(--accent-purple))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={22} color="white" />
            </div>
            <h1 style={{ fontSize: "2.5rem" }}>AI Agent</h1>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "3px 8px",
                background: "rgba(139, 92, 246, 0.2)",
                borderRadius: "6px",
                color: "var(--accent-purple)",
                fontWeight: 600,
              }}
            >
              Gemini 2.0 Flash
            </span>
          </div>
          <p className="text-sm">
            Autonomous treasury agent. Analyzes business scenarios, reasons about payments, proposes intents — all governed by the policy engine.
          </p>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "12px" }}>
          Business Scenario
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedScenario(s.id)}
              className="glass-panel"
              style={{
                padding: "14px 16px",
                cursor: "pointer",
                border: selectedScenario === s.id ? "1px solid var(--brand-primary)" : "1px solid var(--border-color)",
                background: selectedScenario === s.id ? "rgba(59, 130, 246, 0.1)" : "var(--bg-glass)",
                textAlign: "left",
                borderRadius: "10px",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: selectedScenario === s.id ? "var(--brand-primary)" : "var(--text-primary)" }}>
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {selectedScenarioData && (
          <div style={{ padding: "12px 16px", background: "rgba(59, 130, 246, 0.05)", borderRadius: "8px", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px", borderLeft: "3px solid var(--brand-primary)" }}>
            <strong>Agent Prompt:</strong> {selectedScenarioData.prompt}
          </div>
        )}

        <button
          onClick={runAgent}
          disabled={phase !== "idle" && phase !== "complete"}
          className="glass-button"
          style={{
            padding: "12px 28px",
            fontSize: "0.95rem",
            fontWeight: 600,
            opacity: phase !== "idle" && phase !== "complete" ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {phase === "idle" || phase === "complete" ? (
            <>
              <Play size={18} /> Run AI Agent
            </>
          ) : (
            <>
              <Loader2 size={18} className="animate-spin" /> Agent Working...
            </>
          )}
        </button>
      </div>

      {/* Agent Output — Streaming-style display */}
      {phase !== "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Phase 1: Thinking */}
          <div className="glass-panel animate-slide-up" style={{ padding: "24px" }}>
            <div className="flex items-center gap-3 mb-4">
              <Brain size={20} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Agent Reasoning</h3>
              {phase === "thinking" && visibleThoughts < thoughts.length && (
                <Loader2 size={14} className="animate-spin" color="var(--accent-cyan)" />
              )}
              {agentInfo && (
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {agentInfo.model}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {thoughts.slice(0, visibleThoughts).map((t, i) => (
                <div
                  key={i}
                  className="animate-fade-in"
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "12px 16px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "8px",
                    borderLeft: `3px solid ${t.type === "analysis" ? "var(--accent-cyan)" : t.type === "reasoning" ? "var(--accent-purple)" : "var(--success)"}`,
                  }}
                >
                  <div style={{ paddingTop: "2px" }}>{thoughtIcon(t.type)}</div>
                  <div>
                    <div style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600, marginBottom: "4px" }}>
                      Step {t.step}: {t.type}
                    </div>
                    <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>{t.content}</div>
                  </div>
                </div>
              ))}
              {phase === "thinking" && visibleThoughts < thoughts.length && (
                <div className="flex items-center gap-2" style={{ padding: "8px 16px", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-cyan)", animation: "pulse-glow 1.5s infinite" }} />
                  Agent is thinking...
                </div>
              )}
            </div>
          </div>

          {/* Phase 2: Proposals */}
          {(phase === "proposing" || phase === "executing" || phase === "complete") && (
            <div className="glass-panel animate-slide-up" style={{ padding: "24px" }}>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles size={20} color="var(--accent-purple)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Payment Proposals</h3>
                <span style={{ marginLeft: "auto", fontSize: "0.875rem", fontWeight: 600, color: "var(--brand-primary)" }}>
                  {formatAmount(totalProposed)} total
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {proposals.slice(0, visibleProposals).map((p, i) => (
                  <div
                    key={i}
                    className="animate-fade-in glass-panel"
                    style={{ padding: "16px", background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot size={14} color="var(--brand-primary)" />
                        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{p.recipientLabel}</span>
                        <span style={{ fontSize: "0.7rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{p.recipientId}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          style={{
                            fontSize: "0.65rem",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            color: urgencyColor[p.urgency] || "var(--text-muted)",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: `${urgencyColor[p.urgency] || "var(--text-muted)"}15`,
                          }}
                        >
                          {p.urgency}
                        </span>
                        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatAmount(p.amount)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      <strong>Purpose:</strong> {p.purpose}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.5 }}>
                      <strong>AI Reasoning:</strong> {p.reasoning}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 3: Policy Execution Results */}
          {(phase === "executing" || phase === "complete") && (
            <div className="glass-panel animate-slide-up" style={{ padding: "24px" }}>
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck size={20} color="var(--success)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Policy Engine Results</h3>
                {phase === "executing" && visibleResults < results.length && (
                  <Loader2 size={14} className="animate-spin" color="var(--success)" />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {results.slice(0, visibleResults).map((r, i) => (
                  <div
                    key={i}
                    className="animate-fade-in"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: "8px",
                    }}
                  >
                    {decisionIcon(r.decision)}
                    <span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "var(--text-muted)", minWidth: "60px" }}>
                      {r.intentId}
                    </span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 500, flex: 1 }}>{r.recipientLabel}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{formatAmount(r.amount)}</span>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <span
                      className={`status-badge ${r.decision === "approved" ? "approved" : r.decision === "escalated" ? "escalated" : "blocked"}`}
                      style={{ minWidth: "80px", textAlign: "center" }}
                    >
                      {r.decision === "approved" ? "Auto-Approved" : r.decision === "escalated" ? "Escalated" : "Blocked"}
                    </span>
                    {r.hcsLogged && (
                      <span style={{ fontSize: "0.6rem", color: "var(--success)", fontWeight: 600 }}>HCS ✓</span>
                    )}
                    {r.scheduleId && (
                      <a
                        href={`https://hashscan.io/testnet/schedule/${r.scheduleId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 4: Summary */}
          {phase === "complete" && summary && (
            <div className="glass-panel animate-slide-up" style={{ padding: "24px", borderLeft: "3px solid var(--success)" }}>
              <div className="flex items-center gap-3 mb-3">
                <Zap size={20} color="var(--success)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Agent Run Complete</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                    Proposals
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{proposals.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--success)", textTransform: "uppercase", marginBottom: "4px" }}>
                    Auto-Approved
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success)" }}>{summary.approved}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--warning)", textTransform: "uppercase", marginBottom: "4px" }}>
                    Escalated
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--warning)" }}>{summary.escalated}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--danger)", textTransform: "uppercase", marginBottom: "4px" }}>
                    Blocked
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--danger)" }}>{summary.blocked}</div>
                </div>
              </div>
              <div style={{ marginTop: "16px", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {agentInfo?.name} analyzed &quot;{agentInfo?.scenario}&quot; and proposed {proposals.length} payments
                totaling {formatAmount(totalProposed)}. Escalated intents are now in the{" "}
                <a href="/queue" style={{ color: "var(--warning)", fontWeight: 600 }}>Approval Queue</a>.
                All decisions logged to the <a href="/audit" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Audit Feed</a>.
              </div>
            </div>
          )}

          <div ref={thoughtsEndRef} />
        </div>
      )}
    </div>
  );
}

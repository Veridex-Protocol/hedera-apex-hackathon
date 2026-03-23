import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Types ──────────────────────────────────────────────────────────────
export interface AgentPaymentProposal {
  recipientId: string;
  recipientLabel: string;
  amount: number;
  currency: string;
  purpose: string;
  urgency: "low" | "medium" | "high" | "critical";
  reasoning: string;
}

export interface AgentThought {
  step: number;
  type: "analysis" | "reasoning" | "decision" | "proposal" | "execution";
  content: string;
  timestamp: string;
}

export interface AgentRunResult {
  agentId: string;
  agentName: string;
  scenario: string;
  thoughts: AgentThought[];
  proposals: AgentPaymentProposal[];
  totalProposed: number;
  modelUsed: string;
}

// ── Known Counterparties (agent's "address book") ──────────────────────
const KNOWN_COUNTERPARTIES = [
  { id: "0.0.984210", label: "Operations Wallet", type: "internal" },
  { id: "0.0.457891", label: "SaaS Provider (Vercel)", type: "vendor" },
  { id: "0.0.112233", label: "AWS Infrastructure", type: "vendor" },
  { id: "0.0.556677", label: "Contractor: Alex M.", type: "contractor" },
  { id: "0.0.889900", label: "Marketing Agency", type: "vendor" },
  { id: "0.0.334455", label: "Security Audit Firm", type: "vendor" },
  { id: "0.0.778899", label: "Legal Retainer", type: "vendor" },
  { id: "0.0.999000", label: "DEX Liquidity Pool", type: "defi" },
  { id: "0.0.111929", label: "Unknown External Wallet", type: "unknown" },
];

// ── Business Scenarios ─────────────────────────────────────────────────
export const AGENT_SCENARIOS = [
  {
    id: "month-end-ops",
    label: "Month-End Operations",
    prompt:
      "You are the treasury operations AI agent for a crypto startup. It's the end of the month. Review pending obligations: cloud infrastructure bills, SaaS subscriptions, contractor milestones, and office expenses. Decide which payments to make, how much, and why. Be specific about amounts and prioritize by urgency.",
  },
  {
    id: "security-incident",
    label: "Security Incident Response",
    prompt:
      "You are the treasury operations AI agent. A critical security vulnerability has been discovered in the smart contract audit. The security firm needs emergency payment for a priority patch. The regular audit retainer is $5,000/month but emergency response costs $15,000. Additionally, you need to pay for an independent second audit ($8,000) and potentially reward the white-hat who found the bug ($2,500). Decide what to pay immediately vs. escalate for human approval.",
  },
  {
    id: "growth-sprint",
    label: "Growth Sprint Budget",
    prompt:
      "You are the treasury AI agent for a startup entering a growth sprint. The CEO approved a $25,000 monthly marketing budget. You need to allocate: paid ads, content creation, influencer partnerships, and developer relations. Some vendors are trusted (on whitelist), others are new. Decide the payment schedule, amounts, and flag anything that should be reviewed by a human.",
  },
  {
    id: "runway-conservation",
    label: "Runway Conservation Mode",
    prompt:
      "You are the treasury AI agent. The company has 4 months of runway left and needs to cut costs. Current monthly burn includes: $12,000 cloud infra, $3,500 SaaS tools, $8,000 contractor, $2,000 office. Leadership wants to reduce burn by 40%. Decide which payments to continue at full, reduce, or cut entirely. Justify each decision with impact analysis.",
  },
  {
    id: "contractor-payroll",
    label: "Contractor Payroll Cycle",
    prompt:
      "You are the treasury AI agent processing bi-weekly contractor payments. Three contractors are due: Alex M. ($4,200 - completed sprint milestone), Backend Dev ($3,800 - partial completion, 80%), and Design Contractor ($1,500 - deliverables approved). Process payments appropriately, adjusting for completion percentage where needed. Flag any concerns.",
  },
];

// ── Gemini Agent ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Veridex Agent — an autonomous AI treasury agent operating on the Hedera network.

Your role is to analyze business scenarios and propose specific payment transactions. 
You have access to the following counterparty address book:

${KNOWN_COUNTERPARTIES.map((c) => `- ${c.id} → ${c.label} (${c.type})`).join("\n")}

RULES:
1. Always use Hedera account IDs from the address book above for recipients.
2. Propose specific dollar amounts — never vague ranges.
3. Classify urgency: low (can wait), medium (this week), high (today), critical (immediate).
4. For amounts over $10,000 — always note this will likely be blocked by policy.
5. For amounts between $1,000-$10,000 — note this may require human approval.
6. For amounts under $1,000 to whitelisted addresses — note this will auto-approve.
7. Show your reasoning chain: what you analyzed, what you considered, why you chose each amount.

OUTPUT FORMAT — respond with valid JSON only, no markdown:
{
  "thoughts": [
    {"step": 1, "type": "analysis", "content": "...what you're analyzing..."},
    {"step": 2, "type": "reasoning", "content": "...your reasoning process..."},
    {"step": 3, "type": "decision", "content": "...what you decided and why..."}
  ],
  "proposals": [
    {
      "recipientId": "0.0.XXXXXX",
      "recipientLabel": "Label from address book",
      "amount": 1234.56,
      "currency": "USD",
      "purpose": "Specific purpose for this payment",
      "urgency": "low|medium|high|critical",
      "reasoning": "Why this specific amount and timing"
    }
  ]
}`;

export function isAgentConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function runAgent(
  scenarioId: string
): Promise<AgentRunResult> {
  const scenario = AGENT_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback: return a realistic hardcoded response so the demo works without a key
    return generateFallbackResult(scenario);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: scenario.prompt },
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text);

  const thoughts: AgentThought[] = (parsed.thoughts || []).map(
    (t: { step: number; type: string; content: string }, i: number) => ({
      step: t.step || i + 1,
      type: t.type || "reasoning",
      content: t.content,
      timestamp: new Date().toISOString(),
    })
  );

  const proposals: AgentPaymentProposal[] = (parsed.proposals || []).map(
    (p: AgentPaymentProposal) => ({
      recipientId: p.recipientId,
      recipientLabel: p.recipientLabel || "Unknown",
      amount: Number(p.amount),
      currency: p.currency || "USD",
      purpose: p.purpose,
      urgency: p.urgency || "medium",
      reasoning: p.reasoning,
    })
  );

  return {
    agentId: "veridex-agent-gemini",
    agentName: "Veridex_Agent_Gemini",
    scenario: scenario.label,
    thoughts,
    proposals,
    totalProposed: proposals.reduce((sum, p) => sum + p.amount, 0),
    modelUsed: "gemini-2.0-flash",
  };
}

// ── Fallback for demo without API key ──────────────────────────────────
function generateFallbackResult(scenario: {
  id: string;
  label: string;
}): AgentRunResult {
  const fallbacks: Record<string, { thoughts: AgentThought[]; proposals: AgentPaymentProposal[] }> = {
    "month-end-ops": {
      thoughts: [
        { step: 1, type: "analysis", content: "Reviewing end-of-month obligations. Current date suggests billing cycles for cloud infrastructure (AWS), SaaS subscriptions (Vercel), and contractor milestone payments are due.", timestamp: new Date().toISOString() },
        { step: 2, type: "reasoning", content: "Cloud infrastructure ($850) and SaaS ($457.91) are recurring, whitelisted vendors — these should auto-approve. Contractor payment ($4,200) exceeds $1K threshold and will need human review. Office supplies ($42.50) is trivial and whitelisted.", timestamp: new Date().toISOString() },
        { step: 3, type: "decision", content: "Proposing 4 payments totaling $5,550.41. Two will auto-approve (under $1K to whitelisted addresses), one will escalate for human review (contractor milestone over $1K), and one is a small auto-approve.", timestamp: new Date().toISOString() },
      ],
      proposals: [
        { recipientId: "0.0.112233", recipientLabel: "AWS Infrastructure", amount: 850, currency: "USD", purpose: "Monthly cloud infrastructure — EC2, RDS, S3 usage", urgency: "high", reasoning: "Recurring monthly bill. Under $1K and whitelisted vendor — will auto-approve. Late payment risks service disruption." },
        { recipientId: "0.0.457891", recipientLabel: "SaaS Provider (Vercel)", amount: 457.91, currency: "USD", purpose: "Monthly Vercel Pro subscription + bandwidth overage", urgency: "medium", reasoning: "Standard monthly SaaS bill. Whitelisted vendor, under threshold — auto-approve eligible." },
        { recipientId: "0.0.556677", recipientLabel: "Contractor: Alex M.", amount: 4200, currency: "USD", purpose: "Sprint 14 milestone completion — full stack feature delivery", urgency: "high", reasoning: "Contractor completed milestone deliverables. Amount exceeds $1K policy threshold — will require human approval. Recommend prompt review to maintain contractor relationship." },
        { recipientId: "0.0.984210", recipientLabel: "Operations Wallet", amount: 42.50, currency: "USD", purpose: "Office supply reimbursement — ergonomic keyboard", urgency: "low", reasoning: "Small reimbursement. Well under threshold, internal wallet — will auto-approve." },
      ],
    },
    "security-incident": {
      thoughts: [
        { step: 1, type: "analysis", content: "CRITICAL: Security vulnerability detected in smart contract. Multiple payments needed for incident response. Assessing urgency: emergency patch ($15K), independent audit ($8K), bug bounty reward ($2.5K).", timestamp: new Date().toISOString() },
        { step: 2, type: "reasoning", content: "The emergency security patch ($15,000) exceeds the $10K hard block — this WILL be blocked by policy. However, it's critical. I'll propose it knowing it will be blocked, and the operator must manually override. The bug bounty ($2,500) should escalate for human review. The second audit ($8,000) will also require escalation.", timestamp: new Date().toISOString() },
        { step: 3, type: "decision", content: "Proposing 3 payments totaling $25,500. The emergency patch will trigger a hard block (by design — high-value security payments SHOULD require manual authorization). Bug bounty and second audit will escalate to the approval queue. This is the policy engine working as intended for high-risk scenarios.", timestamp: new Date().toISOString() },
      ],
      proposals: [
        { recipientId: "0.0.334455", recipientLabel: "Security Audit Firm", amount: 15000, currency: "USD", purpose: "EMERGENCY: Priority security patch for critical smart contract vulnerability", urgency: "critical", reasoning: "Critical security response. Amount exceeds $10K hard block threshold — will be blocked by policy. This is correct behavior: emergency payments this large MUST have human authorization. Recommend immediate operator review." },
        { recipientId: "0.0.334455", recipientLabel: "Security Audit Firm", amount: 8000, currency: "USD", purpose: "Independent second audit of patched smart contract", urgency: "high", reasoning: "Follow-up verification audit. Between $1K-$10K — will escalate to approval queue. Important for due diligence but less urgent than the initial patch." },
        { recipientId: "0.0.984210", recipientLabel: "Operations Wallet", amount: 2500, currency: "USD", purpose: "White-hat bug bounty reward for vulnerability disclosure", urgency: "high", reasoning: "Bug bounty payment to incentivize responsible disclosure. $2.5K will escalate for human approval. Timely payment maintains trust with security researchers." },
      ],
    },
    "growth-sprint": {
      thoughts: [
        { step: 1, type: "analysis", content: "CEO approved $25K monthly marketing budget for growth sprint. Need to allocate across: paid advertising, content creation, influencer partnerships, and developer relations. Some vendors are established, others are new.", timestamp: new Date().toISOString() },
        { step: 2, type: "reasoning", content: "Marketing agency (whitelisted, $889900) can receive up to $1K auto-approved — but the full allocation will be $8K, requiring escalation. New influencer partnerships involve unknown wallets — these should escalate regardless. DevRel costs (event sponsorship, swag) are smaller and can be routed to operations wallet.", timestamp: new Date().toISOString() },
        { step: 3, type: "decision", content: "Proposing 4 payments totaling $22,500 of the $25K budget. Holding $2.5K in reserve. Largest payment ($8K marketing) will escalate. Keeping individual transactions under $10K to avoid hard blocks while still requiring human oversight for significant spend.", timestamp: new Date().toISOString() },
      ],
      proposals: [
        { recipientId: "0.0.889900", recipientLabel: "Marketing Agency", amount: 8000, currency: "USD", purpose: "Growth sprint — paid ads campaign (Google, Twitter, LinkedIn)", urgency: "high", reasoning: "Largest allocation. Marketing agency is a known vendor. $8K exceeds auto-approve threshold — will escalate for human approval. Campaign needs to launch this week for growth targets." },
        { recipientId: "0.0.889900", recipientLabel: "Marketing Agency", amount: 5000, currency: "USD", purpose: "Content creation package — blog posts, video content, social media assets", urgency: "medium", reasoning: "Content pipeline for the sprint. Same trusted vendor, separate deliverable. Will escalate for approval." },
        { recipientId: "0.0.111929", recipientLabel: "Unknown External Wallet", amount: 3500, currency: "USD", purpose: "Influencer partnership — crypto KOL campaign (3 posts)", urgency: "medium", reasoning: "New vendor, not on whitelist. Will escalate for human review. Recommend verifying wallet ownership before approval." },
        { recipientId: "0.0.984210", recipientLabel: "Operations Wallet", amount: 750, currency: "USD", purpose: "Developer relations — hackathon sponsorship materials and swag", urgency: "low", reasoning: "Small amount to internal wallet. Under $1K, whitelisted — will auto-approve. Low urgency, can process anytime this week." },
      ],
    },
    "runway-conservation": {
      thoughts: [
        { step: 1, type: "analysis", content: "Company has 4 months runway. Current monthly burn: $25,500 (cloud $12K, SaaS $3.5K, contractor $8K, office $2K). Target: reduce by 40% → new budget $15,300/month.", timestamp: new Date().toISOString() },
        { step: 2, type: "reasoning", content: "Cloud infra is the biggest line item. Can negotiate reserved instances or downscale non-prod environments — target $7,200 (40% cut). SaaS: audit for unused seats, downgrade tiers — target $2,100. Contractor: reduce scope to critical path only — target $4,800. Office: go fully remote, cut to $1,200.", timestamp: new Date().toISOString() },
        { step: 3, type: "decision", content: "Proposing reduced payments totaling $15,300. Each payment reflects the optimized amount. Cloud reduction requires infrastructure changes first — marking as lower urgency. Contractor conversation needed before reducing scope.", timestamp: new Date().toISOString() },
      ],
      proposals: [
        { recipientId: "0.0.112233", recipientLabel: "AWS Infrastructure", amount: 7200, currency: "USD", purpose: "Reduced cloud infrastructure — reserved instances + non-prod teardown", urgency: "high", reasoning: "Reduced from $12K to $7.2K (40% savings). Requires downscaling non-production environments. Will escalate for approval — infrastructure changes should be reviewed." },
        { recipientId: "0.0.556677", recipientLabel: "Contractor: Alex M.", amount: 4800, currency: "USD", purpose: "Reduced scope — critical path features only for runway extension", urgency: "medium", reasoning: "Reduced from $8K to $4.8K. Scope limited to revenue-critical features. Will escalate — requires conversation with contractor about revised deliverables." },
        { recipientId: "0.0.457891", recipientLabel: "SaaS Provider (Vercel)", amount: 850, currency: "USD", purpose: "Downgraded SaaS tier — removed unused seats, optimized plan", urgency: "medium", reasoning: "Reduced from $3.5K to $850. Audit revealed 6 unused seats and premium features not utilized. Under $1K, whitelisted — will auto-approve." },
        { recipientId: "0.0.984210", recipientLabel: "Operations Wallet", amount: 450, currency: "USD", purpose: "Minimal office expenses — remote-first transition", urgency: "low", reasoning: "Reduced from $2K to $450. Moving to fully remote eliminates most office costs. Under threshold, internal — will auto-approve." },
      ],
    },
    "contractor-payroll": {
      thoughts: [
        { step: 1, type: "analysis", content: "Processing bi-weekly contractor payroll. Three contractors due: Alex M. ($4,200 full completion), Backend Dev ($3,800 at 80% completion = $3,040 adjusted), Design Contractor ($1,500 approved deliverables).", timestamp: new Date().toISOString() },
        { step: 2, type: "reasoning", content: "Alex M. completed full milestone — pay in full ($4,200). Backend Dev at 80% — pay proportional ($3,040) and hold remainder until completion. Design deliverables approved — pay in full ($1,500). All exceed $1K, so all will escalate for human approval. This is appropriate for payroll.", timestamp: new Date().toISOString() },
        { step: 3, type: "decision", content: "Proposing 3 payments totaling $8,740. All will escalate to the approval queue since they exceed the $1K auto-approve threshold. Adjusted Backend Dev payment to reflect 80% completion — holding $760 until remaining deliverables are submitted.", timestamp: new Date().toISOString() },
      ],
      proposals: [
        { recipientId: "0.0.556677", recipientLabel: "Contractor: Alex M.", amount: 4200, currency: "USD", purpose: "Sprint 14 milestone — full completion. All deliverables accepted.", urgency: "high", reasoning: "Full milestone completed and verified. $4,200 will escalate for human approval. Prompt payment maintains contractor relationship and morale." },
        { recipientId: "0.0.112233", recipientLabel: "AWS Infrastructure", amount: 3040, currency: "USD", purpose: "Backend Dev — 80% milestone completion. Adjusted from $3,800 base.", urgency: "medium", reasoning: "Paying proportional to completion: $3,800 × 0.80 = $3,040. Remaining $760 held until final deliverables. Will escalate for approval." },
        { recipientId: "0.0.889900", recipientLabel: "Marketing Agency", amount: 1500, currency: "USD", purpose: "Design Contractor — approved deliverables (landing page + brand assets)", urgency: "medium", reasoning: "All deliverables reviewed and approved by design lead. $1,500 will escalate for human approval. Standard payment cycle." },
      ],
    },
  };

  const fb = fallbacks[scenario.id] || fallbacks["month-end-ops"];

  return {
    agentId: "veridex-agent-fallback",
    agentName: "Veridex_Agent_Gemini",
    scenario: scenario.label,
    thoughts: fb.thoughts,
    proposals: fb.proposals,
    totalProposed: fb.proposals.reduce((sum, p) => sum + p.amount, 0),
    modelUsed: "gemini-2.0-flash (fallback — set GEMINI_API_KEY for live)",
  };
}

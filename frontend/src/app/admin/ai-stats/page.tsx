"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface ModelBreakdown {
  model: string;
  count: number;
  cost: number;
}

interface ProviderBreakdown {
  provider: string;
  count: number;
  cost: number;
}

interface RecentLog {
  id: string;
  user_email: string;
  provider: string;
  model: string;
  tokens: number;
  cost: number;
  created_at: string;
}

interface AIStatsData {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost: number;
  model_breakdown: ModelBreakdown[];
  provider_breakdown: ProviderBreakdown[];
  recent_logs: RecentLog[];
}

const PROVIDER_COLORS: Record<string, string> = {
  voidai: "hsl(270 70% 60%)",
  openai: "hsl(142 71% 45%)",
  anthropic: "hsl(25 95% 55%)",
  gemini: "hsl(217 91% 60%)",
};

const PROVIDER_EMOJI: Record<string, string> = {
  voidai: "⚡",
  openai: "🤖",
  anthropic: "🧠",
  gemini: "✨",
};

function ProviderBar({ provider, count, cost, maxCount }: { provider: string; count: number; cost: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const color = PROVIDER_COLORS[provider.toLowerCase()] ?? "hsl(var(--accent))";
  const emoji = PROVIDER_EMOJI[provider.toLowerCase()] ?? "🔧";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
        <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))", display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {emoji} <span style={{ textTransform: "capitalize" }}>{provider}</span>
        </span>
        <span style={{ color: "hsl(var(--text-muted))", fontSize: "0.8rem" }}>
          {count.toLocaleString()} calls · ${cost.toFixed(4)}
        </span>
      </div>
      <div style={{ height: "8px", borderRadius: "999px", backgroundColor: "hsl(var(--bg-tertiary))", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: "999px",
          backgroundColor: color,
          transition: "width 0.6s ease",
          boxShadow: `0 0 8px ${color}55`,
        }} />
      </div>
    </div>
  );
}

export default function AdminAIStatsPage() {
  const [data, setData] = useState<AIStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/ai-stats");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load AI stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalTokens = data ? data.total_prompt_tokens + data.total_completion_tokens : 0;
  const maxProviderCount = data ? Math.max(...data.provider_breakdown.map(p => p.count), 1) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">

      {/* Header */}
      <div style={headerRowStyle}>
        <div>
          <h3 style={titleStyle}>🧠 AI Usage & Cost Monitor</h3>
          <p style={subStyle}>Real-time token consumption and API cost tracking across all AI providers</p>
        </div>
        <button onClick={load} className="btn btn-secondary" disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {error && <div style={errorStyle}>⚠️ {error}</div>}

      {loading ? (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          <span>Loading AI telemetry...</span>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div style={cardGridStyle}>
            <div className="glass-panel" style={cardStyle}>
              <div style={cardLabelStyle}>Total Tokens Used</div>
              <div style={{ ...cardValueStyle, color: "hsl(var(--accent))" }}>
                {totalTokens.toLocaleString()}
              </div>
              <div style={cardSubStyle}>
                📥 {data.total_prompt_tokens.toLocaleString()} prompt &nbsp;·&nbsp;
                📤 {data.total_completion_tokens.toLocaleString()} completion
              </div>
            </div>

            <div className="glass-panel" style={cardStyle}>
              <div style={cardLabelStyle}>Total API Cost</div>
              <div style={{ ...cardValueStyle, color: "hsl(38 92% 55%)" }}>
                ${data.total_cost.toFixed(4)}
              </div>
              <div style={cardSubStyle}>Across all providers & models</div>
            </div>

            <div className="glass-panel" style={cardStyle}>
              <div style={cardLabelStyle}>Total AI Calls</div>
              <div style={{ ...cardValueStyle, color: "hsl(142 71% 45%)" }}>
                {data.model_breakdown.reduce((s, m) => s + m.count, 0).toLocaleString()}
              </div>
              <div style={cardSubStyle}>{data.model_breakdown.length} model(s) in use</div>
            </div>

            <div className="glass-panel" style={cardStyle}>
              <div style={cardLabelStyle}>Avg Cost / Call</div>
              <div style={{ ...cardValueStyle, color: "hsl(270 70% 65%)" }}>
                ${data.model_breakdown.reduce((s, m) => s + m.count, 0) > 0
                  ? (data.total_cost / data.model_breakdown.reduce((s, m) => s + m.count, 0)).toFixed(5)
                  : "0.00000"}
              </div>
              <div style={cardSubStyle}>Per generation request</div>
            </div>
          </div>

          {/* Provider + Model breakdown */}
          <div style={twoColStyle}>

            {/* Provider breakdown */}
            <div className="glass-panel" style={panelStyle}>
              <h4 style={panelTitleStyle}>⚡ Provider Breakdown</h4>
              <p style={panelSubStyle}>Call volume and cost per AI provider</p>
              {data.provider_breakdown.length === 0 ? (
                <div style={noDataStyle}>No provider data yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
                  {data.provider_breakdown.map((p) => (
                    <ProviderBar
                      key={p.provider}
                      provider={p.provider}
                      count={p.count}
                      cost={p.cost}
                      maxCount={maxProviderCount}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Model breakdown */}
            <div className="glass-panel" style={panelStyle}>
              <h4 style={panelTitleStyle}>🔬 Model Breakdown</h4>
              <p style={panelSubStyle}>Per-model usage stats</p>
              {data.model_breakdown.length === 0 ? (
                <div style={noDataStyle}>No model data yet.</div>
              ) : (
                <div style={{ overflowX: "auto", marginTop: "1rem" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={thRowStyle}>
                        <th style={thStyle}>Model</th>
                        <th style={thStyle}>Calls</th>
                        <th style={thStyle}>Est. Cost</th>
                        <th style={thStyle}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.model_breakdown.map((m) => {
                        const totalCalls = data.model_breakdown.reduce((s, x) => s + x.count, 0);
                        const share = totalCalls > 0 ? ((m.count / totalCalls) * 100).toFixed(1) : "0";
                        return (
                          <tr key={m.model} style={trStyle}>
                            <td style={tdStyle}>
                              <code style={codeStyle}>{m.model}</code>
                            </td>
                            <td style={tdStyle}>{m.count.toLocaleString()}</td>
                            <td style={{ ...tdStyle, color: "hsl(38 92% 55%)", fontWeight: 600 }}>
                              ${m.cost.toFixed(4)}
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <div style={{ flex: 1, height: "5px", borderRadius: "999px", backgroundColor: "hsl(var(--bg-tertiary))" }}>
                                  <div style={{ width: `${share}%`, height: "100%", borderRadius: "999px", backgroundColor: "hsl(var(--accent))" }} />
                                </div>
                                <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", minWidth: "35px" }}>{share}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Recent AI calls log */}
          <div className="glass-panel" style={panelStyle}>
            <h4 style={panelTitleStyle}>📋 Recent AI Calls</h4>
            <p style={panelSubStyle}>Last 10 AI generation requests across all users</p>
            {data.recent_logs.length === 0 ? (
              <div style={noDataStyle}>No AI calls logged yet.</div>
            ) : (
              <div style={{ overflowX: "auto", marginTop: "1rem" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={thRowStyle}>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Provider</th>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>Tokens</th>
                      <th style={thStyle}>Cost</th>
                      <th style={thStyle}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_logs.map((log) => {
                      const color = PROVIDER_COLORS[log.provider.toLowerCase()] ?? "hsl(var(--accent))";
                      const emoji = PROVIDER_EMOJI[log.provider.toLowerCase()] ?? "🔧";
                      return (
                        <tr key={log.id} style={trStyle}>
                          <td style={tdStyle}>
                            <span style={{ color: "hsl(var(--text-primary))", fontWeight: 500 }}>{log.user_email}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: "0.3rem",
                              padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem",
                              fontWeight: 600, backgroundColor: `${color}20`, color, border: `1px solid ${color}33`,
                              textTransform: "capitalize",
                            }}>
                              {emoji} {log.provider}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <code style={codeStyle}>{log.model}</code>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 600, color: "hsl(var(--accent))" }}>
                              {log.tokens.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: "hsl(38 92% 55%)", fontWeight: 600 }}>
                            ${log.cost.toFixed(5)}
                          </td>
                          <td style={{ ...tdStyle, color: "hsl(var(--text-muted))", fontSize: "0.8rem" }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const headerRowStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem",
};
const titleStyle: React.CSSProperties = {
  fontSize: "1.25rem", color: "hsl(var(--text-primary))",
};
const subStyle: React.CSSProperties = {
  fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem",
};
const errorStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem", backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))",
  borderRadius: "12px", fontSize: "0.9rem",
};
const loadingStyle: React.CSSProperties = {
  padding: "4rem", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", gap: "1rem",
  color: "hsl(var(--text-secondary))",
};
const spinnerStyle: React.CSSProperties = {
  width: "30px", height: "30px",
  border: "2.5px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))", borderRadius: "50%",
  animation: "spin 1s linear infinite",
};
const cardGridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem",
};
const cardStyle: React.CSSProperties = {
  padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.35rem",
};
const cardLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem", fontWeight: 700, color: "hsl(var(--text-muted))",
  textTransform: "uppercase", letterSpacing: "0.07em",
};
const cardValueStyle: React.CSSProperties = {
  fontSize: "1.75rem", fontWeight: 700,
};
const cardSubStyle: React.CSSProperties = {
  fontSize: "0.75rem", color: "hsl(var(--text-muted))",
};
const twoColStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem",
};
const panelStyle: React.CSSProperties = {
  padding: "1.5rem 2rem",
};
const panelTitleStyle: React.CSSProperties = {
  fontSize: "1rem", color: "hsl(var(--text-primary))",
};
const panelSubStyle: React.CSSProperties = {
  fontSize: "0.8rem", color: "hsl(var(--text-muted))", marginTop: "0.2rem",
};
const noDataStyle: React.CSSProperties = {
  padding: "2rem", textAlign: "center", color: "hsl(var(--text-muted))", fontSize: "0.9rem",
};
const tableStyle: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", fontSize: "0.875rem",
};
const thRowStyle: React.CSSProperties = {
  borderBottom: "2px solid hsl(var(--border-color))",
};
const thStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: 600,
  color: "hsl(var(--text-muted))", textTransform: "uppercase",
  fontSize: "0.7rem", letterSpacing: "0.05em", whiteSpace: "nowrap",
};
const trStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
};
const tdStyle: React.CSSProperties = {
  padding: "0.8rem 0.75rem", color: "hsl(var(--text-secondary))", verticalAlign: "middle",
};
const codeStyle: React.CSSProperties = {
  fontFamily: "monospace", padding: "0.15rem 0.35rem",
  backgroundColor: "hsl(var(--bg-tertiary))", borderRadius: "4px",
  fontSize: "0.75rem", color: "hsl(var(--accent-cyan))",
};

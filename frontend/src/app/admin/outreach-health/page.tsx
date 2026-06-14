"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface SenderAccount {
  id: string;
  user_email: string;
  from_email: string;
  provider: string;
  health_score: number;
  warmup_enabled: boolean;
  warmup_status: string; // idle | warming | paused
  is_active: boolean;
  emails_sent_today: number;
  daily_limit: number;
  created_at: string;
}

interface OutreachHealthData {
  system_bounce_rate: number;
  system_open_rate: number;
  system_reply_rate: number;
  total_sent: number;
  total_bounced: number;
  total_opened: number;
  total_replied: number;
  senders: SenderAccount[];
}

function RateGauge({ label, value, dangerThreshold, warnThreshold, isHighBad = true }: {
  label: string; value: number; dangerThreshold: number; warnThreshold: number; isHighBad?: boolean;
}) {
  const isDanger = isHighBad ? value >= dangerThreshold : value <= dangerThreshold;
  const isWarn = isHighBad
    ? value >= warnThreshold && value < dangerThreshold
    : value > dangerThreshold && value <= warnThreshold;
  const color = isDanger
    ? "hsl(0 72% 51%)"
    : isWarn
    ? "hsl(38 92% 50%)"
    : "hsl(142 71% 45%)";

  const pct = Math.min(100, value);

  return (
    <div className="glass-panel" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </span>
        {isDanger && (
          <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: "hsl(0 72% 51% / 15%)", color: "hsl(0 72% 60%)", fontWeight: 700, border: "1px solid hsl(0 72% 51% / 25%)" }}>
            🚨 CRITICAL
          </span>
        )}
        {isWarn && (
          <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: "hsl(38 92% 50% / 15%)", color: "hsl(38 92% 55%)", fontWeight: 700, border: "1px solid hsl(38 92% 50% / 25%)" }}>
            ⚠️ WARNING
          </span>
        )}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color }}>{value.toFixed(1)}%</div>
      <div style={{ height: "6px", borderRadius: "999px", backgroundColor: "hsl(var(--bg-tertiary))", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "999px", backgroundColor: color, transition: "width 0.8s ease", boxShadow: `0 0 8px ${color}44` }} />
      </div>
    </div>
  );
}

function HealthScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? "hsl(142 71% 45%)"
    : score >= 50
    ? "hsl(38 92% 55%)"
    : "hsl(0 72% 60%)";
  const label = score >= 80 ? "Healthy" : score >= 50 ? "Fair" : "Poor";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{
        width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center",
        justifyContent: "center", fontWeight: 700, fontSize: "0.75rem",
        backgroundColor: `${color}20`, color, border: `2px solid ${color}44`,
      }}>
        {score}
      </div>
      <span style={{ fontSize: "0.75rem", color, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function WarmupBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    warming: { bg: "hsl(142 71% 45% / 15%)", color: "hsl(142 71% 45%)", label: "🔥 Warming" },
    paused:  { bg: "hsl(38 92% 50% / 15%)",  color: "hsl(38 92% 55%)",  label: "⏸️ Paused"  },
    idle:    { bg: "hsl(0 0% 60% / 12%)",    color: "hsl(0 0% 55%)",    label: "💤 Idle"    },
  };
  const s = map[status] ?? map["idle"];
  return (
    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 600, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  );
}

export default function OutreachHealthPage() {
  const [data, setData] = useState<OutreachHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/outreach-health");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load outreach health data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredSenders = data?.senders.filter(s =>
    providerFilter === "all" ? true : s.provider === providerFilter
  ) ?? [];

  const providers = [...new Set(data?.senders.map(s => s.provider) ?? [])];

  const criticalSenders = data?.senders.filter(s => s.health_score < 50) ?? [];
  const activeSenders   = data?.senders.filter(s => s.is_active) ?? [];
  const warmingSenders  = data?.senders.filter(s => s.warmup_status === "warming") ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>📊 Outreach Health Monitor</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
            System-wide email delivery stats & sender account health scores
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary" disabled={loading}>🔄 Refresh</button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1.5rem", backgroundColor: "hsl(var(--danger) / 10%)", border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))", borderRadius: "12px", fontSize: "0.9rem" }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "4rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", color: "hsl(var(--text-secondary))" }}>
          <div style={{ width: "30px", height: "30px", border: "2.5px solid hsl(var(--border-color))", borderTopColor: "hsl(var(--accent))", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span>Scanning outreach health...</span>
        </div>
      ) : data ? (
        <>
          {/* Critical alert */}
          {data.system_bounce_rate >= 10 && (
            <div style={{ padding: "1rem 1.5rem", backgroundColor: "hsl(0 72% 51% / 10%)", border: "1px solid hsl(0 72% 51% / 30%)", borderRadius: "12px", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.5rem" }}>🚨</span>
              <div>
                <div style={{ fontWeight: 700, color: "hsl(0 72% 60%)", fontSize: "0.95rem" }}>
                  Critical: System Bounce Rate is {data.system_bounce_rate.toFixed(1)}% — above 10% threshold!
                </div>
                <div style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", marginTop: "0.25rem" }}>
                  Gmail & Outlook may start flagging your accounts as spam. Immediately review and pause the low-health sender accounts below.
                </div>
              </div>
            </div>
          )}

          {/* Rate gauges */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <RateGauge label="🚫 Bounce Rate" value={data.system_bounce_rate} dangerThreshold={10} warnThreshold={5} isHighBad />
            <RateGauge label="📨 Open Rate"   value={data.system_open_rate}   dangerThreshold={10} warnThreshold={20} isHighBad={false} />
            <RateGauge label="💬 Reply Rate"  value={data.system_reply_rate}  dangerThreshold={1}  warnThreshold={3}  isHighBad={false} />
          </div>

          {/* Summary counters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
            {[
              { label: "Total Sent", value: data.total_sent, color: "hsl(var(--text-primary))" },
              { label: "Opened",     value: data.total_opened,  color: "hsl(142 71% 45%)" },
              { label: "Replied",    value: data.total_replied,  color: "hsl(217 91% 60%)" },
              { label: "Bounced",    value: data.total_bounced,  color: "hsl(0 72% 60%)" },
              { label: "Active Mailboxes",  value: activeSenders.length,  color: "hsl(142 71% 45%)" },
              { label: "Currently Warming", value: warmingSenders.length,  color: "hsl(38 92% 55%)" },
              { label: "Critical (< 50)",   value: criticalSenders.length, color: "hsl(0 72% 60%)" },
            ].map(card => (
              <div key={card.label} className="glass-panel" style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.07em" }}>{card.label}</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, color: card.color }}>{card.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Sender accounts table */}
          <div className="glass-panel" style={{ padding: "1.5rem 2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <h4 style={{ fontSize: "1rem", color: "hsl(var(--text-primary))" }}>📧 Sender Account Health</h4>
                <p style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))", marginTop: "0.2rem" }}>Sorted by health score (worst first) — investigate accounts below 50</p>
              </div>
              {providers.length > 1 && (
                <select
                  value={providerFilter}
                  onChange={e => setProviderFilter(e.target.value)}
                  className="input-field"
                  style={{ maxWidth: "180px" }}
                >
                  <option value="all">All Providers</option>
                  {providers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
            </div>

            {filteredSenders.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
                No sender accounts found.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid hsl(var(--border-color))" }}>
                      {["Health", "From Email", "Owner", "Provider", "Warmup", "Emails Today", "Status"].map(h => (
                        <th key={h} style={{ padding: "0.65rem 0.9rem", textAlign: "left", fontWeight: 600, color: "hsl(var(--text-muted))", textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSenders.map(sender => (
                      <tr key={sender.id} style={{
                        borderBottom: "1px solid hsl(var(--border-color))",
                        backgroundColor: sender.health_score < 50 ? "hsl(0 72% 51% / 4%)" : "transparent",
                      }}>
                        <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "middle" }}>
                          <HealthScoreBadge score={sender.health_score} />
                        </td>
                        <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                            <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>{sender.from_email}</span>
                          </div>
                        </td>
                        <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "middle", color: "hsl(var(--text-muted))", fontSize: "0.8rem" }}>
                          {sender.user_email}
                        </td>
                        <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "middle" }}>
                          <span style={{ textTransform: "capitalize", fontSize: "0.8rem", color: "hsl(var(--text-secondary))", fontWeight: 500 }}>
                            {sender.provider === "gmail" ? "📧 Gmail" : sender.provider === "brevo" ? "📨 Brevo" : sender.provider}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "middle" }}>
                          <WarmupBadge status={sender.warmup_status} />
                        </td>
                        <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ flex: 1, height: "5px", borderRadius: "999px", backgroundColor: "hsl(var(--bg-tertiary))", maxWidth: "70px" }}>
                              <div style={{
                                height: "100%", borderRadius: "999px",
                                backgroundColor: sender.emails_sent_today >= sender.daily_limit ? "hsl(0 72% 60%)" : "hsl(142 71% 45%)",
                                width: `${Math.min(100, (sender.emails_sent_today / Math.max(1, sender.daily_limit)) * 100)}%`,
                              }} />
                            </div>
                            <span style={{ fontSize: "0.78rem", color: "hsl(var(--text-secondary))", whiteSpace: "nowrap" }}>
                              {sender.emails_sent_today} / {sender.daily_limit}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "0.85rem 0.9rem", verticalAlign: "middle" }}>
                          <span style={{
                            padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 600,
                            backgroundColor: sender.is_active ? "hsl(142 71% 45% / 15%)" : "hsl(0 72% 51% / 15%)",
                            color: sender.is_active ? "hsl(142 71% 45%)" : "hsl(0 72% 60%)",
                            border: `1px solid ${sender.is_active ? "hsl(142 71% 45% / 25%)" : "hsl(0 72% 51% / 25%)"}`,
                          }}>
                            {sender.is_active ? "✅ Active" : "❌ Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
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

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface WarmupStats {
  account_id: string;
  from_email: string;
  warmup_enabled: boolean;
  warmup_status: "idle" | "warming" | "paused";
  health_score: number;
  reputation: string;
  days_warming: number;
  totals: {
    emails_sent: number;
    emails_received: number;
    replies_sent: number;
    inbox_moved: number;
    spam_found: number;
  };
}

interface WarmupDailyLog {
  id: string;
  date: string;
  emails_sent: number;
  emails_received: number;
  replies_sent: number;
  inbox_moved: number;
  spam_found: number;
  health_score: number;
}

export default function WarmupDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusData, setStatusData] = useState<WarmupStats | null>(null);
  const [logs, setLogs] = useState<WarmupDailyLog[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  const fetchWarmupData = async () => {
    try {
      const statusRes = await api.get(`/api/warmup/status/${accountId}`);
      setStatusData(statusRes);
      
      const logsRes = await api.get(`/api/warmup/logs/${accountId}`);
      setLogs(logsRes || []);
    } catch (err: any) {
      console.error("Error fetching warmup details:", err);
      setError(err.message || "Failed to load warm-up status.");
    }
  };

  useEffect(() => {
    if (user && accountId) {
      fetchWarmupData();
    }
  }, [user, accountId]);

  const handleStartWarmup = async () => {
    if (!statusData) return;
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/warmup/start/${accountId}`, {});
      await fetchWarmupData();
    } catch (err: any) {
      setError(err.message || "Failed to start warm-up.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseWarmup = async () => {
    if (!statusData) return;
    setActionLoading(true);
    setError("");
    try {
      await api.post(`/api/warmup/pause/${accountId}`, {});
      await fetchWarmupData();
    } catch (err: any) {
      setError(err.message || "Failed to pause warm-up.");
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to get health score color class
  const getHealthColor = (score: number) => {
    if (score >= 80) return "rgb(16, 185, 129)"; // Green
    if (score >= 50) return "rgb(245, 158, 11)"; // Yellow/Orange
    return "rgb(239, 68, 68)"; // Red
  };

  // Render SVG Chart for Health Score trend
  const renderHealthChart = () => {
    if (logs.length < 2) {
      return (
        <div style={emptyChartStyle}>
          📈 Health Score trend chart will appear once warm-up logs are recorded.
        </div>
      );
    }

    const chartWidth = 500;
    const chartHeight = 150;
    const padding = 20;
    const dataWidth = chartWidth - padding * 2;
    const dataHeight = chartHeight - padding * 2;

    const maxVal = 100;
    const minVal = 0;

    const points = logs.map((log, idx) => {
      const x = padding + (idx / (logs.length - 1)) * dataWidth;
      const y = padding + dataHeight - ((log.health_score - minVal) / (maxVal - minVal)) * dataHeight;
      return `${x},${y}`;
    }).join(" ");

    return (
      <svg width="100%" height="180" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: "visible" }}>
        {/* Background Grid Lines */}
        <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="var(--glass-border)" strokeDasharray="3" />
        <line x1={padding} y1={padding + dataHeight / 2} x2={chartWidth - padding} y2={padding + dataHeight / 2} stroke="var(--glass-border)" strokeDasharray="3" />
        <line x1={padding} y1={padding + dataHeight} x2={chartWidth - padding} y2={padding + dataHeight} stroke="var(--glass-border)" />

        {/* Line graph path */}
        <polyline
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          points={points}
        />

        {/* Data points */}
        {logs.map((log, idx) => {
          const x = padding + (idx / (logs.length - 1)) * dataWidth;
          const y = padding + dataHeight - ((log.health_score - minVal) / (maxVal - minVal)) * dataHeight;
          return (
            <g key={log.id} style={{ cursor: "pointer" }}>
              <circle
                cx={x}
                cy={y}
                r="4"
                fill="hsl(var(--accent-cyan))"
                stroke="hsl(var(--accent))"
                strokeWidth="1.5"
              />
              <title>{`Date: ${log.date}\nHealth Score: ${log.health_score}%`}</title>
            </g>
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading warm-up workspace...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="content-pane animate-fade-in" style={containerStyle}>
          
          {/* Header & Status Bar */}
          <div style={headerRowStyle}>
            <div style={backBtnColStyle}>
              <button onClick={() => router.push("/email-accounts")} style={backBtnStyle}>
                ← Back to Setup
              </button>
              <h2 style={titleStyle}>{statusData?.from_email}</h2>
            </div>
            
            {statusData && (
              <div style={statusControlsStyle}>
                <div style={badgeWrapperStyle}>
                  Status:{" "}
                  {statusData.warmup_status === "warming" ? (
                    <span className="badge" style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", color: "rgb(16, 185, 129)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                      🟢 Warming up (Day {statusData.days_warming})
                    </span>
                  ) : statusData.warmup_status === "paused" ? (
                    <span className="badge badge-warning">⏸️ Paused</span>
                  ) : (
                    <span className="badge badge-secondary">Idle</span>
                  )}
                </div>
                
                {statusData.warmup_status === "warming" ? (
                  <button 
                    onClick={handlePauseWarmup} 
                    className="btn btn-secondary"
                    disabled={actionLoading}
                    style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem" }}
                  >
                    {actionLoading ? "Pausing..." : "⏸ Pause Warm-up"}
                  </button>
                ) : (
                  <button 
                    onClick={handleStartWarmup} 
                    className="btn btn-primary"
                    disabled={actionLoading}
                    style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem" }}
                  >
                    {actionLoading ? "Starting..." : "🔥 Start Warm-up"}
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div style={errorBannerStyle}>
              ⚠️ {error}
            </div>
          )}

          {/* Warmup Status Cards Grid */}
          {statusData && (
            <>
              {/* Progress & Target Section */}
              <div className="glass-panel" style={progressCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={progressLabelStyle}>30-Day Warm-up Campaign Progress</span>
                  <span style={progressPercentStyle}>{Math.min(100, Math.round((statusData.days_warming / 30) * 100))}% Complete</span>
                </div>
                <div style={progressBarBgStyle}>
                  <div style={{
                    ...progressBarFillStyle,
                    width: `${Math.min(100, (statusData.days_warming / 30) * 100)}%`
                  }} />
                </div>
                <p style={progressSubtextStyle}>
                  {statusData.warmup_status === "warming" 
                    ? `Currently on day ${statusData.days_warming} of 30. Sending limit automatically ramps up daily to build sender reputation.`
                    : "Warm-up is paused. Start the engine to resume progress towards standard limits."}
                </p>
              </div>

              {/* Metrics Grid */}
              <div style={metricsGridStyle}>
                {/* Health Score Card */}
                <div className="glass-panel" style={metricCardStyle}>
                  <span style={cardLabelStyle}>Health Score</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                    <span style={{ ...cardValueStyle, color: getHealthColor(statusData.health_score) }}>
                      {statusData.health_score}
                    </span>
                    <span style={cardValueUnitStyle}>/100</span>
                  </div>
                  <div style={cardFooterStyle}>
                    Sender reputation is <strong>{statusData.reputation}</strong>
                  </div>
                </div>

                {/* Sent Count */}
                <div className="glass-panel" style={metricCardStyle}>
                  <span style={cardLabelStyle}>Warm-up Sent</span>
                  <span style={cardValueStyle}>{statusData.totals.emails_sent}</span>
                  <div style={cardFooterStyle}>Total outbound warm-up pings</div>
                </div>

                {/* Received Count */}
                <div className="glass-panel" style={metricCardStyle}>
                  <span style={cardLabelStyle}>Warm-up Received</span>
                  <span style={cardValueStyle}>{statusData.totals.emails_received}</span>
                  <div style={cardFooterStyle}>Total incoming pool emails</div>
                </div>

                {/* Deliverability Card */}
                <div className="glass-panel" style={metricCardStyle}>
                  <span style={cardLabelStyle}>Inbox Deliverability</span>
                  <span style={cardValueStyle}>
                    {statusData.totals.inbox_moved + statusData.totals.spam_found > 0 
                      ? `${Math.round((statusData.totals.inbox_moved / (statusData.totals.inbox_moved + statusData.totals.spam_found)) * 100)}%`
                      : "100%"}
                  </span>
                  <div style={cardFooterStyle}>
                    {statusData.totals.spam_found} emails flagged in spam
                  </div>
                </div>
              </div>

              {/* Charts & Graphs Section */}
              <div style={chartsRowStyle}>
                <div className="glass-panel" style={chartCardStyle}>
                  <h3 style={panelTitleStyle}>Health Score Progression</h3>
                  <div style={{ marginTop: "1.5rem" }}>
                    {renderHealthChart()}
                  </div>
                </div>

                <div className="glass-panel" style={dailySummaryCardStyle}>
                  <h3 style={panelTitleStyle}>Pool Activity (All-time)</h3>
                  <div style={activityStatsListStyle}>
                    <div style={activityStatItemStyle}>
                      <span>📬 Total Inbox Moved</span>
                      <strong>{statusData.totals.inbox_moved}</strong>
                    </div>
                    <div style={activityStatItemStyle}>
                      <span>🗑️ Total Spam Found</span>
                      <strong style={{ color: "rgb(239, 68, 68)" }}>{statusData.totals.spam_found}</strong>
                    </div>
                    <div style={activityStatItemStyle}>
                      <span>↩️ Total Replies Exchanged</span>
                      <strong>{statusData.totals.replies_sent}</strong>
                    </div>
                    <div style={activityStatItemStyle}>
                      <span>📊 Target Reply Rate</span>
                      <strong>
                        {statusData.days_warming <= 3 ? "80%" :
                         statusData.days_warming <= 7 ? "75%" :
                         statusData.days_warming <= 14 ? "70%" : "60%"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <div className="glass-panel" style={tablePanelStyle}>
                <h3 style={{ ...panelTitleStyle, marginBottom: "1.25rem" }}>Daily Warm-up Logs History</h3>
                
                {logs.length > 0 ? (
                  <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={tableHeaderRowStyle}>
                          <th style={thStyle}>Date</th>
                          <th style={thStyle}>Sent</th>
                          <th style={thStyle}>Received</th>
                          <th style={thStyle}>Replies</th>
                          <th style={thStyle}>Inbox Moved</th>
                          <th style={thStyle}>Spam Found</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Health Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} style={tableRowStyle}>
                            <td style={{ ...tdStyle, fontWeight: 500, color: "hsl(var(--text-primary))" }}>
                              {log.date}
                            </td>
                            <td style={tdStyle}>{log.emails_sent}</td>
                            <td style={tdStyle}>{log.emails_received}</td>
                            <td style={tdStyle}>{log.replies_sent}</td>
                            <td style={tdStyle} className="text-success">{log.inbox_moved}</td>
                            <td style={{ ...tdStyle, color: log.spam_found > 0 ? "rgb(239, 68, 68)" : "inherit" }}>
                              {log.spam_found}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: getHealthColor(log.health_score) }}>
                              {log.health_score}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={emptyLogsStyle}>
                    No daily warm-up logs recorded yet. The background scheduler runs nightly, or you can trigger a manual simulation in the Admin tools.
                  </div>
                )}
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
}

// Inline Styles
const loadingContainerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
};

const spinnerStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "3px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2rem",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1.5rem",
};

const backBtnColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const backBtnStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "none",
  color: "hsl(var(--text-secondary))",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 500,
  textAlign: "left",
  width: "fit-content",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 700,
};

const statusControlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1.5rem",
};

const badgeWrapperStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const progressCardStyle: React.CSSProperties = {
  padding: "1.75rem 2rem",
};

const progressLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  fontWeight: 500,
};

const progressPercentStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--accent))",
  fontWeight: 600,
};

const progressBarBgStyle: React.CSSProperties = {
  width: "100%",
  height: "8px",
  backgroundColor: "hsl(var(--bg-tertiary))",
  borderRadius: "4px",
  overflow: "hidden",
  marginBottom: "0.75rem",
};

const progressBarFillStyle: React.CSSProperties = {
  height: "100%",
  backgroundColor: "hsl(var(--accent))",
  backgroundImage: "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent-secondary)))",
  borderRadius: "4px",
};

const progressSubtextStyle: React.CSSProperties = {
  fontSize: "0.825rem",
  color: "hsl(var(--text-muted))",
  lineHeight: "1.4",
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1.5rem",
};

const metricCardStyle: React.CSSProperties = {
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
};

const cardValueStyle: React.CSSProperties = {
  fontSize: "2.25rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
  fontFamily: "var(--font-family-heading)",
};

const cardValueUnitStyle: React.CSSProperties = {
  fontSize: "1rem",
  color: "hsl(var(--text-muted))",
};

const cardFooterStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
  marginTop: "auto",
};

const chartsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: "1.5rem",
  alignItems: "stretch",
  flexWrap: "wrap",
};

const chartCardStyle: React.CSSProperties = {
  padding: "2rem",
};

const dailySummaryCardStyle: React.CSSProperties = {
  padding: "2rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
};

const emptyChartStyle: React.CSSProperties = {
  height: "150px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.85rem",
  textAlign: "center",
  border: "1.5px dashed hsl(var(--border-color))",
  borderRadius: "12px",
  padding: "2rem",
};

const activityStatsListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  marginTop: "1.5rem",
};

const activityStatItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: "0.75rem",
  borderBottom: "1px solid var(--glass-border)",
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
};

const tablePanelStyle: React.CSSProperties = {
  padding: "2rem",
};

const tableContainerStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
};

const tableHeaderRowStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
};

const thStyle: React.CSSProperties = {
  padding: "0.85rem 1rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.875rem",
  color: "hsl(var(--text-secondary))",
};

const emptyLogsStyle: React.CSSProperties = {
  padding: "3rem 2rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.9rem",
  lineHeight: "1.5",
};

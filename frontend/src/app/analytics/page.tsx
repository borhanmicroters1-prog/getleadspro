"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface SummaryStats {
  emails_sent: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
  unsubscribe_rate: number;
  best_campaign: string;
  best_send_time: string;
}

interface SourceBreakdown {
  source: string;
  sent: number;
  replied: number;
  open_rate: number;
  reply_rate: number;
}

interface HourlyDistribution {
  hour: string;
  replies: number;
}

interface TrendDay {
  date: string;
  sent: number;
  replied: number;
}

interface AnalyticsData {
  is_mock: boolean;
  summary: SummaryStats;
  source_breakdown: SourceBreakdown[];
  hourly_distribution: HourlyDistribution[];
  trend_30_days: TrendDay[];
}

interface CampaignItem {
  id: string;
  name: string;
  status: string;
  total_leads: number;
  sent: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  const fetchAnalytics = async () => {
    try {
      const data = await api.get("/api/analytics");
      setAnalytics(data);
      
      const campsRes = await api.get("/api/campaigns");
      setCampaigns(campsRes || []);
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      setError(err.message || "Failed to load account analytics.");
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  // Render SVG Chart for 30-Day Trend
  const renderTrendChart = () => {
    if (!analytics || analytics.trend_30_days.length === 0) return null;

    const data = analytics.trend_30_days;
    const chartWidth = 600;
    const chartHeight = 200;
    const padding = 30;
    
    const dataWidth = chartWidth - padding * 2;
    const dataHeight = chartHeight - padding * 2;

    const maxSent = Math.max(...data.map(d => d.sent), 10);
    
    // Generate line points
    const sentPoints = data.map((d, idx) => {
      const x = padding + (idx / (data.length - 1)) * dataWidth;
      const y = padding + dataHeight - (d.sent / maxSent) * dataHeight;
      return `${x},${y}`;
    }).join(" ");

    const repliedPoints = data.map((d, idx) => {
      const x = padding + (idx / (data.length - 1)) * dataWidth;
      const y = padding + dataHeight - ((d.replied * 5) / maxSent) * dataHeight; // scaled up for visibility
      return `${x},${y}`;
    }).join(" ");

    return (
      <svg width="100%" height="220" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: "visible" }}>
        {/* Grids */}
        <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="var(--glass-border)" />
        <line x1={padding} y1={padding + dataHeight / 2} x2={chartWidth - padding} y2={padding + dataHeight / 2} stroke="var(--glass-border)" />
        <line x1={padding} y1={padding + dataHeight} x2={chartWidth - padding} y2={padding + dataHeight} stroke="var(--glass-border)" />

        {/* X Axis Labels (every 5 days) */}
        {data.map((d, idx) => {
          if (idx % 5 !== 0 && idx !== data.length - 1) return null;
          const x = padding + (idx / (data.length - 1)) * dataWidth;
          return (
            <text key={idx} x={x} y={chartHeight - 5} fill="hsl(var(--text-muted))" fontSize="9" textAnchor="middle">
              {d.date}
            </text>
          );
        })}

        {/* Sent Line */}
        <polyline fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" points={sentPoints} />
        
        {/* Replied Line */}
        <polyline fill="none" stroke="hsl(var(--accent-cyan))" strokeWidth="2" points={repliedPoints} />

        {/* Circles on Hover */}
        {data.map((d, idx) => {
          if (d.sent === 0) return null;
          const x = padding + (idx / (data.length - 1)) * dataWidth;
          const ySent = padding + dataHeight - (d.sent / maxSent) * dataHeight;
          return (
            <g key={idx} style={{ cursor: "pointer" }}>
              <circle cx={x} cy={ySent} r="3" fill="hsl(var(--accent))" />
              <title>{`Date: ${d.date}\nSent: ${d.sent}\nReplies: ${d.replied}`}</title>
            </g>
          );
        })}
      </svg>
    );
  };

  // Render SVG Chart for Hourly Success Rate
  const renderHourlyChart = () => {
    if (!analytics || analytics.hourly_distribution.length === 0) return null;

    const data = analytics.hourly_distribution;
    const chartWidth = 500;
    const chartHeight = 180;
    const padding = 25;
    const dataWidth = chartWidth - padding * 2;
    const dataHeight = chartHeight - padding * 2;

    const maxReplies = Math.max(...data.map(d => d.replies), 5);

    return (
      <svg width="100%" height="200" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: "visible" }}>
        {data.map((d, idx) => {
          const barWidth = (dataWidth / data.length) * 0.7;
          const x = padding + (idx / data.length) * dataWidth + (dataWidth / data.length) * 0.15;
          const barHeight = (d.replies / maxReplies) * dataHeight;
          const y = padding + dataHeight - barHeight;

          return (
            <g key={idx}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="3"
                fill="linear-gradient(to top, hsl(var(--accent)), hsl(var(--accent-cyan)))"
                style={{ fill: "hsl(var(--accent))", opacity: 0.8 }}
              />
              {/* Value label */}
              {d.replies > 0 && (
                <text x={x + barWidth / 2} y={y - 5} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">
                  {d.replies}
                </text>
              )}
              {/* X Axis Label */}
              <text x={x + barWidth / 2} y={chartHeight - 5} fill="hsl(var(--text-muted))" fontSize="8" textAnchor="middle">
                {d.hour.split(":")[0]}
              </text>
            </g>
          );
        })}
        <line x1={padding} y1={padding + dataHeight} x2={chartWidth - padding} y2={padding + dataHeight} stroke="var(--glass-border)" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading overall analytics...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Header */}
          <div style={headerStyle}>
            <div>
              <h2 style={titleStyle}>Outreach Analytics</h2>
              <p style={subtitleStyle}>Aggregate campaign conversions and mailbox sending reputations.</p>
            </div>
            {analytics?.is_mock && (
              <span className="badge" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "rgb(129, 140, 248)", border: "1px solid rgba(99, 102, 241, 0.2)", padding: "0.5rem 1rem", fontSize: "0.8rem" }}>
                💡 Preview Mode: Showing simulated data
              </span>
            )}
          </div>

          {error && (
            <div style={errorBannerStyle}>
              ⚠️ {error}
            </div>
          )}

          {/* Aggregate Overview Cards */}
          {analytics && (
            <>
              <div style={statsGridStyle}>
                <div className="glass-panel" style={statCardStyle}>
                  <span style={statLabelStyle}>Total Outbound Sent</span>
                  <span style={statValueStyle}>{analytics.summary.emails_sent}</span>
                  <p style={statSubtextStyle}>All-time campaign emails delivered</p>
                </div>

                <div className="glass-panel" style={statCardStyle}>
                  <span style={statLabelStyle}>Avg Open Rate</span>
                  <span style={{ ...statValueStyle, color: "hsl(var(--accent-cyan))" }}>
                    {analytics.summary.open_rate}%
                  </span>
                  <p style={statSubtextStyle}>Percentage of emails opened</p>
                </div>

                <div className="glass-panel" style={statCardStyle}>
                  <span style={statLabelStyle}>Avg Reply Rate</span>
                  <span style={{ ...statValueStyle, color: "hsl(var(--success))" }}>
                    {analytics.summary.reply_rate}%
                  </span>
                  <p style={statSubtextStyle}>Total converted responses</p>
                </div>

                <div className="glass-panel" style={statCardStyle}>
                  <span style={statLabelStyle}>Deliverability Health</span>
                  <span style={{ ...statValueStyle, color: analytics.summary.bounce_rate < 10 ? "rgb(16, 185, 129)" : "rgb(239, 68, 68)" }}>
                    {100 - analytics.summary.bounce_rate}%
                  </span>
                  <p style={statSubtextStyle}>{analytics.summary.bounce_rate}% average bounce rate</p>
                </div>
              </div>

              {/* Best Performers Row */}
              <div style={performersRowStyle}>
                <div className="glass-panel" style={performerCardStyle}>
                  <div style={performerHeaderStyle}>
                    <span style={performerLabelStyle}>Best Performing Campaign</span>
                    <span style={performerIconStyle}>🏆</span>
                  </div>
                  <span style={performerValueStyle}>{analytics.summary.best_campaign}</span>
                  <p style={performerDescStyle}>Based on highest response conversion rate</p>
                </div>

                <div className="glass-panel" style={performerCardStyle}>
                  <div style={performerHeaderStyle}>
                    <span style={performerLabelStyle}>Optimal Send Time</span>
                    <span style={performerIconStyle}>⏰</span>
                  </div>
                  <span style={performerValueStyle}>{analytics.summary.best_send_time}</span>
                  <p style={performerDescStyle}>Hour of day yielding the most replies</p>
                </div>
              </div>

              {/* Charts Grid */}
              <div style={chartsGridStyle}>
                {/* 30 Day Trend */}
                <div className="glass-panel" style={chartCardStyle}>
                  <div style={chartHeaderStyle}>
                    <h3 style={chartTitleStyle}>Outreach Trends (Last 30 Days)</h3>
                    <div style={chartLegendStyle}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "11px", color: "hsl(var(--text-secondary))" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "hsl(var(--accent))" }} />
                        Sent
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "11px", color: "hsl(var(--text-secondary))" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "hsl(var(--accent-cyan))" }} />
                        Replies
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: "1.5rem" }}>
                    {renderTrendChart()}
                  </div>
                </div>

                {/* Hourly Replies */}
                <div className="glass-panel" style={chartCardStyle}>
                  <h3 style={chartTitleStyle}>Replies by Hour of Day</h3>
                  <div style={{ marginTop: "1.5rem" }}>
                    {renderHourlyChart()}
                  </div>
                </div>
              </div>

              {/* Source Breakdowns */}
              <div className="glass-panel" style={sectionCardStyle}>
                <h3 style={sectionTitleStyle}>Outreach Performance by Lead Source</h3>
                <div style={sourceCardsGridStyle}>
                  {analytics.source_breakdown.map((src) => {
                    const sourceLabel = src.source === "google_maps" ? "Google Maps Scraper" :
                                        src.source === "facebook_ads" ? "FB Ads Scraper" : "CSV Uploads";
                    const sourceEmoji = src.source === "google_maps" ? "📍" :
                                        src.source === "facebook_ads" ? "📢" : "📁";
                    return (
                      <div key={src.source} style={sourceItemCardStyle} className="glass-panel">
                        <div style={sourceHeaderStyle}>
                          <span style={sourceIconStyle}>{sourceEmoji}</span>
                          <span style={sourceLabelStyle}>{sourceLabel}</span>
                        </div>
                        <div style={sourceStatsRowStyle}>
                          <div style={sourceStatColStyle}>
                            <span>Sent</span>
                            <strong>{src.sent}</strong>
                          </div>
                          <div style={sourceStatColStyle}>
                            <span>Open Rate</span>
                            <strong>{src.open_rate}%</strong>
                          </div>
                          <div style={sourceStatColStyle}>
                            <span>Reply Rate</span>
                            <strong style={{ color: "hsl(var(--success))" }}>{src.reply_rate}%</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Campaign Performance Leaderboard */}
          <div className="glass-panel" style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>Campaign Performance Leaderboard</h3>
            
            {campaigns.length > 0 ? (
              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={tableHeaderRowStyle}>
                      <th style={thStyle}>Campaign Name</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Total Leads</th>
                      <th style={thStyle}>Delivered</th>
                      <th style={thStyle}>Open Rate</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Reply Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns
                      .sort((a, b) => b.reply_rate - a.reply_rate) // Sort by best reply rate
                      .map((camp) => (
                        <tr key={camp.id} style={tableRowStyle}>
                          <td 
                            style={{ ...tdStyle, fontWeight: 600, color: "hsl(var(--text-primary))", cursor: "pointer" }}
                            onClick={() => router.push(`/campaigns/${camp.id}`)}
                          >
                            {camp.name}
                          </td>
                          <td style={tdStyle}>
                            <span className={`badge ${
                              camp.status === "active" ? "badge-primary" :
                              camp.status === "completed" ? "badge-success" : "badge-secondary"
                            }`}>
                              {camp.status}
                            </span>
                          </td>
                          <td style={tdStyle}>{camp.total_leads}</td>
                          <td style={tdStyle}>{camp.sent}</td>
                          <td style={tdStyle}>{camp.sent > 0 ? `${camp.open_rate}%` : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: camp.sent > 0 ? "hsl(var(--success))" : "inherit" }}>
                            {camp.sent > 0 ? `${camp.reply_rate}%` : "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={emptyLeaderboardStyle}>
                No campaigns connected yet. Create a campaign to start tracking outreach performance.
              </div>
            )}
          </div>

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

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1.5rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
  marginTop: "0.25rem",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1.5rem",
};

const statCardStyle: React.CSSProperties = {
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "2.25rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
  fontFamily: "var(--font-family-heading)",
};

const statSubtextStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const performersRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1.5rem",
  flexWrap: "wrap",
};

const performerCardStyle: React.CSSProperties = {
  padding: "1.5rem 2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const performerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const performerLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
};

const performerIconStyle: React.CSSProperties = {
  fontSize: "1.25rem",
};

const performerValueStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
};

const performerDescStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const chartsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "3fr 2fr",
  gap: "1.5rem",
  alignItems: "stretch",
  flexWrap: "wrap",
};

const chartCardStyle: React.CSSProperties = {
  padding: "2rem",
};

const chartHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1rem",
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
};

const chartLegendStyle: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
};

const sectionCardStyle: React.CSSProperties = {
  padding: "2rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
  marginBottom: "1.5rem",
};

const sourceCardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1.5rem",
};

const sourceItemCardStyle: React.CSSProperties = {
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const sourceHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const sourceIconStyle: React.CSSProperties = {
  fontSize: "1.25rem",
};

const sourceLabelStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
};

const sourceStatsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
};

const sourceStatColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
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

const emptyLeaderboardStyle: React.CSSProperties = {
  padding: "3rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
};

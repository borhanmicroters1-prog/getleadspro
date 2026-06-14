"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface UserAnalyticsData {
  total_users: number;
  active_users: number;
  inactive_users: number;
  signups_trend: Array<{ date: string; count: number }>;
  leaderboard_leads: Array<{ email: string; name: string; count: number }>;
  leaderboard_campaigns: Array<{ email: string; name: string; count: number }>;
}

const ACTIVE_COLOR = "hsl(142 71% 45%)";
const INACTIVE_COLOR = "hsl(346 84% 50% / 40%)";

export default function UserAnalyticsPage() {
  const [data, setData] = useState<UserAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/analytics/users");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load user analytics data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      load();
    }
  }, [mounted]);

  if (loading) {
    return (
      <div style={{ padding: "6rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "hsl(var(--text-secondary))" }}>
        <div style={{ width: "32px", height: "32px", border: "2.5px solid hsl(var(--border-color))", borderTopColor: "hsl(var(--accent))", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span>Analyzing user growth & engagement metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>👥 User Growth & Engagement</h3>
        <div style={{ padding: "1rem 1.5rem", backgroundColor: "hsl(var(--danger) / 10%)", border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))", borderRadius: "12px", fontSize: "0.9rem" }}>
          ⚠️ {error || "No data available."}
        </div>
      </div>
    );
  }

  const activeRate = data.total_users > 0 ? (data.active_users / data.total_users) * 100 : 0.0;

  // Format signups trend
  const chartSignupsData = data.signups_trend.map(d => {
    // Format date string (e.g. 2026-06-14 -> Jun 14)
    const parts = d.date.split("-");
    const dateObj = parts.length === 3 ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) : null;
    const dateLabel = dateObj ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : d.date;
    return {
      date: dateLabel,
      Signups: d.count
    };
  });

  const chartStatusData = [
    { name: "Active (last 30d)", value: data.active_users, color: ACTIVE_COLOR },
    { name: "Inactive", value: data.inactive_users, color: INACTIVE_COLOR }
  ];

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>👥 User Growth & Engagement</h3>
        <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
          Monitor platform registrations, active user volumes, and top customer usage
        </p>
      </div>

      {/* Stats KPI Widgets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Total Registered Users</span>
            <span>👥</span>
          </div>
          <div style={cardValueStyle}>{data.total_users}</div>
          <div style={cardFooterStyle}>All-time platform signups</div>
        </div>

        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Active Users (Last 30d)</span>
            <span style={{ color: ACTIVE_COLOR }}>🟢</span>
          </div>
          <div style={cardValueStyle}>{data.active_users}</div>
          <div style={cardFooterStyle}>Users with active leads or campaigns</div>
        </div>

        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Inactive Users</span>
            <span style={{ color: INACTIVE_COLOR }}>⚫</span>
          </div>
          <div style={cardValueStyle}>{data.inactive_users}</div>
          <div style={cardFooterStyle}>No activity in the last 30 days</div>
        </div>

        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Engagement Rate</span>
            <span>⚡</span>
          </div>
          <div style={cardValueStyle}>{activeRate.toFixed(1)}%</div>
          <div style={cardFooterStyle}>Active users ratio of total base</div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* User Signups Bar Chart */}
        <div className="glass-panel" style={{ padding: "1.5rem", minHeight: "350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={chartTitleStyle2}>📅 User Signups (Last 30 Days)</h4>
          {chartSignupsData.length === 0 ? (
            <div style={emptyChartStyle}>No new registrations in the last 30 days.</div>
          ) : (
            <div style={{ width: "100%", height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSignupsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-color) / 25%)" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--bg-secondary))", borderColor: "hsl(var(--border-color))", borderRadius: "8px", fontSize: "0.8rem" }}
                  />
                  <Bar dataKey="Signups" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Engagement Doughnut */}
        <div className="glass-panel" style={{ padding: "1.5rem", minHeight: "350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={chartTitleStyle2}>⚡ Active Base Split</h4>
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
            <div style={{ width: "160px", height: "160px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                    {chartStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--bg-secondary))", borderColor: "hsl(var(--border-color))", borderRadius: "8px", fontSize: "0.8rem" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "1rem", width: "100%" }}>
              {chartStatusData.map((entry, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: entry.color }} />
                    <span style={{ color: "hsl(var(--text-secondary))" }}>{entry.name}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>
                    {entry.value} ({data.total_users > 0 ? Math.round(entry.value / data.total_users * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Top Scrapers */}
        <div className="glass-panel" style={{ padding: "1.5rem 1.75rem" }}>
          <h4 style={chartTitleStyle2}>🏆 Top Users by Leads Scraped</h4>
          {data.leaderboard_leads.length === 0 ? (
            <div style={{ padding: "2rem 0", textAlign: "center", color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
              No leads data scraped yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--border-color))" }}>
                    <th style={thStyle}>User</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Leads Scraped</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard_leads.map((u, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid hsl(var(--border-color) / 40%)" }}>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "hsl(var(--text-primary))" }}>{u.name}</span>
                          <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>{u.email}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "hsl(var(--accent))" }}>
                        {u.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Campaign Launchers */}
        <div className="glass-panel" style={{ padding: "1.5rem 1.75rem" }}>
          <h4 style={chartTitleStyle2}>🚀 Top Users by Campaigns Created</h4>
          {data.leaderboard_campaigns.length === 0 ? (
            <div style={{ padding: "2rem 0", textAlign: "center", color: "hsl(var(--text-muted))", fontSize: "0.85rem" }}>
              No campaigns created yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--border-color))" }}>
                    <th style={thStyle}>User</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Campaigns</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard_campaigns.map((u, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid hsl(var(--border-color) / 40%)" }}>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "hsl(var(--text-primary))" }}>{u.name}</span>
                          <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>{u.email}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "hsl(var(--accent))" }}>
                        {u.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline Styles
const cardStyle: React.CSSProperties = { padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" };
const cardHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "1.1rem" };
const cardTitleStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.05em" };
const cardValueStyle: React.CSSProperties = { fontSize: "1.5rem", fontWeight: 700, color: "hsl(var(--text-primary))", fontFamily: "var(--font-family-heading)" };
const cardFooterStyle: React.CSSProperties = { fontSize: "0.75rem", color: "hsl(var(--text-muted))" };
const chartTitleStyle2: React.CSSProperties = { fontSize: "0.95rem", fontWeight: 700, color: "hsl(var(--text-primary))", borderBottom: "1px solid hsl(var(--border-color) / 30%)", paddingBottom: "0.5rem" };
const emptyChartStyle: React.CSSProperties = { display: "flex", flex: 1, alignItems: "center", justifyCenter: "center", color: "hsl(var(--text-muted))", fontSize: "0.85rem", minHeight: "150px" };
const thStyle: React.CSSProperties = { padding: "0.6rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 0.5rem", fontSize: "0.85rem", color: "hsl(var(--text-secondary))" };

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

interface CampaignAnalyticsData {
  status_counts: Record<string, number>;
  email_metrics: {
    total_leads: number;
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    open_rate: number;
    reply_rate: number;
    bounce_rate: number;
  };
  top_campaigns: Array<{
    name: string;
    user_email: string;
    total_leads: number;
    sent: number;
    replied: number;
    reply_rate: number;
    open_rate: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(217 91% 60% / 40%)",
  active: "hsl(142 71% 45%)",
  paused: "hsl(38 92% 50%)",
  completed: "hsl(250 95% 70%)"
};

export default function CampaignOverviewPage() {
  const [data, setData] = useState<CampaignAnalyticsData | null>(null);
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
      const res = await api.get("/api/admin/analytics/campaigns");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load campaign analytics data.");
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
        <span>Aggregating campaign analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>📊 Campaign Performance Overview</h3>
        <div style={{ padding: "1rem 1.5rem", backgroundColor: "hsl(var(--danger) / 10%)", border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))", borderRadius: "12px", fontSize: "0.9rem" }}>
          ⚠️ {error || "No data available."}
        </div>
      </div>
    );
  }

  const { status_counts, email_metrics, top_campaigns } = data;
  const totalCampaigns = Object.values(status_counts).reduce((a, b) => a + b, 0);

  // Format status count pie
  const chartStatusData = Object.entries(status_counts).map(([name, val]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: val,
    color: STATUS_COLORS[name] || "hsl(var(--text-muted))"
  }));

  // Format funnel data
  const chartFunnelData = [
    { name: "Total Leads", Count: email_metrics.total_leads, fill: "hsl(217 91% 60% / 15%)" },
    { name: "Sent", Count: email_metrics.sent, fill: "hsl(217 91% 60%)" },
    { name: "Opened", Count: email_metrics.opened, fill: "hsl(38 92% 50%)" },
    { name: "Replied", Count: email_metrics.replied, fill: "hsl(142 71% 45%)" },
    { name: "Bounced", Count: email_metrics.bounced, fill: "hsl(346 84% 50%)" }
  ];

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>📊 Campaign Performance Overview</h3>
        <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
          Monitor system-wide email sending activity, deliverability rates, and top-performing user outreach
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Total Campaigns</span>
            <span>📊</span>
          </div>
          <div style={cardValueStyle}>{totalCampaigns}</div>
          <div style={cardFooterStyle}>Platform-wide cold email outreach</div>
        </div>

        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Total Emails Sent</span>
            <span>📤</span>
          </div>
          <div style={cardValueStyle}>{email_metrics.sent.toLocaleString()}</div>
          <div style={cardFooterStyle}>Excludes bounces & pending queue</div>
        </div>

        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>System Avg Open Rate</span>
            <span>📬</span>
          </div>
          <div style={cardValueStyle}>{email_metrics.open_rate.toFixed(1)}%</div>
          <div style={cardFooterStyle}>Average reading rate of prospects</div>
        </div>

        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>System Avg Reply Rate</span>
            <span>⚡</span>
          </div>
          <div style={cardValueStyle}>{email_metrics.reply_rate.toFixed(1)}%</div>
          <div style={cardFooterStyle}>Average response conversion rate</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "1.5rem" }}>
        {/* Status Distribution */}
        <div className="glass-panel" style={{ padding: "1.5rem", minHeight: "350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={chartTitleStyle2}>📁 Campaigns by Status</h4>
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
                    {entry.value} ({totalCampaigns > 0 ? Math.round(entry.value / totalCampaigns * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deliverability Funnel */}
        <div className="glass-panel" style={{ padding: "1.5rem", minHeight: "350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={chartTitleStyle2}>📈 Deliverability & Performance Funnel</h4>
          <div style={{ width: "100%", height: "260px", marginTop: "0.5rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartFunnelData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-color) / 25%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--bg-secondary))", borderColor: "hsl(var(--border-color))", borderRadius: "8px", fontSize: "0.8rem" }}
                  formatter={(val: any) => [Number(val).toLocaleString(), "Volume"]}
                />
                <Bar dataKey="Count" radius={[4, 4, 0, 0]} barSize={35}>
                  {chartFunnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: "0.75rem", color: "hsl(var(--text-muted))", borderTop: "1px solid hsl(var(--border-color) / 30%)", paddingTop: "0.5rem" }}>
            <span>Open rate: <b>{email_metrics.open_rate.toFixed(1)}%</b></span>
            <span>Reply rate: <b>{email_metrics.reply_rate.toFixed(1)}%</b></span>
            <span>Bounce rate: <b style={{ color: "hsl(var(--danger))" }}>{email_metrics.bounce_rate.toFixed(1)}%</b></span>
          </div>
        </div>
      </div>

      {/* Top Performing Campaigns Table */}
      <div className="glass-panel" style={{ padding: "1.5rem 2rem" }}>
        <h4 style={chartTitleStyle2}>🏆 Best Performing Email Campaigns</h4>
        {top_campaigns.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--text-muted))" }}>
            📭 No active campaign statistics available yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border-color))" }}>
                  <th style={thStyle}>Campaign Name</th>
                  <th style={thStyle}>User Owner</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Sent</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Replies</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Open Rate</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Reply Rate</th>
                </tr>
              </thead>
              <tbody>
                {top_campaigns.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid hsl(var(--border-color) / 50%)" }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "hsl(var(--text-primary))" }}>
                      {c.name}
                    </td>
                    <td style={tdStyle}>{c.user_email}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{c.sent}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{c.replied}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{c.open_rate}%</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "hsl(var(--accent))" }}>
                      {c.reply_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
const thStyle: React.CSSProperties = { padding: "0.85rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "0.85rem 1rem", fontSize: "0.85rem", color: "hsl(var(--text-secondary))" };

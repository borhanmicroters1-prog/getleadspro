"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RevenueData {
  total_revenue: number;
  total_transactions: number;
  total_users: number;
  arpu: number;
  current_mrr: number;
  plan_breakdown: Array<{ plan: string; revenue: number; count: number }>;
  monthly_data: Array<{ year: number; month: number; revenue: number; transactions: number }>;
  user_plan_distribution: Array<{ plan: string; count: number }>;
}

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const PLAN_COLORS: Record<string, string> = {
  free: "hsl(217 91% 60%)",
  starter: "hsl(38 92% 50%)",
  pro: "hsl(250 95% 70%)",
  business: "hsl(142 71% 45%)",
  default: "hsl(270 95% 70%)"
};

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
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
      const res = await api.get("/api/admin/revenue");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load revenue analytics.");
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
        <span>Aggregating financial metrics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>💰 Revenue Analytics</h3>
        <div style={{ padding: "1rem 1.5rem", backgroundColor: "hsl(var(--danger) / 10%)", border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))", borderRadius: "12px", fontSize: "0.9rem" }}>
          ⚠️ {error || "No data available."}
        </div>
      </div>
    );
  }

  // Format monthly data for chart
  const chartMonthlyData = data.monthly_data.map(d => ({
    name: `${MONTH_NAMES[d.month] || d.month} ${d.year}`,
    Revenue: d.revenue,
    Tx: d.transactions
  }));

  // Format user plan distribution for chart
  const chartUserPlans = data.user_plan_distribution.map(d => ({
    name: d.plan.charAt(0).toUpperCase() + d.plan.slice(1),
    value: d.count
  }));

  // Format revenue plan breakdown for chart
  const chartPlanBreakdown = data.plan_breakdown.map(d => ({
    name: d.plan.charAt(0).toUpperCase() + d.plan.slice(1),
    value: d.revenue
  }));

  const getPlanColor = (name: string) => {
    const key = name.toLowerCase();
    return PLAN_COLORS[key] || PLAN_COLORS.default;
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>💰 Revenue Analytics</h3>
        <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
          Track platform growth, monthly recurring revenue, customer value, and transactions
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {/* Card 1: Total Revenue */}
        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Total Revenue (All Time)</span>
            <span style={cardIconStyle}>💸</span>
          </div>
          <div style={cardValueStyle}>৳ {data.total_revenue.toLocaleString()}</div>
          <div style={cardFooterStyle}>Total gross volume generated</div>
        </div>

        {/* Card 2: MRR */}
        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>This Month's MRR</span>
            <span style={{ ...cardIconStyle, color: "hsl(142 71% 45%)" }}>📈</span>
          </div>
          <div style={cardValueStyle}>৳ {data.current_mrr.toLocaleString()}</div>
          <div style={cardFooterStyle}>Revenue collected in current month</div>
        </div>

        {/* Card 3: ARPU */}
        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>ARPU (Avg Value/User)</span>
            <span style={cardIconStyle}>👥</span>
          </div>
          <div style={cardValueStyle}>৳ {data.arpu.toLocaleString()}</div>
          <div style={cardFooterStyle}>Total revenue divided by total users</div>
        </div>

        {/* Card 4: Total Transactions */}
        <div className="glass-panel" style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardTitleStyle}>Paid Invoices</span>
            <span style={cardIconStyle}>🧾</span>
          </div>
          <div style={cardValueStyle}>{data.total_transactions}</div>
          <div style={cardFooterStyle}>Successful checkout payments</div>
        </div>
      </div>

      {/* Charts Row 1: Monthly Growth */}
      <div className="glass-panel" style={{ padding: "1.5rem", minHeight: "350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h4 style={chartTitleStyle2}>📈 Monthly Revenue Growth (Last 12 Months)</h4>
        {chartMonthlyData.length === 0 ? (
          <div style={emptyChartStyle}>No revenue logs recorded in the last 12 months.</div>
        ) : (
          <div style={{ width: "100%", height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartMonthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-color) / 25%)" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--text-muted))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `৳${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--bg-secondary))", borderColor: "hsl(var(--border-color))", borderRadius: "8px", fontSize: "0.8rem" }}
                  formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="Revenue" stroke="hsl(var(--accent))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Charts Row 2: Two Pies */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* User Distribution */}
        <div className="glass-panel" style={{ padding: "1.5rem", minHeight: "320px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={chartTitleStyle2}>👥 Users by Subscription Plan</h4>
          {chartUserPlans.length === 0 ? (
            <div style={emptyChartStyle}>No user profiles in database.</div>
          ) : (
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ width: "180px", height: "180px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartUserPlans} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value">
                      {chartUserPlans.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getPlanColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--bg-secondary))", borderColor: "hsl(var(--border-color))", borderRadius: "8px", fontSize: "0.8rem" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "1rem" }}>
                {chartUserPlans.map((entry, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: getPlanColor(entry.name), display: "inline-block" }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>
                      {entry.name}: {entry.value} ({Math.round(entry.value / Math.max(1, data.total_users) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Revenue Distribution */}
        <div className="glass-panel" style={{ padding: "1.5rem", minHeight: "320px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={chartTitleStyle2}>💳 Revenue Contribution by Plan</h4>
          {chartPlanBreakdown.length === 0 ? (
            <div style={emptyChartStyle}>No payments recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ width: "180px", height: "180px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartPlanBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value">
                      {chartPlanBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getPlanColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--bg-secondary))", borderColor: "hsl(var(--border-color))", borderRadius: "8px", fontSize: "0.8rem" }}
                      formatter={(val: any) => `৳${Number(val).toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "1rem" }}>
                {chartPlanBreakdown.map((entry, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: getPlanColor(entry.name), display: "inline-block" }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "hsl(var(--text-secondary))" }}>
                      {entry.name}: ৳{entry.value.toLocaleString()} ({Math.round(entry.value / Math.max(1, data.total_revenue) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline Styles
const cardStyle: React.CSSProperties = {
  padding: "1.25rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem"
};
const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em"
};
const cardIconStyle: React.CSSProperties = {
  fontSize: "1.1rem"
};
const cardValueStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
  fontFamily: "var(--font-family-heading)"
};
const cardFooterStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))"
};
const chartTitleStyle2: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
  borderBottom: "1px solid hsl(var(--border-color) / 30%)",
  paddingBottom: "0.5rem"
};
const emptyChartStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.85rem",
  minHeight: "150px"
};

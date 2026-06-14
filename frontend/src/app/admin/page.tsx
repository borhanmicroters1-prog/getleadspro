"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface SystemKeys {
  google_maps: boolean;
  facebook_ads: boolean;
  claude_ai: boolean;
  chatgpt_ai: boolean;
  gemini_ai: boolean;
  sslcommerz: boolean;
}

interface RecentTransaction {
  id: string;
  user_email: string;
  tran_id: string;
  amount: number;
  item_type: string;
  item_id: string;
  status: string;
  error_reason?: string;
  created_at: string;
}

interface StatsData {
  total_users: number;
  starter_users: number;
  pro_users: number;
  system_mrr: number;
  total_sent: number;
  total_leads: number;
  warmup_pool_size: number;
  total_revenue: number;
  active_campaigns: number;
  pending_tickets: number;
  promo_uses: number;
  recent_transactions: RecentTransaction[];
  system_keys: SystemKeys;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/api/admin/overview");
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to load system stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Fetching system metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={errorContainerStyle}>
        <span>⚠️ {error}</span>
        <button onClick={loadStats} className="btn btn-secondary" style={{ marginTop: "1rem" }}>
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { title: "👥 Total Users", value: stats.total_users, desc: "Registered accounts", highlight: false },
    { title: "⭐ Pro Users", value: stats.pro_users, desc: "Paid Pro tier accounts", highlight: false },
    { title: "📈 Monthly Revenue (MRR)", value: `৳${stats.system_mrr.toLocaleString()}`, desc: "Starter + Pro subscriptions", highlight: false },
    { title: "💰 Total Revenue (All-Time)", value: `৳${stats.total_revenue.toLocaleString()}`, desc: "Sum of all paid plans/packs", highlight: true, color: "hsl(var(--success))" },
    { title: "📤 Sent Emails", value: stats.total_sent.toLocaleString(), desc: "Total outreach emails sent", highlight: false },
    { title: "🔍 Leads Found", value: stats.total_leads.toLocaleString(), desc: "Scraped Google Maps + Facebook", highlight: false },
    { title: "🔥 Active Warmup Pool", value: stats.warmup_pool_size, desc: "Accounts currently warming up", highlight: false },
    { title: "🚀 Active Campaigns", value: stats.active_campaigns, desc: "Outreach campaigns sending now", highlight: false },
    { 
      title: "🎫 Pending Tickets", 
      value: stats.pending_tickets, 
      desc: "Tickets awaiting response", 
      highlight: stats.pending_tickets > 0, 
      color: "hsl(var(--warning))" 
    },
    { title: "🏷️ Promo Code Uses", value: stats.promo_uses, desc: "Discounts claimed in purchases", highlight: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
      
      {/* Stats Cards Grid */}
      <div style={gridStyle}>
        {cards.map((card, i) => (
          <div key={i} className="glass-panel" style={{
            ...cardStyle,
            borderLeft: card.highlight ? `4px solid ${card.color || "hsl(var(--accent))"}` : undefined
          }}>
            <span style={cardTitleStyle}>{card.title}</span>
            <span style={{
              ...cardValueStyle,
              color: card.highlight ? card.color : "hsl(var(--text-primary))"
            }}>{card.value}</span>
            <span style={cardDescStyle}>{card.desc}</span>
          </div>
        ))}
      </div>

      {/* Main Bottom Section */}
      <div style={bottomGridStyle}>
        
        {/* API Checklist */}
        <div className="glass-panel" style={panelStyle}>
          <h3 style={panelTitleStyle}>🛡️ System Integrations & Keys</h3>
          <p style={panelDescStyle}>Checklist of backend API configurations</p>
          
          <div style={checklistStyle}>
            <div style={checkRowStyle}>
              <span style={checkLabelStyle}>📍 Google Maps Scraping API</span>
              <span className={`badge ${stats.system_keys.google_maps ? "badge-success" : "badge-danger"}`}>
                {stats.system_keys.google_maps ? "Active" : "Missing"}
              </span>
            </div>
            
            <div style={checkRowStyle}>
              <span style={checkLabelStyle}>📘 Facebook Ads scraping token</span>
              <span className={`badge ${stats.system_keys.facebook_ads ? "badge-success" : "badge-danger"}`}>
                {stats.system_keys.facebook_ads ? "Active" : "Missing"}
              </span>
            </div>

            <div style={checkRowStyle}>
              <span style={checkLabelStyle}>🧠 Anthropic Claude AI API</span>
              <span className={`badge ${stats.system_keys.claude_ai ? "badge-success" : "badge-danger"}`}>
                {stats.system_keys.claude_ai ? "Active" : "Missing"}
              </span>
            </div>

            <div style={checkRowStyle}>
              <span style={checkLabelStyle}>🤖 OpenAI ChatGPT API</span>
              <span className={`badge ${stats.system_keys.chatgpt_ai ? "badge-success" : "badge-danger"}`}>
                {stats.system_keys.chatgpt_ai ? "Active" : "Missing"}
              </span>
            </div>

            <div style={checkRowStyle}>
              <span style={checkLabelStyle}>✨ Google Gemini AI API</span>
              <span className={`badge ${stats.system_keys.gemini_ai ? "badge-success" : "badge-danger"}`}>
                {stats.system_keys.gemini_ai ? "Active" : "Missing"}
              </span>
            </div>

            <div style={checkRowStyle}>
              <span style={checkLabelStyle}>💳 SSLCommerz Payment Gateway</span>
              <span className={`badge ${stats.system_keys.sslcommerz ? "badge-success" : "badge-danger"}`}>
                {stats.system_keys.sslcommerz ? "Active" : "Missing"}
              </span>
            </div>
          </div>
        </div>

        {/* Recent purchases */}
        <div className="glass-panel" style={{ ...panelStyle, flex: 2 }}>
          <h3 style={panelTitleStyle}>💳 Recent Purchases & Attempts</h3>
          <p style={panelDescStyle}>Last 5 payment transactions across the platform</p>

          {stats.recent_transactions.length === 0 ? (
            <div style={noDataStyle}>No purchases found yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={thRowStyle}>
                    <th style={thStyle}>User Email</th>
                    <th style={thStyle}>Product / Item</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Reference ID</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_transactions.map((txn) => (
                    <tr key={txn.id} style={trStyle}>
                      <td style={tdStyle}>{txn.user_email}</td>
                      <td style={tdStyle}>
                        <span style={{ textTransform: "capitalize" }}>
                          {txn.item_id} {txn.item_type}
                        </span>
                      </td>
                      <td style={tdStyle}>৳{txn.amount.toLocaleString()} BDT</td>
                      <td style={tdStyle}>
                        <code style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "hsl(var(--accent-cyan))" }}>
                          {txn.tran_id}
                        </code>
                      </td>
                      <td style={tdStyle}>
                        <span className={`badge ${
                          txn.status === "success" ? "badge-success" : 
                          txn.status === "failed" ? "badge-danger" : 
                          txn.status === "cancelled" ? "badge-warning" : 
                          "badge-secondary"
                        }`}>
                          {txn.status}
                        </span>
                      </td>
                      <td style={tdStyle}>{new Date(txn.created_at).toLocaleDateString()}</td>
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
const loadingContainerStyle: React.CSSProperties = {
  padding: "3rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
  color: "hsl(var(--text-secondary))",
};

const spinnerStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  border: "3px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const errorContainerStyle: React.CSSProperties = {
  padding: "2rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.5rem",
  color: "hsl(var(--danger))",
  background: "hsl(var(--danger) / 4%)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "1.25rem",
};

const cardStyle: React.CSSProperties = {
  padding: "1.5rem 1.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const cardValueStyle: React.CSSProperties = {
  fontSize: "1.85rem",
  fontWeight: "bold",
  color: "hsl(var(--text-primary))",
  fontFamily: "var(--font-family-heading)",
};

const cardDescStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-secondary))",
};

const bottomGridStyle: React.CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  flexWrap: "wrap",
};

const panelStyle: React.CSSProperties = {
  padding: "2rem",
  flex: 1,
  minWidth: "320px",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "0.25rem",
};

const panelDescStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-muted))",
  marginBottom: "1.5rem",
};

const checklistStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const checkRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: "0.75rem",
  borderBottom: "1px solid hsl(var(--border-color))",
};

const checkLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
};

const noDataStyle: React.CSSProperties = {
  padding: "2rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.9rem",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.875rem",
};

const thRowStyle: React.CSSProperties = {
  borderBottom: "2.5px solid hsl(var(--border-color))",
};

const thStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  textAlign: "left",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  fontSize: "0.75rem",
  letterSpacing: "0.05em",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
  transition: "background-color 0.2s ease",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  color: "hsl(var(--text-secondary))",
};

"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface WarmupAccount {
  account_id: string;
  user_email: string;
  from_email: string;
  provider: string;
  health_score: number;
  emails_sent_today: number;
  daily_limit: number;
  warmup_started_at: string | null;
}

export default function AdminWarmupPoolPage() {
  const [pool, setPool] = useState<WarmupAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWarmupPool = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/api/admin/warmup-pool");
      setPool(data);
    } catch (err: any) {
      setError(err.message || "Failed to load active warmup pool.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarmupPool();
  }, []);

  const getHealthBadgeClass = (score: number) => {
    if (score >= 90) return "badge-success";
    if (score >= 70) return "badge-warning";
    return "badge-danger";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
      
      {/* Header with Refresh */}
      <div style={headerRowStyle}>
        <div>
          <h3 style={sectionTitleStyle}>🔥 Active Warm-up Pool</h3>
          <p style={sectionSubStyle}>Monitor connected mailboxes currently running automatic email warm-ups</p>
        </div>
        <button onClick={loadWarmupPool} className="btn btn-secondary" disabled={loading}>
          🔄 Refresh Pool
        </button>
      </div>

      {error && <div style={errorBannerStyle}>⚠️ {error}</div>}

      {/* Main Table */}
      <div className="glass-panel" style={tableContainerStyle}>
        {loading ? (
          <div style={loadingWrapperStyle}>
            <div style={spinnerStyle} />
            <span>Scanning warm-up pool...</span>
          </div>
        ) : pool.length === 0 ? (
          <div style={noDataStyle}>No connected mailboxes are currently in warm-up mode.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={thRowStyle}>
                  <th style={thStyle}>Owner User</th>
                  <th style={thStyle}>From Email Address</th>
                  <th style={thStyle}>Provider</th>
                  <th style={thStyle}>Health Score</th>
                  <th style={thStyle}>Sent Today</th>
                  <th style={thStyle}>Started At</th>
                </tr>
              </thead>
              <tbody>
                {pool.map((acc) => (
                  <tr key={acc.account_id} style={trStyle}>
                    <td style={tdStyle}>{acc.user_email}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>{acc.from_email}</span>
                    </td>
                    <td style={tdStyle}>
                      <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
                        {acc.provider}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className={`badge ${getHealthBadgeClass(acc.health_score)}`}>
                        {acc.health_score}% Health
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "hsl(var(--text-primary))", fontWeight: 500 }}>
                        {acc.emails_sent_today} / {acc.daily_limit}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {acc.warmup_started_at ? new Date(acc.warmup_started_at).toLocaleDateString() : "N/A"}
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
const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  color: "hsl(var(--text-primary))",
};

const sectionSubStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-muted))",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const tableContainerStyle: React.CSSProperties = {
  padding: "1.5rem 2rem",
};

const loadingWrapperStyle: React.CSSProperties = {
  padding: "4rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  color: "hsl(var(--text-secondary))",
};

const spinnerStyle: React.CSSProperties = {
  width: "30px",
  height: "30px",
  border: "2.5px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const noDataStyle: React.CSSProperties = {
  padding: "3rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
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
  verticalAlign: "middle",
};

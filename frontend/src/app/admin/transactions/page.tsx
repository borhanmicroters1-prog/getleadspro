"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/utils/api";

interface PaymentTransaction {
  id: string;
  user_email: string;
  tran_id: string;
  amount: number;
  item_type: string;
  item_id: string;
  status: "initiated" | "success" | "failed" | "cancelled";
  error_reason: string | null;
  created_at: string;
}

type StatusFilter = "all" | "success" | "failed" | "cancelled" | "initiated";

const STATUS_TABS: { key: StatusFilter; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "📋" },
  { key: "success", label: "Success", emoji: "✅" },
  { key: "failed", label: "Failed", emoji: "❌" },
  { key: "cancelled", label: "Cancelled", emoji: "⚠️" },
  { key: "initiated", label: "Initiated", emoji: "🕐" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string; emoji: string }> = {
    success: { bg: "hsl(142 71% 45% / 15%)", color: "hsl(142 71% 45%)", label: "Success", emoji: "✅" },
    failed: { bg: "hsl(0 72% 51% / 15%)", color: "hsl(0 72% 60%)", label: "Failed", emoji: "❌" },
    cancelled: { bg: "hsl(38 92% 50% / 15%)", color: "hsl(38 92% 55%)", label: "Cancelled", emoji: "⚠️" },
    initiated: { bg: "hsl(217 91% 60% / 15%)", color: "hsl(217 91% 65%)", label: "Initiated", emoji: "🕐" },
  };
  const s = map[status] ?? { bg: "hsl(0 0% 50% / 15%)", color: "hsl(0 0% 60%)", label: status, emoji: "•" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.25rem 0.65rem",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.color}33`,
        whiteSpace: "nowrap",
      }}
    >
      {s.emoji} {s.label}
    </span>
  );
}

export default function AdminTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/api/admin/transactions");
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || "Failed to load payment transactions.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (txnId: string, tranId: string) => {
    if (!confirm(`Are you sure you want to permanently delete transaction "${tranId}"? This action cannot be undone.`)) return;
    setDeletingId(txnId);
    try {
      await api.delete(`/api/admin/transactions/${txnId}`);
      setTransactions((prev) => prev.filter((t) => t.id !== txnId));
    } catch (err: any) {
      alert(err.message || "Failed to delete transaction.");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // Counts per status for tab badges
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: transactions.length };
    for (const t of transactions) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c;
  }, [transactions]);

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? transactions : transactions.filter((t) => t.status === activeTab);
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (t) =>
          t.user_email.toLowerCase().includes(q) ||
          t.tran_id.toLowerCase().includes(q) ||
          t.item_id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, activeTab, searchQuery]);

  // Summary stats
  const totalRevenue = useMemo(
    () => transactions.filter((t) => t.status === "success").reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );
  const failedCount = useMemo(() => transactions.filter((t) => t.status === "failed").length, [transactions]);
  const cancelledCount = useMemo(() => transactions.filter((t) => t.status === "cancelled").length, [transactions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">

      {/* Header */}
      <div style={headerRowStyle}>
        <div>
          <h3 style={sectionTitleStyle}>💳 Payment Transactions</h3>
          <p style={sectionSubStyle}>Full SSLCommerz gateway log — success, failed & cancelled payments</p>
        </div>
        <button onClick={loadTransactions} className="btn btn-secondary" disabled={loading}>
          🔄 Refresh Log
        </button>
      </div>

      {error && <div style={errorBannerStyle}>⚠️ {error}</div>}

      {/* Summary Cards */}
      <div style={summaryGridStyle}>
        <div className="glass-panel" style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total Revenue</div>
          <div style={{ ...summaryValueStyle, color: "hsl(142 71% 45%)" }}>৳{totalRevenue.toLocaleString()} BDT</div>
        </div>
        <div className="glass-panel" style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Failed Transactions</div>
          <div style={{ ...summaryValueStyle, color: "hsl(0 72% 60%)" }}>{failedCount}</div>
        </div>
        <div className="glass-panel" style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Cancelled by User</div>
          <div style={{ ...summaryValueStyle, color: "hsl(38 92% 55%)" }}>{cancelledCount}</div>
        </div>
        <div className="glass-panel" style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total Transactions</div>
          <div style={{ ...summaryValueStyle, color: "hsl(var(--text-primary))" }}>{transactions.length}</div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="glass-panel" style={{ padding: "0.5rem 1rem" }}>
        <div style={tabsRowStyle}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...tabBtnStyle,
                ...(activeTab === tab.key ? activeTabStyle : {}),
              }}
            >
              {tab.emoji} {tab.label}
              {counts[tab.key] !== undefined && (
                <span style={{
                  ...tabBadgeStyle,
                  backgroundColor: activeTab === tab.key ? "hsl(var(--accent) / 30%)" : "hsl(var(--bg-tertiary))",
                  color: activeTab === tab.key ? "hsl(var(--accent))" : "hsl(var(--text-muted))",
                }}>
                  {counts[tab.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Table */}
      <div className="glass-panel" style={tableContainerStyle}>
        {/* Search */}
        <div style={searchWrapperStyle}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={searchIconStyle}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.603 10.603z" />
          </svg>
          <input
            type="text"
            placeholder="Search by email, transaction ID, or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: "2.75rem", marginBottom: "1.25rem" }}
          />
        </div>

        {loading ? (
          <div style={loadingWrapperStyle}>
            <div style={spinnerStyle} />
            <span>Loading transaction vault...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={noDataStyle}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
              {activeTab === "failed" ? "🎉" : activeTab === "cancelled" ? "👍" : "📭"}
            </div>
            {activeTab === "failed"
              ? "No failed transactions found."
              : activeTab === "cancelled"
              ? "No cancelled transactions found."
              : "No transactions found matching your search."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={thRowStyle}>
                  <th style={thStyle}>User Email</th>
                  <th style={thStyle}>Transaction ID</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Reason / Note</th>
                  <th style={thStyle}>Date & Time</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn) => (
                  <tr key={txn.id} style={trStyle} className="table-row-hover">
                    <td style={tdStyle}>
                      <span
                        onClick={() => router.push(`/admin/users?search=${encodeURIComponent(txn.user_email)}`)}
                        title={`View ${txn.user_email}'s profile`}
                        style={{
                          color: "hsl(var(--accent))",
                          fontWeight: 500,
                          cursor: "pointer",
                          textDecoration: "underline",
                          textDecorationStyle: "dotted",
                          textUnderlineOffset: "3px",
                          transition: "opacity 0.15s ease",
                          display: "inline-block",
                          maxWidth: "180px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          verticalAlign: "bottom",
                        }}
                        onMouseOver={e => (e.currentTarget.style.opacity = "0.75")}
                        onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                      >
                        {txn.user_email}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <code style={codeStyle}>{txn.tran_id}</code>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))", textTransform: "capitalize" }}>
                          {txn.item_id}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", textTransform: "capitalize" }}>
                          {txn.item_type}
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontWeight: 700,
                        color: txn.status === "success"
                          ? "hsl(142 71% 45%)"
                          : txn.status === "failed" || txn.status === "cancelled"
                          ? "hsl(0 72% 60%)"
                          : "hsl(var(--text-secondary))",
                      }}>
                        ৳{txn.amount.toLocaleString()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={txn.status} />
                    </td>
                    <td style={tdStyle}>
                      {txn.error_reason ? (
                        <span style={{ color: "hsl(0 72% 60%)", fontSize: "0.8rem" }}>{txn.error_reason}</span>
                      ) : txn.status === "success" ? (
                        <span style={{ color: "hsl(142 71% 45%)", fontSize: "0.8rem" }}>Credits granted ✓</span>
                      ) : (
                        <span style={{ color: "hsl(var(--text-muted))", fontSize: "0.8rem" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>
                        {new Date(txn.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => handleDelete(txn.id, txn.tran_id)}
                        disabled={deletingId === txn.id}
                        title="Delete this transaction"
                        style={{
                          backgroundColor: "transparent",
                          border: "1px solid hsl(var(--danger) / 30%)",
                          borderRadius: "6px",
                          color: deletingId === txn.id ? "hsl(var(--text-muted))" : "hsl(var(--danger))",
                          cursor: deletingId === txn.id ? "not-allowed" : "pointer",
                          padding: "0.35rem 0.6rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          transition: "all 0.15s ease",
                          opacity: deletingId === txn.id ? 0.5 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {deletingId === txn.id ? "⏳" : "🗑️"}
                      </button>
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

// ── Styles ──────────────────────────────────────────────────────────────────
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

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "1rem",
};

const summaryCardStyle: React.CSSProperties = {
  padding: "1.25rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 600,
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
};

const tabsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.25rem",
  flexWrap: "wrap",
};

const tabBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  fontSize: "0.875rem",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid transparent",
  backgroundColor: "transparent",
  color: "hsl(var(--text-muted))",
  transition: "all 0.15s ease",
};

const activeTabStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--accent) / 12%)",
  border: "1px solid hsl(var(--accent) / 25%)",
  color: "hsl(var(--accent))",
};

const tabBadgeStyle: React.CSSProperties = {
  padding: "0.1rem 0.45rem",
  borderRadius: "999px",
  fontSize: "0.7rem",
  fontWeight: 700,
};

const tableContainerStyle: React.CSSProperties = {
  padding: "1.25rem 1.5rem",
};

const searchWrapperStyle: React.CSSProperties = {
  position: "relative",
};

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: "1rem",
  top: "50%",
  transform: "translateY(-50%) translateY(-0.625rem)",
  width: "18px",
  height: "18px",
  color: "hsl(var(--text-muted))",
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
  padding: "0.75rem 0.6rem",
  textAlign: "left",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  fontSize: "0.7rem",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid hsl(var(--border-color))",
  transition: "background-color 0.2s ease",
};

const tdStyle: React.CSSProperties = {
  padding: "0.75rem 0.6rem",
  color: "hsl(var(--text-secondary))",
  verticalAlign: "middle",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "monospace",
  padding: "0.2rem 0.4rem",
  backgroundColor: "hsl(var(--bg-tertiary))",
  borderRadius: "4px",
  fontSize: "0.75rem",
  color: "hsl(var(--accent-cyan))",
};

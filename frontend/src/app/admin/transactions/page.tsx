"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface Transaction {
  id: string;
  user_email: string;
  action: string;
  credits_credited: number;
  amount_bdt: number;
  reference: string;
  created_at: string;
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/api/admin/transactions");
      setTransactions(data);
      setFilteredTransactions(data);
    } catch (err: any) {
      setError(err.message || "Failed to load payment transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      setFilteredTransactions(transactions);
    } else {
      setFilteredTransactions(
        transactions.filter(
          (t) =>
            t.user_email.toLowerCase().includes(q) ||
            t.reference?.toLowerCase().includes(q) ||
            t.credits_credited.toString().includes(q)
        )
      );
    }
  }, [searchQuery, transactions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
      
      {/* Header and Controls */}
      <div style={headerRowStyle}>
        <div>
          <h3 style={sectionTitleStyle}>💳 Platform Transactions</h3>
          <p style={sectionSubStyle}>Audit successful credit purchases and payment logs</p>
        </div>
        <button onClick={loadTransactions} className="btn btn-secondary" disabled={loading}>
          🔄 Refresh Log
        </button>
      </div>

      {error && <div style={errorBannerStyle}>⚠️ {error}</div>}

      {/* Filter Toolbar */}
      <div className="glass-panel" style={filterPanelStyle}>
        <div style={searchWrapperStyle}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={searchIconStyle}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.603 10.603z" />
          </svg>
          <input
            type="text"
            placeholder="Search by user email, amount, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: "2.75rem" }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={tableContainerStyle}>
        {loading ? (
          <div style={loadingWrapperStyle}>
            <div style={spinnerStyle} />
            <span>Scanning transaction vault...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div style={noDataStyle}>No matching purchase logs found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={thRowStyle}>
                  <th style={thStyle}>Buyer Email</th>
                  <th style={thStyle}>Credits Purchased</th>
                  <th style={thStyle}>Price Paid</th>
                  <th style={thStyle}>SSLCommerz Reference ID</th>
                  <th style={thStyle}>Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} style={trStyle}>
                    <td style={tdStyle}>{txn.user_email}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>
                        🪙 {txn.credits_credited.toLocaleString()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="badge badge-success">
                        ৳{txn.amount_bdt.toLocaleString()} BDT
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <code style={codeStyle}>{txn.reference || "N/A"}</code>
                    </td>
                    <td style={tdStyle}>
                      {new Date(txn.created_at).toLocaleString()}
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

const filterPanelStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
};

const searchWrapperStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
};

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: "1rem",
  top: "50%",
  transform: "translateY(-50%)",
  width: "18px",
  height: "18px",
  color: "hsl(var(--text-muted))",
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

const codeStyle: React.CSSProperties = {
  fontFamily: "monospace",
  padding: "0.2rem 0.4rem",
  backgroundColor: "hsl(var(--bg-tertiary))",
  borderRadius: "4px",
  fontSize: "0.8rem",
  color: "hsl(var(--accent-cyan))",
};

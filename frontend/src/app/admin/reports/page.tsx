"use client";

import { useState } from "react";
import { auth } from "@/utils/auth";

interface ReportCardProps {
  title: string;
  description: string;
  icon: string;
  endpoint: string;
  fileName: string;
  columns: string[];
}

export default function AdminReportsPage() {
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>({});
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleDownloadReport = async (endpoint: string, fileName: string) => {
    setDownloadingMap((prev) => ({ ...prev, [endpoint]: true }));
    try {
      const token = auth.getToken();
      const res = await fetch(`${apiBaseUrl}/api/admin/reports/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        alert("Failed to generate report. Please try again.");
      }
    } catch (err) {
      console.error(`Error downloading report ${endpoint}:`, err);
      alert("Network error. Could not connect to API server.");
    } finally {
      setDownloadingMap((prev) => ({ ...prev, [endpoint]: false }));
    }
  };

  const reports = [
    {
      title: "Revenue & Checkout ledger",
      description: "Complete transactional audit of all successful plan upgrades, subscriptions, and credit pack purchases.",
      icon: "💰",
      endpoint: "revenue",
      fileName: `revenue_report_${new Date().toISOString().split('T')[0]}.csv`,
      columns: ["Transaction ID", "User Email", "Amount Paid (BDT)", "Item Type", "Item ID", "Promo Code", "Date"]
    },
    {
      title: "Users Master Directory",
      description: "Full directory list of all users, showing their assigned package plan, current remaining credits, and signup dates.",
      icon: "👥",
      endpoint: "users",
      fileName: `users_report_${new Date().toISOString().split('T')[0]}.csv`,
      columns: ["User ID", "Name", "Email", "Plan Tier", "Credits Balance", "Is Admin", "Telegram Setup", "Date Joined"]
    },
    {
      title: "Campaign Performance Summary",
      description: "Aggregated health report containing total leads, outbound counts, reply stats, and bounce metrics per campaign.",
      icon: "✉️",
      endpoint: "campaigns",
      fileName: `campaigns_performance_${new Date().toISOString().split('T')[0]}.csv`,
      columns: ["Campaign ID", "Name", "User Owner", "Status", "Leads Count", "Sent", "Replies", "Bounces", "Interval"]
    },
    {
      title: "System Credits Usage Log",
      description: "Log tracing all credit allocations and deductions (leads scraping charges, checkout purchases, admin bonuses).",
      icon: "🎫",
      endpoint: "credits",
      fileName: `credits_log_${new Date().toISOString().split('T')[0]}.csv`,
      columns: ["Log ID", "User Email", "Action", "Amount", "Balance After", "Reference Code", "Timestamp"]
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Reports & Export Center</h1>
        <p style={{ margin: "0.25rem 0 0 0", color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
          Super Admin Console — generate and download live system logs and business metrics in CSV format.
        </p>
      </div>

      {/* Grid Layout of Report Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))", gap: "1.5rem" }}>
        {reports.map((r) => {
          const isDownloading = downloadingMap[r.endpoint] || false;
          return (
            <div
              key={r.endpoint}
              className="glass-panel"
              style={{
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1.25rem",
                borderRadius: "16px",
                border: "1px solid var(--glass-border)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease"
              }}
            >
              <div style={{ display: "flex", gap: "1rem" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    backgroundColor: "hsl(var(--accent) / 10%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem"
                  }}
                >
                  {r.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "hsl(var(--text-primary))" }}>
                    {r.title}
                  </h3>
                  <p style={{ margin: "0.4rem 0 0 0", fontSize: "0.85rem", color: "hsl(var(--text-secondary))", lineHeight: "1.4" }}>
                    {r.description}
                  </p>
                </div>
              </div>

              {/* CSV Columns list preview */}
              <div style={{ backgroundColor: "hsl(var(--bg-secondary) / 20%)", padding: "0.75rem", borderRadius: "10px", border: "1px solid hsl(var(--border-color) / 40%)" }}>
                <div style={{ fontSize: "0.725rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" }}>
                  Export CSV Columns
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {r.columns.map((col) => (
                    <span
                      key={col}
                      style={{
                        padding: "2px 6px",
                        backgroundColor: "hsl(var(--bg-tertiary))",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        color: "hsl(var(--text-muted))"
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Download trigger */}
              <button
                onClick={() => handleDownloadReport(r.endpoint, r.fileName)}
                disabled={isDownloading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  backgroundColor: "hsl(var(--accent))",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: isDownloading ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 12px hsl(var(--accent) / 15%)",
                  transition: "all 0.15s ease"
                }}
              >
                {isDownloading ? (
                  <>
                    <div className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }}></div>
                    Generating Excel CSV...
                  </>
                ) : (
                  <>
                    <span>📥</span> Download Report (.csv)
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

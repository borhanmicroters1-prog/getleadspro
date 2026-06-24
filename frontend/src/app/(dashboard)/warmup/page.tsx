"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";

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

interface EmailAccountItem {
  id: string;
  provider: "gmail" | "brevo";
  from_email: string;
  from_name: string;
  daily_limit: number;
  emails_sent_today: number;
  is_active: boolean;
  warmup_enabled: boolean;
  warmup_status: "idle" | "warming" | "paused";
  warmup_health_score: number;
  statusDetails?: WarmupStats;
  actionLoading?: boolean;
}

export default function UserWarmupDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<EmailAccountItem[]>([]);
  const [error, setError] = useState("");
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  const fetchWarmupPoolData = async () => {
    try {
      // 1. Fetch connected email accounts
      const emailAccounts: EmailAccountItem[] = await api.get("/api/email-accounts");
      
      // 2. Fetch warmup status for each account in parallel
      const accountsWithStatus = await Promise.all(
        emailAccounts.map(async (acc) => {
          try {
            const statusDetails = await api.get(`/api/warmup/status/${acc.id}`);
            return { ...acc, statusDetails, actionLoading: false };
          } catch (err: any) {
            console.error(`Failed to load status details for ${acc.from_email}:`, err);
            return { ...acc, actionLoading: false };
          }
        })
      );
      
      setAccounts(accountsWithStatus);
      setError("");
    } catch (err: any) {
      console.error("Error fetching warmup accounts:", err);
      setError(err.message || "Failed to load warmup workspace. Please try again.");
    }
  };

  useEffect(() => {
    if (user) {
      fetchWarmupPoolData();
    }
  }, [user]);

  const handleStartWarmup = async (accId: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === accId ? { ...acc, actionLoading: true } : acc))
    );
    setGlobalError("");
    try {
      await api.post(`/api/warmup/start/${accId}`, {});
      await fetchWarmupPoolData();
    } catch (err: any) {
      setGlobalError(err.message || "Failed to start warmup for the mailbox.");
    } finally {
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === accId ? { ...acc, actionLoading: false } : acc))
      );
    }
  };

  const handlePauseWarmup = async (accId: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === accId ? { ...acc, actionLoading: true } : acc))
    );
    setGlobalError("");
    try {
      await api.post(`/api/warmup/pause/${accId}`, {});
      await fetchWarmupPoolData();
    } catch (err: any) {
      setGlobalError(err.message || "Failed to pause warmup.");
    } finally {
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === accId ? { ...acc, actionLoading: false } : acc))
      );
    }
  };

  // Compute overall stats
  const activeWarmingAccounts = accounts.filter(
    (acc) => acc.statusDetails?.warmup_status === "warming"
  );
  const totalWarming = activeWarmingAccounts.length;

  const avgHealth =
    activeWarmingAccounts.length > 0
      ? Math.round(
          activeWarmingAccounts.reduce(
            (sum, acc) => sum + (acc.statusDetails?.health_score || 0),
            0
          ) / activeWarmingAccounts.length
        )
      : 100;

  const totalSent = accounts.reduce(
    (sum, acc) => sum + (acc.statusDetails?.totals.emails_sent || 0),
    0
  );
  
  const totalInbox = accounts.reduce(
    (sum, acc) => sum + (acc.statusDetails?.totals.inbox_moved || 0),
    0
  );
  const totalSpam = accounts.reduce(
    (sum, acc) => sum + (acc.statusDetails?.totals.spam_found || 0),
    0
  );
  const deliverabilityRate =
    totalInbox + totalSpam > 0
      ? Math.round((totalInbox / (totalInbox + totalSpam)) * 100)
      : 100;

  const getHealthColor = (score: number) => {
    if (score >= 80) return "rgb(16, 185, 129)"; // Green
    if (score >= 50) return "rgb(245, 158, 11)"; // Yellow/Orange
    return "rgb(239, 68, 68)"; // Red
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading Email Warmup dashboard...</span>
      </div>
    );
  }

  return (
    <main className="content-pane animate-fade-in" style={containerStyle}>
      {/* Title block */}
      <div style={headerRowStyle}>
        <div>
          <h2 style={titleStyle}>🔥 Email Warmup Workspace</h2>
          <p style={subtitleStyle}>
            Protect your domain reputation and ensure your outreach emails hit the inbox.
          </p>
        </div>
        <button
          onClick={() => router.push("/email-accounts")}
          className="btn btn-secondary"
          style={{ height: "42px", padding: "0 1.25rem" }}
        >
          ⚙️ Manage Mailboxes
        </button>
      </div>

      {globalError && (
        <div style={errorBannerStyle} className="animate-fade-in">
          ⚠️ <strong>Error:</strong> {globalError}
        </div>
      )}

      {error && (
        <div style={errorBannerStyle}>
          ⚠️ {error}
        </div>
      )}

      {/* Global Metrics Summary Cards */}
      <div style={statsSummaryGridStyle}>
        <div className="glass-panel" style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Active Warming Pool</span>
          <span style={summaryValueStyle}>
            {totalWarming} <span style={{ fontSize: "14px", fontWeight: "normal", color: "hsl(var(--text-muted))" }}>/ {accounts.length} mailboxes</span>
          </span>
        </div>
        <div className="glass-panel" style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Average Pool Health</span>
          <span style={{ ...summaryValueStyle, color: getHealthColor(avgHealth) }}>
            {avgHealth}%
          </span>
        </div>
        <div className="glass-panel" style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Deliverability Rate</span>
          <span style={{ ...summaryValueStyle, color: getHealthColor(deliverabilityRate) }}>
            {deliverabilityRate}%
          </span>
        </div>
        <div className="glass-panel" style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Warmup Emails Sent</span>
          <span style={summaryValueStyle}>{totalSent}</span>
        </div>
      </div>

      {/* Connected Mailboxes List */}
      <div className="glass-panel" style={panelStyle}>
        <div style={panelHeaderStyle}>
          <h3 style={panelTitleStyle}>Warmup Settings & Statuses</h3>
          <span style={{ fontSize: "12px", color: "hsl(var(--text-muted))" }}>
            Total connected accounts: {accounts.length}
          </span>
        </div>

        {accounts.length > 0 ? (
          <div style={listContainerStyle}>
            {accounts.map((acc) => {
              const status = acc.statusDetails?.warmup_status || acc.warmup_status || "idle";
              const healthScore = acc.statusDetails?.health_score ?? acc.warmup_health_score ?? 100;
              const totals = acc.statusDetails?.totals || { emails_sent: 0, emails_received: 0, replies_sent: 0, inbox_moved: 0, spam_found: 0 };
              const daysWarming = acc.statusDetails?.days_warming || 0;

              return (
                <div key={acc.id} style={accountItemStyle} className="glass-panel">
                  {/* Account detail & Provider */}
                  <div style={accountMainDetailsStyle}>
                    <div style={providerBadgeStyle(acc.provider)}>
                      {acc.provider.toUpperCase()}
                    </div>
                    <div style={accountNameEmailStyle}>
                      <span style={accountEmailTextStyle}>{acc.from_email}</span>
                      <span style={accountNameTextStyle}>Sender Name: {acc.from_name}</span>
                    </div>
                  </div>

                  {/* Warmup health circle & status */}
                  <div style={warmupStatusColStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor:
                            status === "warming"
                              ? "rgb(16, 185, 129)"
                              : status === "paused"
                              ? "rgb(245, 158, 11)"
                              : "hsl(var(--text-muted))",
                        }}
                      />
                      <span style={{ fontSize: "0.95rem", fontWeight: 600, textTransform: "capitalize" }}>
                        {status === "warming" ? `Warming up (Day ${daysWarming})` : status}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "hsl(var(--text-muted))" }}>
                      Health: <strong style={{ color: getHealthColor(healthScore) }}>{healthScore}%</strong>
                    </span>
                  </div>

                  {/* Mini activity stats */}
                  <div style={miniStatsGridStyle}>
                    <div style={miniStatColStyle}>
                      <span style={miniStatLabelStyle}>Sent</span>
                      <span style={miniStatValStyle}>{totals.emails_sent}</span>
                    </div>
                    <div style={miniStatColStyle}>
                      <span style={miniStatLabelStyle}>Received</span>
                      <span style={miniStatValStyle}>{totals.emails_received}</span>
                    </div>
                    <div style={miniStatColStyle}>
                      <span style={miniStatLabelStyle}>Replies</span>
                      <span style={miniStatValStyle}>{totals.replies_sent}</span>
                    </div>
                    <div style={miniStatColStyle}>
                      <span style={miniStatLabelStyle}>Inbox %</span>
                      <span style={miniStatValStyle}>
                        {totals.inbox_moved + totals.spam_found > 0
                          ? `${Math.round(
                              (totals.inbox_moved /
                                (totals.inbox_moved + totals.spam_found)) *
                                100
                            )}%`
                          : "100%"}
                      </span>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div style={accountActionsStyle}>
                    {status === "warming" ? (
                      <button
                        onClick={() => handlePauseWarmup(acc.id)}
                        className="btn btn-secondary"
                        disabled={acc.actionLoading}
                        style={{
                          fontSize: "0.85rem",
                          padding: "0.5rem 1rem",
                          height: "36px",
                          borderColor: "hsl(var(--warning) / 0.3)",
                        }}
                      >
                        {acc.actionLoading ? "Pausing..." : "⏸ Pause"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartWarmup(acc.id)}
                        className="btn btn-primary"
                        disabled={acc.actionLoading}
                        style={{
                          fontSize: "0.85rem",
                          padding: "0.5rem 1rem",
                          height: "36px",
                        }}
                      >
                        {acc.actionLoading ? "Starting..." : "🔥 Warmup"}
                      </button>
                    )}

                    <button
                      onClick={() => router.push(`/email-accounts/${acc.id}/warm-up`)}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", height: "36px" }}
                    >
                      📊 View Logs
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✉️</div>
            <h4>No email mailboxes connected yet</h4>
            <p style={{ margin: "0.5rem 0 1.5rem 0", color: "hsl(var(--text-muted))", maxWidth: "480px" }}>
              To start warming up domains, you must first connect your Gmail or Brevo SMTP sending mailboxes in Email Setup.
            </p>
            <button
              onClick={() => router.push("/email-accounts")}
              className="btn btn-primary"
            >
              🚀 Connect Mailbox
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// Inline Styles
const loadingContainerStyle: React.CSSProperties = {
  minHeight: "80vh",
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

const titleStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 700,
  marginBottom: "0.25rem",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  color: "hsl(var(--text-secondary))",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const statsSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1.5rem",
};

const summaryCardStyle: React.CSSProperties = {
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  fontWeight: 500,
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 700,
  fontFamily: "var(--font-family-heading)",
};

const panelStyle: React.CSSProperties = {
  padding: "2rem",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: "1.5rem",
  borderBottom: "1px solid var(--glass-border)",
  paddingBottom: "0.75rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
};

const listContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const accountItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1.25rem 1.75rem",
  flexWrap: "wrap",
  gap: "1.5rem",
};

const accountMainDetailsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1.25rem",
  flex: "1 1 240px",
  minWidth: "200px",
};

const providerBadgeStyle = (provider: "gmail" | "brevo"): React.CSSProperties => {
  const isGmail = provider === "gmail";
  return {
    fontSize: "9px",
    fontWeight: 700,
    padding: "0.25rem 0.6rem",
    borderRadius: "4px",
    borderWidth: "1px",
    borderStyle: "solid",
    letterSpacing: "0.05em",
    backgroundColor: isGmail ? "rgba(234, 67, 53, 0.1)" : "rgba(0, 146, 255, 0.1)",
    borderColor: isGmail ? "rgba(234, 67, 53, 0.3)" : "rgba(0, 146, 255, 0.3)",
    color: isGmail ? "rgb(234, 67, 53)" : "rgb(0, 146, 255)",
  };
};

const accountNameEmailStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
};

const accountEmailTextStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
  wordBreak: "break-all",
};

const accountNameTextStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const warmupStatusColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  flex: "0 0 160px",
};

const miniStatsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "0.75rem",
  flex: "0 0 220px",
  textAlign: "center",
};

const miniStatColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
};

const miniStatLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "hsl(var(--text-muted))",
  fontWeight: 500,
  textTransform: "uppercase",
};

const miniStatValStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--text-primary))",
  fontWeight: 600,
};

const accountActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const emptyStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "4rem 2rem",
};

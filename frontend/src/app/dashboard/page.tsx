"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface CampaignItem {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  total_leads: number;
  sent: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const isOAuthCallback = typeof window !== "undefined" && (window.location.hash.includes("access_token=") || window.location.search.includes("code="));

    const checkAuth = () => {
      const currentUser = auth.getCurrentUser();
      if (!currentUser) {
        if (!isOAuthCallback) {
          router.push("/login");
        }
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    };

    checkAuth();

    window.addEventListener("storage", checkAuth);
    window.addEventListener("credits_updated", checkAuth);

    let timeoutId: NodeJS.Timeout;
    if (isOAuthCallback) {
      timeoutId = setTimeout(() => {
        if (!auth.isAuthenticated()) {
          router.push("/login");
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("credits_updated", checkAuth);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router]);

  const fetchCampaigns = async () => {
    try {
      const data = await api.get("/api/campaigns");
      setCampaigns(data || []);
    } catch (err: any) {
      console.error("Error fetching campaigns:", err);
      setError(err.message || "Failed to load dashboard metrics.");
    }
  };

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  const handleStartCampaign = async (id: string) => {
    try {
      await api.post(`/api/campaigns/${id}/start`, {});
      fetchCampaigns();
    } catch (err: any) {
      setError(err.message || "Failed to start campaign.");
    }
  };

  const handlePauseCampaign = async (id: string) => {
    try {
      await api.post(`/api/campaigns/${id}/pause`, {});
      fetchCampaigns();
    } catch (err: any) {
      setError(err.message || "Failed to pause campaign.");
    }
  };

  // Compute aggregate metrics
  let totalSent = 0;
  let totalOpenedCount = 0;
  let totalRepliedCount = 0;
  let totalBouncedCount = 0;

  campaigns.forEach((c) => {
    totalSent += c.sent;
    totalOpenedCount += Math.round((c.open_rate * c.sent) / 100);
    totalRepliedCount += Math.round((c.reply_rate * c.sent) / 100);
    totalBouncedCount += Math.round((c.bounce_rate * c.sent) / 100);
  });

  const avgOpenRate = totalSent > 0 ? (totalOpenedCount / totalSent) * 100 : 0.0;
  const avgReplyRate = totalSent > 0 ? (totalRepliedCount / totalSent) * 100 : 0.0;
  const avgBounceRate = totalSent > 0 ? (totalBouncedCount / totalSent) * 100 : 0.0;

  // Filter for active campaigns to show on dashboard (or just show all if none are strictly 'active')
  const activeCampaigns = campaigns.filter(c => c.status === "active" || c.status === "paused");
  const campaignsToDisplay = activeCampaigns.length > 0 ? activeCampaigns : campaigns;

  if (loading || !user) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span style={loadingTextStyle}>Loading your workspace...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar Panel */}
      <Sidebar />

      {/* Main Shell */}
      <div className="main-content">
        <Navbar />

        <main className="content-pane animate-fade-in" style={mainPaneStyle}>
          {/* Welcome Section */}
          <div style={welcomeBannerStyle} className="glass-panel">
            <div style={welcomeTextsStyle}>
              <h2 style={welcomeTitleStyle}>Hello, {user.name}! 👋</h2>
              <p style={welcomeSubStyle}>
                Your outreach campaigns are performing well today. You have {user.credits} scraping credits remaining in your {user.plan} plan.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => router.push("/campaigns/new")}>
              🚀 Launch Campaign
            </button>
          </div>

          {error && (
            <div style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "hsl(var(--danger) / 10%)",
              border: "1px solid hsl(var(--danger) / 20%)",
              color: "hsl(var(--danger))",
              borderRadius: "12px",
              fontSize: "0.9rem"
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Metrics Overview Grid */}
          <div style={metricsGridStyle}>
            {/* Card 1: Sent */}
            <div className="glass-panel" style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardTitleStyle}>Emails Sent</span>
                <span style={cardIconStyle}>📤</span>
              </div>
              <div style={cardValueStyle}>{totalSent}</div>
              <div style={cardFooterStyle}>
                Lifetime outreach volume
              </div>
            </div>

            {/* Card 2: Open Rate */}
            <div className="glass-panel" style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardTitleStyle}>Avg Open Rate</span>
                <span style={cardIconStyle}>📬</span>
              </div>
              <div style={cardValueStyle}>{totalSent > 0 ? `${avgOpenRate.toFixed(1)}%` : "-"}</div>
              <div style={cardFooterStyle}>
                <span className="badge badge-success">Good health</span>
              </div>
            </div>

            {/* Card 3: Reply Rate */}
            <div className="glass-panel" style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardTitleStyle}>Avg Reply Rate</span>
                <span style={cardIconStyle}>💬</span>
              </div>
              <div style={cardValueStyle}>{totalSent > 0 ? `${avgReplyRate.toFixed(1)}%` : "-"}</div>
              <div style={cardFooterStyle}>
                Interest rate conversion
              </div>
            </div>

            {/* Card 4: Bounce Rate */}
            <div className="glass-panel" style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span style={cardTitleStyle}>Bounce Rate</span>
                <span style={cardIconStyle}>❌</span>
              </div>
              <div style={cardValueStyle}>{totalSent > 0 ? `${avgBounceRate.toFixed(1)}%` : "-"}</div>
              <div style={cardFooterStyle}>
                <span className={`badge ${avgBounceRate < 10.0 ? "badge-success" : "badge-danger"}`} style={
                  avgBounceRate < 10.0 
                    ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "rgb(16, 185, 129)", border: "1px solid rgba(16, 185, 129, 0.2)" }
                    : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "rgb(239, 68, 68)", border: "1px solid rgba(239, 68, 68, 0.2)" }
                }>
                  {avgBounceRate < 10.0 ? "Safe limit <10%" : "At Risk >10%"}
                </span>
              </div>
            </div>
          </div>

          {/* Active Campaigns Table Panel */}
          <div className="glass-panel" style={tablePanelStyle}>
            <div style={tableHeaderStyle}>
              <h3 style={tableTitleStyle}>Active Email Campaigns</h3>
              <button 
                onClick={() => router.push("/campaigns")} 
                className="btn btn-secondary" 
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                View All
              </button>
            </div>

            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderRowStyle}>
                    <th style={thStyle}>Campaign Name</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Sent</th>
                    <th style={thStyle}>Opened</th>
                    <th style={thStyle}>Replied</th>
                    <th style={thStyle}>Bounced</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignsToDisplay.length > 0 ? (
                    campaignsToDisplay.map((c) => (
                      <tr key={c.id} style={tableRowStyle}>
                        <td 
                          style={{ ...tdStyle, fontWeight: 600, color: "hsl(var(--text-primary))", cursor: "pointer" }}
                          onClick={() => router.push(`/campaigns/${c.id}`)}
                        >
                          {c.name}
                        </td>
                        <td style={tdStyle}>
                          <span className={`badge ${
                            c.status === "active" 
                              ? "badge-primary" 
                              : c.status === "paused" 
                              ? "badge-warning" 
                              : c.status === "completed" 
                              ? "badge-success" 
                              : "badge-secondary"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={tdStyle}>{c.sent}</td>
                        <td style={tdStyle}>{c.sent > 0 ? `${c.open_rate}%` : "-"}</td>
                        <td style={tdStyle}>{c.sent > 0 ? `${c.reply_rate}%` : "-"}</td>
                        <td style={tdStyle}>{c.sent > 0 ? `${c.bounce_rate}%` : "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div style={actionButtonsGroupStyle}>
                            {c.status === "active" ? (
                              <button 
                                onClick={() => handlePauseCampaign(c.id)} 
                                style={actionButtonStyle} 
                                title="Pause Campaign"
                              >
                                ⏸
                              </button>
                            ) : c.status === "paused" ? (
                              <button 
                                onClick={() => handleStartCampaign(c.id)} 
                                style={actionButtonStyle} 
                                title="Resume Campaign"
                              >
                                ▶️
                              </button>
                            ) : null}
                            <button 
                              onClick={() => router.push(`/campaigns/${c.id}`)} 
                              style={actionButtonStyle} 
                              title="Analytics"
                            >
                              📊
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--text-muted))" }}>
                        No campaigns found. Go to Campaigns or click "Launch Campaign" to get started!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Styles
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

const loadingTextStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  color: "hsl(var(--text-secondary))",
};

const mainPaneStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2rem",
};

const welcomeBannerStyle: React.CSSProperties = {
  padding: "2rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "2rem",
};

const welcomeTextsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const welcomeTitleStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "hsl(var(--text-primary))",
};

const welcomeSubStyle: React.CSSProperties = {
  color: "hsl(var(--text-secondary))",
  fontSize: "0.95rem",
  lineHeight: "1.5",
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1.5rem",
};

const cardStyle: React.CSSProperties = {
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
};

const cardIconStyle: React.CSSProperties = {
  fontSize: "1.25rem",
};

const cardValueStyle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
  fontFamily: "var(--font-family-heading)",
};

const cardFooterStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
};

const tablePanelStyle: React.CSSProperties = {
  padding: "2rem",
};

const tableHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1.5rem",
};

const tableTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
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
  borderBottom: "1px solid rgb(255 255 255 / 4%)",
  transition: "background-color 0.2s ease",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
};

const actionButtonsGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  justifyContent: "flex-end",
};

const actionButtonStyle: React.CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "6px",
  backgroundColor: "hsl(var(--bg-tertiary))",
  border: "1px solid hsl(var(--border-color))",
  color: "hsl(var(--text-primary))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: "0.8rem",
  transition: "all 0.15s ease",
};

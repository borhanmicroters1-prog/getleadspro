"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";

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

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "critical";
  is_active: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [error, setError] = useState("");
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    const checkUser = () => {
      const currentUser = auth.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      }
    };

    checkUser();

    window.addEventListener("storage", checkUser);
    window.addEventListener("credits_updated", checkUser);

    return () => {
      window.removeEventListener("storage", checkUser);
      window.removeEventListener("credits_updated", checkUser);
    };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const data = await api.get("/api/campaigns");
      setCampaigns(data || []);
    } catch (err: any) {
      console.error("Error fetching campaigns:", err);
      setError(err.message || "Failed to load dashboard metrics.");
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const data = await api.get("/api/admin/announcements/active");
      setAnnouncements(data || []);
    } catch (err) {
      console.error("Error fetching announcements:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchAnnouncements();
      if (typeof window !== "undefined") {
        const dismissed = localStorage.getItem("dismissed_announcements");
        if (dismissed) {
          try {
            setDismissedAnnouncements(JSON.parse(dismissed));
          } catch (e) {
            console.error("Failed to parse dismissed announcements:", e);
          }
        }
      }
    }
  }, [user]);

  const dismissAnnouncement = (id: string) => {
    const next = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(next);
    localStorage.setItem("dismissed_announcements", JSON.stringify(next));
  };

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
    <main className="content-pane animate-fade-in" style={mainPaneStyle}>
          {/* Active System Announcements Banner */}
          {announcements
            .filter(a => !dismissedAnnouncements.includes(a.id))
            .map(ann => {
              const bg = ann.type === "critical" 
                ? "hsl(346 84% 50% / 10%)" 
                : ann.type === "warning" 
                  ? "hsl(38 92% 50% / 10%)" 
                  : "hsl(var(--accent) / 8%)";
              const border = ann.type === "critical" 
                ? "1px solid hsl(346 84% 50% / 25%)" 
                : ann.type === "warning" 
                  ? "1px solid hsl(38 92% 50% / 25%)" 
                  : "1px solid hsl(var(--accent) / 20%)";
              const icon = ann.type === "critical" ? "🚨" : ann.type === "warning" ? "⚠️" : "📢";
              const titleColor = ann.type === "critical" 
                ? "hsl(346 84% 50%)" 
                : ann.type === "warning" 
                  ? "hsl(38 92% 50%)" 
                  : "hsl(var(--accent))";
              return (
                <div key={ann.id} className="glass-panel" style={{
                  padding: "1rem 1.5rem",
                  marginBottom: "1.25rem",
                  backgroundColor: bg,
                  border: border,
                  borderRadius: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1.5rem",
                  position: "relative",
                  animation: "slide-in 0.3s ease",
                  borderLeft: `4px solid ${titleColor}`
                }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1.25rem", flexShrink: 0, marginTop: "2px" }}>{icon}</span>
                    <div style={{ textAlign: "left" }}>
                      <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: titleColor, marginBottom: "0.2rem" }}>
                        {ann.title}
                      </h4>
                      <p style={{ fontSize: "0.82rem", color: "hsl(var(--text-secondary))", lineHeight: "1.4" }}>
                        {ann.message}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => dismissAnnouncement(ann.id)} 
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      color: "hsl(var(--text-muted))",
                      fontSize: "1.1rem",
                      cursor: "pointer",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "hsl(var(--bg-tertiary))"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              );
            })}

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

          {/* ── Your Plan & Upgrade Section ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            
            {/* Current Plan Card */}
            <div className="glass-panel" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    YOUR CURRENT PLAN
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <span style={{ fontSize: "1.75rem" }}>
                      {user.plan === "Pro" ? "🚀" : user.plan === "Starter" ? "⭐" : "🎁"}
                    </span>
                    <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "hsl(var(--text-primary))", fontFamily: "var(--font-family-heading)" }}>
                      {user.plan} Plan
                    </span>
                  </div>
                </div>
                <span style={{
                  padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700,
                  backgroundColor: user.plan === "Pro" ? "hsl(217 91% 60% / 15%)" : user.plan === "Starter" ? "hsl(38 92% 55% / 15%)" : "hsl(142 71% 45% / 15%)",
                  color: user.plan === "Pro" ? "hsl(217 91% 60%)" : user.plan === "Starter" ? "hsl(38 92% 55%)" : "hsl(142 71% 45%)",
                  border: `1px solid ${user.plan === "Pro" ? "hsl(217 91% 60% / 30%)" : user.plan === "Starter" ? "hsl(38 92% 55% / 30%)" : "hsl(142 71% 45% / 30%)"}`,
                }}>
                  {user.plan === "Free" ? "FREE TIER" : "ACTIVE"}
                </span>
              </div>

              {/* Credits usage bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.78rem", color: "hsl(var(--text-muted))" }}>Credits Remaining</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "hsl(var(--text-primary))" }}>
                    🪙 {user.credits.toLocaleString()} / {user.plan === "Pro" ? "10,000" : user.plan === "Starter" ? "2,500" : "50"}
                  </span>
                </div>
                <div style={{ height: "8px", borderRadius: "999px", backgroundColor: "hsl(var(--bg-tertiary))", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "999px", transition: "width 0.8s ease",
                    width: `${Math.min(100, (user.credits / (user.plan === "Pro" ? 10000 : user.plan === "Starter" ? 2500 : 50)) * 100)}%`,
                    background: user.credits > 0 ? "linear-gradient(90deg, hsl(142 71% 45%), hsl(160 84% 39%))" : "hsl(0 72% 60%)",
                    boxShadow: "0 0 10px hsl(142 71% 45% / 40%)",
                  }} />
                </div>
                {user.credits <= 10 && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "hsl(0 72% 60%)", fontWeight: 600 }}>
                    ⚠️ Credits almost exhausted! Upgrade or buy more credits.
                  </div>
                )}
              </div>

              {/* Plan features summary */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                {(user.plan === "Pro" ? [
                  "10,000 credits", "500 emails/day", "AI personalization", "Telegram alerts", "A/B testing"
                ] : user.plan === "Starter" ? [
                  "2,500 credits", "200 emails/day", "AI personalization", "Follow-up sequences"
                ] : [
                  "50 credits", "50 emails/day", "Gmail outreach"
                ]).map(feature => (
                  <span key={feature} style={{
                    padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 500,
                    backgroundColor: "hsl(var(--bg-tertiary))", color: "hsl(var(--text-secondary))",
                    border: "1px solid hsl(var(--border-color))",
                  }}>
                    ✓ {feature}
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "auto" }}>
                {user.plan !== "Pro" && (
                  <button 
                    className="btn btn-primary" 
                    onClick={() => router.push("/billing")}
                    style={{ flex: 1 }}
                  >
                    ⬆️ Upgrade Plan
                  </button>
                )}
                <button 
                  className="btn btn-secondary" 
                  onClick={() => router.push("/billing")}
                  style={{ flex: 1 }}
                >
                  {user.plan === "Pro" ? "🔄 Renew / Buy Credits" : "🪙 Buy Credits"}
                </button>
              </div>
            </div>

            {/* Quick Upgrade Comparison */}
            <div className="glass-panel" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {user.plan === "Pro" ? "YOUR PLAN BENEFITS" : "UPGRADE TO UNLOCK MORE"}
              </div>

              {/* Mini plan cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                {[
                  { name: "Free", icon: "🎁", price: "৳0", credits: "50", daily: "50/day", color: "hsl(142 71% 45%)", active: user.plan === "Free" },
                  { name: "Starter", icon: "⭐", price: "৳490", credits: "2,500", daily: "200/day", color: "hsl(38 92% 55%)", active: user.plan === "Starter" },
                  { name: "Pro", icon: "🚀", price: "৳1,490", credits: "10,000", daily: "500/day", color: "hsl(217 91% 60%)", active: user.plan === "Pro" },
                ].map(plan => (
                  <div key={plan.name} style={{
                    padding: "0.85rem 1.25rem", borderRadius: "12px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: plan.active ? `${plan.color}10` : "hsl(var(--bg-tertiary) / 50%)",
                    border: plan.active ? `2px solid ${plan.color}40` : "1px solid hsl(var(--border-color))",
                    transition: "all 0.2s ease",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.25rem" }}>{plan.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(var(--text-primary))" }}>
                          {plan.name}
                          {plan.active && (
                            <span style={{ marginLeft: "0.5rem", fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: "999px", backgroundColor: `${plan.color}20`, color: plan.color, fontWeight: 700 }}>
                              CURRENT
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>
                          {plan.credits} credits • {plan.daily}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: "1.1rem", color: plan.color }}>{plan.price}</div>
                      <div style={{ fontSize: "0.65rem", color: "hsl(var(--text-muted))" }}>/month</div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                className="btn btn-primary" 
                onClick={() => router.push("/billing")}
                style={{ width: "100%", marginTop: "auto" }}
              >
                {user.plan === "Pro" ? "📋 View Billing & History" : "🚀 View All Plans & Upgrade"}
              </button>
            </div>
          </div>

    </main>
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

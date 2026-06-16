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

export default function CampaignsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  const fetchCampaigns = async () => {
    try {
      const data = await api.get("/api/campaigns");
      setCampaigns(data || []);
    } catch (err: any) {
      console.error("Error fetching campaigns:", err);
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

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign? This will delete all tracking metrics.")) return;
    try {
      await api.delete(`/api/campaigns/${id}`);
      fetchCampaigns();
    } catch (err: any) {
      setError(err.message || "Failed to delete campaign.");
    }
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === "active") return "badge-primary";
    if (status === "paused") return "badge-warning";
    if (status === "completed") return "badge-success";
    return "badge-secondary";
  };

  if (loading || !user) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Header Action Row */}
          <div style={headerActionRowStyle}>
            <div style={headerTextWrapperStyle}>
              <h2 style={sectionTitleStyle}>Outreach Campaigns</h2>
              <p style={sectionSubStyle}>Automate cold emails and sequence tracking</p>
            </div>
            <button onClick={() => router.push("/campaigns/new")} className="btn btn-primary">
              🚀 Launch Campaign
            </button>
          </div>

          {error && (
            <div style={errorBannerStyle}>
              ⚠️ {error}
            </div>
          )}

          {/* Campaigns Table Panel */}
          <div className="glass-panel" style={tablePanelStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderRowStyle}>
                    <th style={thStyle}>Campaign Name</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Leads</th>
                    <th style={thStyle}>Sent</th>
                    <th style={thStyle}>Open Rate</th>
                    <th style={thStyle}>Reply Rate</th>
                    <th style={thStyle}>Bounce Rate</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length > 0 ? (
                    campaigns.map((c) => (
                      <tr key={c.id} style={tableRowStyle}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "hsl(var(--text-primary))" }}>
                          <span 
                            onClick={() => router.push(`/campaigns/${c.id}`)}
                            style={campaignLinkStyle}
                            className="campaign-link"
                          >
                            {c.name}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span className={`badge ${getStatusBadgeClass(c.status)}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={tdStyle}>{c.total_leads}</td>
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
                            ) : c.status !== "completed" ? (
                              <button 
                                onClick={() => handleStartCampaign(c.id)} 
                                style={actionButtonStyle} 
                                title="Start Campaign"
                              >
                                ▶️
                              </button>
                            ) : null}
                            <button 
                              onClick={() => router.push(`/campaigns/${c.id}`)} 
                              style={actionButtonStyle} 
                              title="View Analytics"
                            >
                              📊
                            </button>
                            <button 
                              onClick={() => handleDeleteCampaign(c.id)} 
                              style={{ ...actionButtonStyle, color: "hsl(var(--danger))" }} 
                              title="Delete Campaign"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={noDataTdStyle}>
                        No campaigns created yet. Click "Launch Campaign" to build your first cold outreach sequence!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
  );
}

// Inline Styles
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

const headerActionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1.5rem",
};

const headerTextWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "hsl(var(--text-primary))",
};

const sectionSubStyle: React.CSSProperties = {
  color: "hsl(var(--text-secondary))",
  fontSize: "0.9rem",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const tablePanelStyle: React.CSSProperties = {
  padding: "2rem",
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
  borderBottom: "1px solid hsl(var(--border-color))",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
};

const campaignLinkStyle: React.CSSProperties = {
  cursor: "pointer",
  transition: "color 0.2s ease",
  textDecoration: "none",
};

const noDataTdStyle: React.CSSProperties = {
  padding: "3rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
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
  fontSize: "0.85rem",
  transition: "all 0.15s ease",
};

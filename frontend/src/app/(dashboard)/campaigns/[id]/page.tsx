"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
interface LeadItem {
  id: string;
  name: string;
  email: string;
  company: string;
  campaign_lead_id: string;
  delivery_status: "pending" | "sent" | "opened" | "replied" | "bounced";
  sent_count: number;
  last_sent_at: string | null;
  assigned_subject: "a" | "b";
}

interface CampaignMetadata {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  subject_a: string;
  subject_b: string | null;
  body_template: string;
  follow_up_1_days: number | null;
  follow_up_1_body: string | null;
  follow_up_2_days: number | null;
  follow_up_2_body: string | null;
  send_start_hour: number;
  send_end_hour: number;
  timezone: string;
  created_at: string;
  started_at: string | null;
}

interface AnalyticsKPIs {
  total_leads: number;
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  open_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignMetadata | null>(null);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsKPIs | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"overview" | "leads">("overview");

  // Load User Authentication
  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  // Load Campaign and Lead lists
  const fetchCampaignDetails = async () => {
    try {
      const data = await api.get(`/api/campaigns/${id}`);
      setCampaign(data.campaign);
      setLeads(data.leads || []);
      setAnalytics(data.analytics);
    } catch (err: any) {
      console.error("Error fetching campaign details:", err);
      setError(err.message || "Failed to load campaign statistics.");
    }
  };

  useEffect(() => {
    if (user && id) {
      fetchCampaignDetails();
    }
  }, [user, id]);

  const handleStartCampaign = async () => {
    try {
      setError("");
      setSuccessMsg("");
      await api.post(`/api/campaigns/${id}/start`, {});
      setSuccessMsg("Campaign started successfully.");
      fetchCampaignDetails();
    } catch (err: any) {
      setError(err.message || "Failed to start campaign.");
    }
  };

  const handlePauseCampaign = async () => {
    try {
      setError("");
      setSuccessMsg("");
      await api.post(`/api/campaigns/${id}/pause`, {});
      setSuccessMsg("Campaign paused successfully.");
      fetchCampaignDetails();
    } catch (err: any) {
      setError(err.message || "Failed to pause campaign.");
    }
  };

  const handleDeleteCampaign = async () => {
    if (!confirm("Are you sure you want to delete this campaign? This cannot be undone and will delete all analytics records.")) return;
    try {
      setError("");
      await api.delete(`/api/campaigns/${id}`);
      router.push("/campaigns");
    } catch (err: any) {
      setError(err.message || "Failed to delete campaign.");
    }
  };

  // Helper formatting values
  const getStatusBadge = (status: string) => {
    if (status === "active") return <span className="badge badge-primary">Active</span>;
    if (status === "paused") return <span className="badge badge-warning">Paused</span>;
    if (status === "completed") return <span className="badge badge-success">Completed</span>;
    return <span className="badge" style={{ border: "1px solid hsl(var(--border-color))", color: "hsl(var(--text-muted))" }}>Draft</span>;
  };

  const getLeadStatusBadge = (status: string) => {
    if (status === "sent") return <span className="badge" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "hsl(var(--accent))", border: "1px solid rgba(16, 185, 129, 0.3)" }}>Sent</span>;
    if (status === "opened") return <span className="badge" style={{ backgroundColor: "rgba(186, 100, 48, 0.15)", color: "hsl(var(--accent-cyan))", border: "1px solid rgba(186, 100, 48, 0.3)" }}>Opened</span>;
    if (status === "replied") return <span className="badge badge-success">Replied</span>;
    if (status === "bounced") return <span className="badge badge-danger">Bounced</span>;
    return <span className="badge" style={{ border: "1px solid hsl(var(--border-color))", color: "hsl(var(--text-muted))" }}>Pending</span>;
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  // Compute A/B Split stats
  const abTestStats = {
    a: { total: 0, sent: 0, opened: 0, replied: 0, bounced: 0 },
    b: { total: 0, sent: 0, opened: 0, replied: 0, bounced: 0 }
  };

  leads.forEach((l) => {
    const version = l.assigned_subject === "b" ? "b" : "a";
    abTestStats[version].total += 1;
    if (l.delivery_status !== "pending") {
      abTestStats[version].sent += 1;
    }
    if (l.delivery_status === "opened" || l.delivery_status === "replied") {
      abTestStats[version].opened += 1;
    }
    if (l.delivery_status === "replied") {
      abTestStats[version].replied += 1;
    }
    if (l.delivery_status === "bounced") {
      abTestStats[version].bounced += 1;
    }
  });

  const getRates = (stats: typeof abTestStats.a) => {
    const openRate = stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0.0;
    const replyRate = stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0.0;
    const bounceRate = stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0.0;
    return { openRate, replyRate, bounceRate };
  };

  const ratesA = getRates(abTestStats.a);
  const ratesB = getRates(abTestStats.b);

  // Filtered Leads list
  const filteredLeads = leads.filter((l) => {
    const matchesSearch = 
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.company && l.company.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || l.delivery_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading || !user || !campaign || !analytics) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading Campaign Analytics...</span>
      </div>
    );
  }

  return (
    
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Breadcrumb & Navigation */}
          <div style={breadcrumbRowStyle}>
            <span onClick={() => router.push("/campaigns")} style={breadcrumbLinkStyle}>
              ← Back to Campaigns
            </span>
          </div>

          {/* Campaign Header Profile Row */}
          <div style={headerActionRowStyle}>
            <div style={headerTextWrapperStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <h2 style={sectionTitleStyle}>{campaign.name}</h2>
                {getStatusBadge(campaign.status)}
              </div>
              <p style={sectionSubStyle}>
                Created on {new Date(campaign.created_at).toLocaleDateString()} 
                {campaign.started_at && ` • Started on ${new Date(campaign.started_at).toLocaleDateString()}`}
              </p>
            </div>
            
            <div style={headerActionsWrapperStyle}>
              {campaign.status === "active" ? (
                <button onClick={handlePauseCampaign} className="btn btn-secondary" style={{ color: "hsl(var(--warning))" }}>
                  ⏸ Pause Campaign
                </button>
              ) : campaign.status !== "completed" ? (
                <button onClick={handleStartCampaign} className="btn btn-primary">
                  ▶️ Start Outreach
                </button>
              ) : null}
              <button 
                onClick={handleDeleteCampaign} 
                className="btn btn-secondary" 
                style={{ color: "hsl(var(--danger))", borderColor: "hsl(var(--danger) / 20%)" }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          {error && <div style={errorBannerStyle}>⚠️ {error}</div>}
          {successMsg && <div style={successBannerStyle}>✓ {successMsg}</div>}

          {/* Tab Navigation Controls */}
          <div style={tabBarContainerStyle}>
            <div 
              onClick={() => setActiveTab("overview")} 
              style={{
                ...tabStyle,
                color: activeTab === "overview" ? "hsl(var(--accent))" : "hsl(var(--text-secondary))",
                borderBottomColor: activeTab === "overview" ? "hsl(var(--accent))" : "transparent"
              }}
            >
              📊 Performance Dashboard
            </div>
            <div 
              onClick={() => setActiveTab("leads")} 
              style={{
                ...tabStyle,
                color: activeTab === "leads" ? "hsl(var(--accent))" : "hsl(var(--text-secondary))",
                borderBottomColor: activeTab === "leads" ? "hsl(var(--accent))" : "transparent"
              }}
            >
              👥 Target Prospects ({leads.length})
            </div>
          </div>

          {/* Tab Content 1: Overview */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              
              {/* Analytics KPI Dashboard Grid */}
              <div style={metricsGridStyle}>
                <div className="glass-panel" style={kpiCardStyle}>
                  <div style={kpiHeaderStyle}>
                    <span style={kpiTitleStyle}>Total Leads</span>
                    <span>👥</span>
                  </div>
                  <div style={kpiValueStyle}>{analytics.total_leads}</div>
                  <div style={kpiFooterStyle}>Assigned prospects</div>
                </div>

                <div className="glass-panel" style={kpiCardStyle}>
                  <div style={kpiHeaderStyle}>
                    <span style={kpiTitleStyle}>Emails Sent</span>
                    <span>📤</span>
                  </div>
                  <div style={kpiValueStyle}>{analytics.sent}</div>
                  <div style={kpiFooterStyle}>
                    {analytics.total_leads > 0 
                      ? `${((analytics.sent / analytics.total_leads) * 100).toFixed(0)}% delivery progress` 
                      : "0% complete"}
                  </div>
                </div>

                <div className="glass-panel" style={kpiCardStyle}>
                  <div style={kpiHeaderStyle}>
                    <span style={kpiTitleStyle}>Open Rate</span>
                    <span>📬</span>
                  </div>
                  <div style={kpiValueStyle}>{analytics.sent > 0 ? `${analytics.open_rate}%` : "-"}</div>
                  <div style={kpiFooterStyle}>
                    {analytics.opened} total opens
                  </div>
                </div>

                <div className="glass-panel" style={kpiCardStyle}>
                  <div style={kpiHeaderStyle}>
                    <span style={kpiTitleStyle}>Reply Rate</span>
                    <span>💬</span>
                  </div>
                  <div style={kpiValueStyle}>{analytics.sent > 0 ? `${analytics.reply_rate}%` : "-"}</div>
                  <div style={kpiFooterStyle}>
                    {analytics.replied} total replies
                  </div>
                </div>

                <div className="glass-panel" style={kpiCardStyle}>
                  <div style={kpiHeaderStyle}>
                    <span style={kpiTitleStyle}>Bounce Rate</span>
                    <span>❌</span>
                  </div>
                  <div style={{
                    ...kpiValueStyle,
                    color: analytics.bounce_rate >= 10.0 ? "hsl(var(--danger))" : "hsl(var(--text-primary))"
                  }}>{analytics.sent > 0 ? `${analytics.bounce_rate}%` : "-"}</div>
                  <div style={kpiFooterStyle}>
                    {analytics.bounced} bounces
                  </div>
                </div>
              </div>

              {/* Grid with A/B test results and Config parameters */}
              <div style={gridRowStyle}>
                
                {/* A/B Test Metrics Comparison Panel (If enabled or if leads version is present) */}
                <div className="glass-panel" style={{ ...panelStyle, flex: 1.2 }}>
                  <h3 style={panelTitleStyle}>A/B Split Test Analysis</h3>
                  
                  {campaign.subject_b ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}>
                      
                      {/* Version A card */}
                      <div style={abVersionWrapperStyle}>
                        <div style={abVersionHeaderStyle}>
                          <span style={abVersionLabelStyle}>Version A: {campaign.subject_a}</span>
                          <span style={abVersionCountStyle}>{abTestStats.a.sent} sent ({abTestStats.a.total} total)</span>
                        </div>
                        <div style={abProgressBarGridStyle}>
                          <div style={abProgressItemStyle}>
                            <span style={abProgressLabelStyle}>Open Rate ({ratesA.openRate.toFixed(1)}%)</span>
                            <div style={progressBgStyle}>
                              <div style={{ ...progressFillStyle, width: `${ratesA.openRate}%`, backgroundColor: "hsl(var(--accent-cyan))" }} />
                            </div>
                          </div>
                          <div style={abProgressItemStyle}>
                            <span style={abProgressLabelStyle}>Reply Rate ({ratesA.replyRate.toFixed(1)}%)</span>
                            <div style={progressBgStyle}>
                              <div style={{ ...progressFillStyle, width: `${ratesA.replyRate}%`, backgroundColor: "hsl(var(--success))" }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Version B card */}
                      <div style={abVersionWrapperStyle}>
                        <div style={abVersionHeaderStyle}>
                          <span style={abVersionLabelStyle}>Version B: {campaign.subject_b}</span>
                          <span style={abVersionCountStyle}>{abTestStats.b.sent} sent ({abTestStats.b.total} total)</span>
                        </div>
                        <div style={abProgressBarGridStyle}>
                          <div style={abProgressItemStyle}>
                            <span style={abProgressLabelStyle}>Open Rate ({ratesB.openRate.toFixed(1)}%)</span>
                            <div style={progressBgStyle}>
                              <div style={{ ...progressFillStyle, width: `${ratesB.openRate}%`, backgroundColor: "hsl(var(--accent-cyan))" }} />
                            </div>
                          </div>
                          <div style={abProgressItemStyle}>
                            <span style={abProgressLabelStyle}>Reply Rate ({ratesB.replyRate.toFixed(1)}%)</span>
                            <div style={progressBgStyle}>
                              <div style={{ ...progressFillStyle, width: `${ratesB.replyRate}%`, backgroundColor: "hsl(var(--success))" }} />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "hsl(var(--text-muted))" }}>
                      💡 A/B Split testing is not enabled for this campaign. Split testing allows you to test two subject lines and evaluate their conversion rates.
                    </div>
                  )}
                </div>

                {/* Configuration panel */}
                <div className="glass-panel" style={{ ...panelStyle, flex: 0.8 }}>
                  <h3 style={panelTitleStyle}>Campaign Settings</h3>
                  <div style={configListStyle}>
                    
                    <div style={configItemStyle}>
                      <span style={configLabelStyle}>Sending Schedule</span>
                      <span style={configValueStyle}>
                        {formatHour(campaign.send_start_hour)} - {formatHour(campaign.send_end_hour)} ({campaign.timezone})
                      </span>
                    </div>

                    <div style={configItemStyle}>
                      <span style={configLabelStyle}>Follow-up Sequences</span>
                      <span style={configValueStyle}>
                        {campaign.follow_up_1_days ? (
                          <span>
                            • Step 2: Send follow-up after {campaign.follow_up_1_days} days
                            {campaign.follow_up_2_days && <br />}
                            {campaign.follow_up_2_days && `• Step 3: Send second follow-up after ${campaign.follow_up_2_days} days`}
                          </span>
                        ) : (
                          "No automated follow-up sequences configured"
                        )}
                      </span>
                    </div>

                    <div style={configItemStyle}>
                      <span style={configLabelStyle}>Primary Subject Line (A)</span>
                      <span style={{ ...configValueStyle, fontFamily: "monospace", fontSize: "12px", background: "rgb(255 255 255 / 3%)", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                        {campaign.subject_a}
                      </span>
                    </div>

                    {campaign.subject_b && (
                      <div style={configItemStyle}>
                        <span style={configLabelStyle}>Subject Line B</span>
                        <span style={{ ...configValueStyle, fontFamily: "monospace", fontSize: "12px", background: "rgb(255 255 255 / 3%)", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                          {campaign.subject_b}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Template Preview Box */}
              <div className="glass-panel" style={panelStyle}>
                <h3 style={panelTitleStyle}>Email Draft Template Preview</h3>
                <div style={previewBoxContainerStyle}>
                  <div style={previewHeaderStyle}>
                    <span style={previewTitleStyle}>Body Template Outline</span>
                    <span style={{ fontSize: "11px", color: "hsl(var(--text-muted))" }}>Variables will be substituted with target lead attributes</span>
                  </div>
                  <div style={previewBodyContentStyle}>
                    {campaign.body_template}
                  </div>
                </div>

                {/* Follow-up previews */}
                {campaign.follow_up_1_body && (
                  <div style={{ ...previewBoxContainerStyle, marginTop: "1.5rem" }}>
                    <div style={previewHeaderStyle}>
                      <span style={previewTitleStyle}>Follow-up Step 1 Template (After {campaign.follow_up_1_days} days)</span>
                    </div>
                    <div style={previewBodyContentStyle}>
                      {campaign.follow_up_1_body}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Tab Content 2: Leads List */}
          {activeTab === "leads" && (
            <div className="glass-panel" style={panelStyle}>
              {/* Filter controls row */}
              <div style={tableControlsRowStyle}>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                  <input 
                    type="text" 
                    placeholder="🔍 Search prospects by name, email, company..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field"
                    style={{ maxWidth: "320px", fontSize: "0.85rem" }}
                  />

                  <div style={filterSelectGroupStyle}>
                    <span style={{ fontSize: "13px", color: "hsl(var(--text-muted))" }}>Filter Status:</span>
                    <select 
                      value={statusFilter} 
                      onChange={(e) => setStatusFilter(e.target.value)} 
                      className="input-field"
                      style={{ maxWidth: "160px", padding: "0.5rem 0.75rem", fontSize: "0.85rem", cursor: "pointer" }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="sent">Sent</option>
                      <option value="opened">Opened</option>
                      <option value="replied">Replied</option>
                      <option value="bounced">Bounced</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={() => router.push(`/leads/upload?campaign_id=${campaign.id}`)}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", padding: "0.6rem 1.2rem", height: "38px" }}
                >
                  📤 Upload CSV for Campaign
                </button>
              </div>

              {/* Leads Status Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={tableHeaderRowStyle}>
                      <th style={thStyle}>Lead Contact</th>
                      <th style={thStyle}>Company</th>
                      <th style={thStyle}>Delivery Status</th>
                      <th style={thStyle}>Version</th>
                      <th style={thStyle}>Mails Sent</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Last Sent Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map((l) => (
                        <tr key={l.id} style={tableRowStyle}>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600, color: "hsl(var(--text-primary))" }}>{l.name}</span>
                              <span style={{ fontSize: "12px", color: "hsl(var(--text-muted))" }}>{l.email}</span>
                            </div>
                          </td>
                          <td style={tdStyle}>{l.company || "-"}</td>
                          <td style={tdStyle}>{getLeadStatusBadge(l.delivery_status)}</td>
                          <td style={tdStyle}>
                            <span style={{ 
                              fontSize: "11px", 
                              fontWeight: 600,
                              color: l.assigned_subject === "b" ? "hsl(var(--accent-secondary))" : "hsl(var(--accent))",
                              background: l.assigned_subject === "b" ? "hsl(var(--accent-secondary) / 8%)" : "hsl(var(--accent) / 8%)",
                              padding: "0.15rem 0.4rem",
                              borderRadius: "4px",
                              border: l.assigned_subject === "b" ? "1px solid hsl(var(--accent-secondary) / 15%)" : "1px solid hsl(var(--accent) / 15%)"
                            }}>
                              Subject {l.assigned_subject.toUpperCase()}
                            </span>
                          </td>
                          <td style={tdStyle}>{l.sent_count}</td>
                          <td style={{ ...tdStyle, textAlign: "right", color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                            {l.last_sent_at ? new Date(l.last_sent_at).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={noDataTdStyle}>
                          No prospects match your search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
  );
}

// Inline styles
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

const breadcrumbRowStyle: React.CSSProperties = {
  display: "flex",
  marginBottom: "-0.5rem",
};

const breadcrumbLinkStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: "0.85rem",
  color: "hsl(var(--text-muted))",
  transition: "color 0.2s ease",
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

const headerActionsWrapperStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
};

const errorBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--danger) / 10%)",
  border: "1px solid hsl(var(--danger) / 20%)",
  color: "hsl(var(--danger))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const successBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--success) / 10%)",
  border: "1px solid hsl(var(--success) / 20%)",
  color: "hsl(var(--success))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const tabBarContainerStyle: React.CSSProperties = {
  display: "flex",
  borderBottom: "1px solid hsl(var(--border-color))",
  gap: "2rem",
};

const tabStyle: React.CSSProperties = {
  paddingBottom: "0.85rem",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
  borderBottom: "2px solid transparent",
  transition: "all 0.2s ease",
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1.5rem",
};

const kpiCardStyle: React.CSSProperties = {
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const kpiHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "hsl(var(--text-secondary))",
  fontSize: "0.85rem",
};

const kpiTitleStyle: React.CSSProperties = {
  fontWeight: 500,
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "hsl(var(--text-primary))",
};

const kpiFooterStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
};

const gridRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  flexWrap: "wrap",
};

const panelStyle: React.CSSProperties = {
  padding: "2rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "1.25rem",
};

const configListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const configItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const configLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const configValueStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.4",
};

const abVersionWrapperStyle: React.CSSProperties = {
  padding: "1.25rem",
  background: "var(--card-bg-alt)",
  border: "1px solid var(--glass-border)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const abVersionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "0.5rem",
};

const abVersionLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.9rem",
  color: "hsl(var(--text-primary))",
};

const abVersionCountStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "hsl(var(--text-muted))",
};

const abProgressBarGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "1rem",
};

const abProgressItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const abProgressLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "hsl(var(--text-muted))",
  fontWeight: 500,
};

const progressBgStyle: React.CSSProperties = {
  height: "6px",
  width: "100%",
  backgroundColor: "var(--card-bg-alt)",
  borderRadius: "3px",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "3px",
};

const previewBoxContainerStyle: React.CSSProperties = {
  border: "1px solid hsl(var(--border-color))",
  borderRadius: "12px",
  overflow: "hidden",
  background: "hsl(var(--bg-primary))",
};

const previewHeaderStyle: React.CSSProperties = {
  padding: "0.75rem 1.25rem",
  borderBottom: "1px solid hsl(var(--border-color))",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "var(--card-bg-alt)",
};

const previewTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.85rem",
  color: "hsl(var(--accent-cyan))",
};

const previewBodyContentStyle: React.CSSProperties = {
  padding: "1.25rem",
  fontSize: "0.9rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.6",
  whiteSpace: "pre-wrap",
};

const tableControlsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1rem",
  marginBottom: "1.5rem",
};

const filterSelectGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
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

const noDataTdStyle: React.CSSProperties = {
  padding: "3rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
};

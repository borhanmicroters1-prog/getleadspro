"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
interface LeadItem {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  website: string;
  source: string;
  campaign_name?: string;
  status: string;
  title?: string;
  created_at: string;
}

export default function LeadsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  // Search & Filters
  const [searchVal, setSearchVal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [campaignFilter, setCampaignFilter] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Clear selection on page/filter change
  useEffect(() => {
    setSelectedIds([]);
  }, [page, searchQuery, sourceFilter, statusFilter, campaignFilter]);

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);

      // Fetch user projects/groups
      api.get("/api/leads/projects")
        .then((data) => setProjects(data || []))
        .catch((err) => console.error("Error fetching projects:", err));
    }
  }, [router]);

  const fetchLeads = async () => {
    try {
      const data = await api.get("/api/leads", {
        page,
        limit,
        search: searchQuery,
        source: sourceFilter,
        status_filter: statusFilter,
        campaign: campaignFilter || undefined,
      });
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user, page, searchQuery, sourceFilter, statusFilter, campaignFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchVal);
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/leads/${id}`);
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      fetchLeads();
    } catch (err: any) {
      alert("Failed to delete lead: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected leads?`)) return;
    setIsBulkDeleting(true);
    try {
      await api.post("/api/leads/bulk-delete", { lead_ids: selectedIds });
      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      alert("Failed to delete leads: " + err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete ALL leads in your database? This action cannot be undone and will reset your lead count.")) return;
    setIsBulkDeleting(true);
    try {
      await api.delete("/api/leads/clear-all");
      setSelectedIds([]);
      setPage(1);
      fetchLeads();
    } catch (err: any) {
      alert("Failed to clear database: " + err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await api.download("/api/leads/export", {
        search: searchQuery,
        source: sourceFilter,
        status_filter: statusFilter,
        campaign: campaignFilter || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      alert("Failed to export leads: " + err.message);
    }
  };

  const getSourceBadgeClass = (source: string) => {
    if (source === "google_maps") return "badge-primary";
    if (source === "facebook_ads") return "badge-warning";
    return "badge-success";
  };

  const getStatusBadgeStyle = (status: string) => {
    const baseStyle = { fontSize: "11px", textTransform: "capitalize" as const };
    switch (status) {
      case "new":
        return { ...baseStyle, backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)" };
      case "contacted":
        return { ...baseStyle, backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.3)" };
      case "replied":
        return { ...baseStyle, backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" };
      case "bounced":
        return { ...baseStyle, backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" };
      case "unsubscribed":
        return { ...baseStyle, backgroundColor: "rgba(107, 114, 128, 0.15)", color: "#6b7280", border: "1px solid rgba(107, 114, 128, 0.3)" };
      default:
        return { ...baseStyle, backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" };
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

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
              <h2 style={sectionTitleStyle}>Leads Directory</h2>
              <p style={sectionSubStyle}>Manage, filter, export or upload leads in your database</p>
            </div>
            <div style={headerButtonsGroupStyle}>
              {selectedIds.length > 0 ? (
                <button 
                  onClick={handleBulkDelete} 
                  className="btn" 
                  style={{ 
                    backgroundColor: "hsl(var(--danger) / 15%)", 
                    borderColor: "hsl(var(--danger) / 30%)", 
                    color: "hsl(var(--danger))",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}
                  disabled={isBulkDeleting}
                >
                  {isBulkDeleting ? "Deleting..." : `🗑️ Delete Selected (${selectedIds.length})`}
                </button>
              ) : (
                total > 0 && (
                  <button 
                    onClick={handleClearAll} 
                    className="btn btn-secondary" 
                    style={{ 
                      color: "hsl(var(--danger))", 
                      borderColor: "hsl(var(--danger) / 20%)" 
                    }}
                    disabled={isBulkDeleting}
                  >
                    🗑️ Clear All
                  </button>
                )
              )}
              <button onClick={handleExportCSV} className="btn btn-secondary" disabled={leads.length === 0}>
                📥 Export CSV
              </button>
              <button onClick={() => router.push("/leads/upload")} className="btn btn-primary">
                📤 Upload CSV
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="glass-panel" style={filtersPanelStyle}>
            <form onSubmit={handleSearchSubmit} style={searchFormStyle}>
              <input 
                type="text" 
                placeholder="Search by name, email or company..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="input-field"
                style={{ flex: 1, minWidth: "200px" }}
              />
              <button type="submit" className="btn btn-secondary" style={{ whiteSpace: "nowrap" }}>
                🔍 Search
              </button>
            </form>

            <div style={selectFiltersGroupStyle}>
              <select 
                value={campaignFilter} 
                onChange={(e) => { setPage(1); setCampaignFilter(e.target.value); }}
                className="input-field"
                style={selectStyle}
              >
                <option value="">All Groups</option>
                {projects.map((proj) => (
                  <option key={proj} value={proj}>
                    📁 {proj}
                  </option>
                ))}
              </select>

              <select 
                value={sourceFilter} 
                onChange={(e) => { setPage(1); setSourceFilter(e.target.value); }}
                className="input-field"
                style={selectStyle}
              >
                <option value="">All Sources</option>
                <option value="google_maps">Google Maps Scraper</option>
                <option value="facebook_ads">FB Ads Scraper</option>
                <option value="csv_upload">CSV Upload</option>
              </select>

              <select 
                value={statusFilter} 
                onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
                className="input-field"
                style={selectStyle}
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="bounced">Bounced</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="ooo">Out of Office</option>
              </select>
            </div>
          </div>

          {/* Leads Table Panel */}
          <div className="glass-panel" style={tablePanelStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderRowStyle}>
                    <th style={{ ...thStyle, width: "40px", paddingRight: 0 }}>
                      <input 
                        type="checkbox" 
                        checked={leads.length > 0 && selectedIds.length === leads.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(leads.map(l => l.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                    </th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Website</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length > 0 ? (
                    leads.map((l) => (
                      <tr key={l.id} style={tableRowStyle}>
                        <td style={{ padding: "1rem", paddingRight: 0, width: "40px" }}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(l.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => [...prev, l.id]);
                              } else {
                                setSelectedIds(prev => prev.filter(id => id !== l.id));
                              }
                            }}
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          />
                        </td>
                        <td style={{ ...tdStyle, color: "hsl(var(--text-primary))", fontWeight: 500 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <span>{l.name || "-"}</span>
                            {l.title && (
                              <span style={{ 
                                fontSize: "11px", 
                                color: "hsl(var(--text-muted))", 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "0.25rem",
                                fontWeight: 400
                              }}>
                                💼 {l.title}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>{l.email}</td>
                        <td style={tdStyle}>{l.company || "-"}</td>
                        <td style={tdStyle}>{l.phone || "-"}</td>
                        <td style={tdStyle}>
                          {l.website ? (
                            <a href={l.website} target="_blank" rel="noopener noreferrer" style={{ color: "hsl(var(--accent))" }}>
                              {l.website.replace("https://", "").replace("http://", "")}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-start" }}>
                            <span className={`badge ${getSourceBadgeClass(l.source)}`} style={{ fontSize: "10px" }}>
                              {l.source.replace("_", " ")}
                            </span>
                            {l.campaign_name && (
                              <span style={{ fontSize: "11px", color: "hsl(var(--text-muted))", display: "inline-flex", alignItems: "center", gap: "0.25rem" }} title={`Group: ${l.campaign_name}`}>
                                📁 {l.campaign_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span className="badge" style={getStatusBadgeStyle(l.status)}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button 
                            onClick={() => handleDeleteLead(l.id)} 
                            style={deleteButtonStyle}
                            disabled={deletingId === l.id}
                            title="Delete Lead"
                          >
                            {deletingId === l.id ? "..." : "🗑️"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={noDataTdStyle}>
                        No leads found. Scrape some leads or upload a CSV to get started!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={paginationWrapperStyle}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  className="btn btn-secondary"
                  style={paginationBtnStyle}
                >
                  Previous
                </button>
                <span style={paginationInfoStyle}>
                  Page <strong>{page}</strong> of {totalPages} ({total} total)
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                  className="btn btn-secondary"
                  style={paginationBtnStyle}
                >
                  Next
                </button>
              </div>
            )}
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

const headerButtonsGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
};

const filtersPanelStyle: React.CSSProperties = {
  padding: "1.25rem 2rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1.5rem",
};

const searchFormStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flex: 1,
  maxWidth: "500px",
};

const selectFiltersGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "1rem",
  flexWrap: "wrap",
};

const selectStyle: React.CSSProperties = {
  width: "180px",
  cursor: "pointer",
  backgroundColor: "hsl(var(--bg-tertiary))",
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

const noDataTdStyle: React.CSSProperties = {
  padding: "3rem",
  textAlign: "center",
  color: "hsl(var(--text-muted))",
  fontSize: "0.95rem",
};

const deleteButtonStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "none",
  color: "hsl(var(--danger))",
  cursor: "pointer",
  fontSize: "1.1rem",
  opacity: 0.8,
  transition: "opacity 0.2s ease",
  padding: "0.25rem",
};

const paginationWrapperStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "1.5rem",
  paddingTop: "1.5rem",
  borderTop: "1px solid hsl(var(--border-color))",
};

const paginationBtnStyle: React.CSSProperties = {
  padding: "0.5rem 1.25rem",
  fontSize: "0.85rem",
};

const paginationInfoStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
};

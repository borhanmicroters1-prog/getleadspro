"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, UserProfile } from "@/utils/auth";
import { api } from "@/utils/api";
interface BlacklistItem {
  id: string;
  type: "email" | "domain";
  value: string;
  reason: string;
  created_at: string;
}

export default function BlacklistPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BlacklistItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add Form state
  const [addValue, setAddValue] = useState("");
  const [addType, setAddType] = useState<"email" | "domain">("email");
  const [addReason, setAddReason] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Import CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
      setLoading(false);
    }
  }, [router]);

  const fetchBlacklist = async () => {
    try {
      const data = await api.get("/api/blacklist", { search: searchQuery });
      setItems(data || []);
    } catch (err: any) {
      console.error("Error fetching blacklist:", err);
      setError(err.message || "Failed to load blacklist entries.");
    }
  };

  useEffect(() => {
    if (user) {
      fetchBlacklist();
    }
  }, [user, searchQuery]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addValue.trim()) return;

    setIsAdding(true);
    setError("");
    setSuccess("");

    try {
      const entry = await api.post("/api/blacklist", {
        type: addType,
        value: addValue.trim(),
        reason: addReason.trim() || "Manual entry",
      });

      setSuccess(`"${addValue}" has been added to your blacklist.`);
      setAddValue("");
      setAddReason("");
      fetchBlacklist();
    } catch (err: any) {
      setError(err.message || "Failed to add entry.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveEntry = async (id: string, value: string) => {
    if (!confirm(`Are you sure you want to remove "${value}" from the blacklist?`)) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/api/blacklist/${id}`);
      setSuccess(`"${value}" was removed from the blacklist.`);
      fetchBlacklist();
    } catch (err: any) {
      setError(err.message || "Failed to remove entry.");
    }
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setIsImporting(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const result = await api.post("/api/blacklist/import", formData, { isMultipart: true });
      setSuccess(result.message || "CSV entries imported successfully.");
      setCsvFile(null);
      // Reset input element
      const fileInput = document.getElementById("csv-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      fetchBlacklist();
    } catch (err: any) {
      setError(err.message || "Failed to import CSV.");
    } finally {
      setIsImporting(false);
    }
  };

  if (loading || !user) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading Blacklist...</span>
      </div>
    );
  }

  return (
    
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Header */}
          <div style={headerActionRowStyle}>
            <div style={headerTextWrapperStyle}>
              <h2 style={sectionTitleStyle}>Do Not Contact List (Blacklist)</h2>
              <p style={sectionSubStyle}>Prevent outreach emails from sending to specific domains or contacts</p>
            </div>
          </div>

          {error && <div style={errorBannerStyle}>⚠️ {error}</div>}
          {success && <div style={successBannerStyle}>✓ {success}</div>}

          {/* Form Actions Row */}
          <div style={formGridStyle}>
            
            {/* Add single entry form */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>➕ Add Blacklist Rule</h3>
              <form onSubmit={handleAddEntry} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
                
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Target Rule Value</label>
                  <input 
                    type="text" 
                    value={addValue} 
                    onChange={(e) => setAddValue(e.target.value)} 
                    placeholder="e.g. spam-target@email.com or competitor.com" 
                    className="input-field" 
                    required 
                  />
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Rule Type</label>
                  <select 
                    value={addType} 
                    onChange={(e) => setAddType(e.target.value as any)} 
                    className="input-field"
                    style={{ cursor: "pointer" }}
                  >
                    <option value="email">Specific Email Address</option>
                    <option value="domain">Entire Domain Address</option>
                  </select>
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Reason / Notes</label>
                  <textarea 
                    value={addReason} 
                    onChange={(e) => setAddReason(e.target.value)} 
                    placeholder="e.g. Requested opt-out / Competitor domain" 
                    className="input-field" 
                    style={{ height: "60px", resize: "none", fontSize: "0.85rem" }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isAdding || !addValue.trim()} 
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                >
                  {isAdding ? "Adding..." : "Add to Blacklist"}
                </button>
              </form>
            </div>

            {/* CSV Import form */}
            <div className="glass-panel" style={panelStyle}>
              <h3 style={panelTitleStyle}>📤 Bulk Import via CSV</h3>
              <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", lineHeight: 1.5, marginBottom: "1rem" }}>
                Upload a CSV sheet to import domains and email addresses in bulk. Column headers should include <code>value</code> or <code>email</code>.
              </p>
              
              <form onSubmit={handleImportCsv} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "0.5rem" }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Choose CSV File</label>
                  <input 
                    type="file" 
                    id="csv-file-input"
                    accept=".csv" 
                    onChange={handleCsvChange} 
                    className="input-field" 
                    style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                    required 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isImporting || !csvFile} 
                  className="btn btn-secondary"
                  style={{ width: "100%" }}
                >
                  {isImporting ? "Processing CSV..." : "Upload & Import CSV"}
                </button>
              </form>
            </div>

          </div>

          {/* Blacklist Table Directory */}
          <div className="glass-panel" style={tablePanelStyle}>
            <div style={tableHeaderStyle}>
              <h3 style={tableTitleStyle}>Blacklisted Records ({items.length})</h3>
              <input 
                type="text" 
                placeholder="🔍 Search blacklist..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ maxWidth: "260px", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderRowStyle}>
                    <th style={thStyle}>Blacklisted Target</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Reason / Notes</th>
                    <th style={thStyle}>Added Date</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <tr key={item.id} style={tableRowStyle}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "hsl(var(--text-primary))" }}>{item.value}</td>
                        <td style={tdStyle}>
                          <span className={`badge ${item.type === 'domain' ? 'badge-warning' : 'badge-primary'}`}>
                            {item.type}
                          </span>
                        </td>
                        <td style={tdStyle}>{item.reason}</td>
                        <td style={tdStyle}>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button 
                            onClick={() => handleRemoveEntry(item.id, item.value)}
                            className="btn btn-secondary"
                            style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", color: "hsl(var(--danger))", borderColor: "transparent" }}
                            title="Remove from blacklist"
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={noDataTdStyle}>
                        No blacklist records found. Add one above or import a CSV sheet to start filtering!
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

const successBannerStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  backgroundColor: "hsl(var(--success) / 10%)",
  border: "1px solid hsl(var(--success) / 20%)",
  color: "hsl(var(--success))",
  borderRadius: "12px",
  fontSize: "0.9rem",
};

const formGridStyle: React.CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  flexWrap: "wrap",
};

const panelStyle: React.CSSProperties = {
  padding: "2rem",
  flex: 1,
  minWidth: "320px",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "1rem",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tablePanelStyle: React.CSSProperties = {
  padding: "2rem",
};

const tableHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "1.5rem",
  flexWrap: "wrap",
  gap: "1rem",
};

const tableTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  color: "hsl(var(--text-primary))",
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

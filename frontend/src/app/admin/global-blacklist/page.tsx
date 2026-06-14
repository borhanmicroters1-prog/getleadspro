"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "@/utils/auth";

interface BlacklistEntry {
  id: string;
  type: string;
  value: string;
  reason: string;
  created_at: string;
}

export default function GlobalBlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Form states
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState("domain");
  const [newReason, setNewReason] = useState("");
  const [addingEntry, setAddingEntry] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // CSV import states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch entries
  const fetchEntries = async () => {
    try {
      const token = auth.getToken();
      const url = search 
        ? `${apiBaseUrl}/api/admin/global-blacklist?search=${encodeURIComponent(search)}`
        : `${apiBaseUrl}/api/admin/global-blacklist`;
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error("Error fetching global blacklist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchEntries();
    }, 300); // Debounce search
    return () => clearTimeout(delayDebounce);
  }, [search]);

  // Handle manual add
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    
    const val = newValue.trim().toLowerCase();
    if (!val) {
      setFormError("Blocked address/domain value is required.");
      return;
    }
    
    setAddingEntry(true);
    try {
      const token = auth.getToken();
      const res = await fetch(`${apiBaseUrl}/api/admin/global-blacklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type: newType,
          value: val,
          reason: newReason || "Admin blacklist entry"
        })
      });

      if (res.ok) {
        const newEntry = await res.json();
        setEntries((prev) => [newEntry, ...prev]);
        setNewValue("");
        setNewReason("");
        setFormSuccess("Successfully added to global blacklist!");
      } else {
        const errData = await res.json();
        setFormError(errData.detail || "Failed to block this value.");
      }
    } catch (err) {
      setFormError("Connection failed. Try again.");
    } finally {
      setAddingEntry(false);
    }
  };

  // Handle entry deletion
  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Are you sure you want to remove this value from the global blacklist?")) return;
    
    try {
      const token = auth.getToken();
      const res = await fetch(`${apiBaseUrl}/api/admin/global-blacklist/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  // Handle CSV Import
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setImportError("");
    setImportResult(null);
    setImporting(true);

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const token = auth.getToken();
      const res = await fetch(`${apiBaseUrl}/api/admin/global-blacklist/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult({ imported: data.imported, skipped: data.skipped });
        setCsvFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchEntries(); // Reload table
      } else {
        const errData = await res.json();
        setImportError(errData.detail || "Failed to import CSV blacklist.");
      }
    } catch (err) {
      setImportError("Network failure while importing CSV.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Global Blacklist</h1>
        <p style={{ margin: "0.25rem 0 0 0", color: "hsl(var(--text-muted))", fontSize: "0.9rem" }}>
          Block specific domains or emails system-wide. All campaigns will automatically skip sending emails to these targets.
        </p>
      </div>

      {/* Top Section - Add manual entry & CSV bulk import cards */}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        
        {/* Manual block card */}
        <div className="glass-panel" style={{ flex: 1, minWidth: "320px", padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Block Single Email / Domain</h3>
          
          {formError && (
            <div style={alertStyle("danger")}>⚠️ {formError}</div>
          )}
          {formSuccess && (
            <div style={alertStyle("success")}>✅ {formSuccess}</div>
          )}

          <form onSubmit={handleAddEntry} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={labelStyle}>Block Value</label>
                <input
                  type="text"
                  placeholder={newType === "domain" ? "domain.com (no @)" : "recipient@example.com"}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <label style={labelStyle}>Block Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="domain">Domain</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <label style={labelStyle}>Reason (Internal detail)</label>
              <input
                type="text"
                placeholder="Spam trap, high bounces, legal request..."
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={addingEntry || !newValue.trim()}
              style={{
                width: "100%",
                padding: "0.7rem",
                backgroundColor: "hsl(var(--danger))",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "0.5rem"
              }}
            >
              {addingEntry ? "Blocking..." : "Add to System Blacklist"}
            </button>
          </form>
        </div>

        {/* CSV import card */}
        <div className="glass-panel" style={{ flex: 1, minWidth: "320px", padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 600 }}>Bulk Import CSV Blacklist</h3>
          
          {importError && (
            <div style={alertStyle("danger")}>⚠️ {importError}</div>
          )}
          {importResult && (
            <div style={alertStyle("success")}>
              🎉 Bulk complete! Imported: <strong>{importResult.imported}</strong>, Skipped (duplicates): <strong>{importResult.skipped}</strong>
            </div>
          )}

          <p style={{ margin: "0 0 1.25rem 0", color: "hsl(var(--text-muted))", fontSize: "0.825rem" }}>
            Upload a CSV containing emails/domains to block. Ensure it includes a column header named <strong>Value</strong> or <strong>Email</strong>.
          </p>

          <form onSubmit={handleCsvImport} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  backgroundColor: "hsl(var(--bg-secondary) / 30%)",
                  border: "1px dashed hsl(var(--border-color))",
                  borderRadius: "8px",
                  color: "hsl(var(--text-secondary))",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={importing || !csvFile}
              style={{
                width: "100%",
                padding: "0.7rem",
                color: "#fff",
                border: "1px solid hsl(var(--border-color))",
                borderColor: csvFile ? "hsl(var(--accent) / 50%)" : "hsl(var(--border-color))",
                backgroundColor: csvFile ? "hsl(var(--accent) / 10%)" : "transparent",
                borderRadius: "10px",
                fontWeight: 600,
                cursor: csvFile ? "pointer" : "default",
                marginTop: "1.5rem"
              }}
            >
              {importing ? "Processing CSV..." : "Upload & Parse CSV"}
            </button>
          </form>
        </div>

      </div>

      {/* Blacklist Table panel */}
      <div className="glass-panel" style={{ padding: "1.5rem" }}>
        
        {/* Table controller header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Active Blacklist Blocklist</h3>
          
          {/* Search box */}
          <input
            type="text"
            placeholder="Search globally blocked value or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid hsl(var(--border-color))",
              backgroundColor: "hsl(var(--bg-secondary) / 40%)",
              color: "#fff",
              fontSize: "0.85rem",
              width: "280px"
            }}
          />
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div className="spinner"></div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "hsl(var(--text-muted))" }}>
            <span style={{ fontSize: "2rem" }}>🔍</span>
            <p style={{ marginTop: "0.5rem" }}>No global blacklist entries found matching filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border-color))" }}>
                  <th style={thStyle}>Blocked Address</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Added Date</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid hsl(var(--border-color) / 40%)" }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "hsl(var(--text-primary))", lineBreak: "anywhere" }}>
                      {entry.value}
                    </td>
                    <td style={tdStyle}>
                      <span className={`badge ${entry.type === "email" ? "badge-warning" : "badge-secondary"}`} style={{ fontSize: "10px" }}>
                        {entry.type}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {entry.reason || "-"}
                    </td>
                    <td style={tdStyle}>
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        style={{
                          backgroundColor: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "1.1rem",
                          color: "hsl(var(--danger) / 70%)"
                        }}
                        title="Remove Block"
                      >
                        🗑️
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

const labelStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem", display: "block" };
const inputStyle: React.CSSProperties = { padding: "0.6rem 0.85rem", backgroundColor: "hsl(var(--bg-secondary) / 40%)", border: "1px solid hsl(var(--border-color))", borderRadius: "10px", color: "#fff", fontSize: "0.85rem" };
const thStyle: React.CSSProperties = { padding: "0.85rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "0.85rem 1rem", fontSize: "0.85rem", color: "hsl(var(--text-secondary))" };

const alertStyle = (type: "danger" | "success"): React.CSSProperties => ({
  padding: "0.75rem 1.5rem",
  backgroundColor: type === "danger" ? "hsl(var(--danger) / 10%)" : "hsl(142 71% 45% / 10%)",
  border: `1px solid ${type === "danger" ? "hsl(var(--danger) / 20%)" : "hsl(142 71% 45% / 20%)"}`,
  color: type === "danger" ? "hsl(var(--danger))" : "hsl(142 71% 45%)",
  borderRadius: "10px",
  fontSize: "0.85rem",
  marginBottom: "1rem"
});

"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface AuditEntry {
  id: string;
  actor_email: string;
  action: string;
  target: string | null;
  details: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, string> = {
  announcement_create: "📢",
  announcement_update: "✏️",
  announcement_delete: "🗑️",
  maintenance_toggle: "🔧",
  settings_change: "⚙️",
  user_login: "🔑",
  impersonate: "🎭",
  pricing_update: "💰",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = async (searchTerm?: string) => {
    try {
      setLoading(true);
      setError("");
      const url = searchTerm
        ? `/api/admin/audit-log?search=${encodeURIComponent(searchTerm)}&limit=200`
        : "/api/admin/audit-log?limit=200";
      const data = await api.get(url);
      setEntries(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>📋 Audit Log</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
            Track all admin actions — settings changes, announcements, impersonations, and more
          </p>
        </div>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="input-field"
            placeholder="Search by email, action, target..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "280px", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          />
          <button className="btn btn-secondary" type="submit" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>🔍</button>
        </form>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1.5rem", backgroundColor: "hsl(var(--danger) / 10%)", border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))", borderRadius: "12px", fontSize: "0.9rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="glass-panel" style={{ padding: "1.5rem 2rem" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "hsl(var(--text-secondary))" }}>
            <div style={{ width: "30px", height: "30px", border: "2.5px solid hsl(var(--border-color))", borderTopColor: "hsl(var(--accent))", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <span>Loading audit log...</span>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--text-muted))" }}>
            📭 No audit log entries found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border-color))" }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Actor</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Target</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid hsl(var(--border-color) / 50%)" }}>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.78rem", color: "hsl(var(--text-muted))" }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "hsl(var(--text-primary))" }}>
                      {entry.actor_email}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700,
                        backgroundColor: "hsl(var(--accent) / 10%)", color: "hsl(var(--accent))",
                        border: "1px solid hsl(var(--accent) / 20%)",
                      }}>
                        {ACTION_ICONS[entry.action] || "📝"} {entry.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.target || "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: "0.78rem", color: "hsl(var(--text-muted))", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.details || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: "1rem", fontSize: "0.78rem", color: "hsl(var(--text-muted))", textAlign: "right" }}>
              Showing {entries.length} entries
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.85rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))",
  textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
};
const tdStyle: React.CSSProperties = {
  padding: "0.85rem 1rem", fontSize: "0.85rem", color: "hsl(var(--text-secondary))",
};

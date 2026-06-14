"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "critical";
  is_active: boolean;
  created_at: string;
}

const TYPE_CONFIG = {
  info:     { label: "ℹ️ Info",     color: "hsl(217 91% 60%)", bg: "hsl(217 91% 60% / 12%)", border: "hsl(217 91% 60% / 25%)" },
  warning:  { label: "⚠️ Warning",  color: "hsl(38 92% 50%)",  bg: "hsl(38 92% 50% / 12%)",  border: "hsl(38 92% 50% / 25%)" },
  critical: { label: "🚨 Critical", color: "hsl(346 84% 50%)", bg: "hsl(346 84% 50% / 12%)", border: "hsl(346 84% 50% / 25%)" },
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", message: "", type: "info" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get("/api/admin/announcements");
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: "", message: "", type: "info" });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (item: AnnouncementItem) => {
    setForm({ title: item.title, message: item.message, type: item.type });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setError("Title and message are required."); return;
    }
    try {
      setSaving(true); setError(""); setSuccess("");
      if (editId) {
        await api.put(`/api/admin/announcements/${editId}`, form);
        setSuccess("Announcement updated!");
      } else {
        await api.post("/api/admin/announcements", form);
        setSuccess("Announcement published!");
      }
      resetForm();
      load();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: AnnouncementItem) => {
    try {
      await api.put(`/api/admin/announcements/${item.id}`, { is_active: !item.is_active });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      await api.delete(`/api/admin/announcements/${id}`);
      load();
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>📢 System Announcements</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
            Broadcast messages to all users — platform updates, notices, downtime alerts
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + New Announcement
        </button>
      </div>

      {error && <div style={alertStyle("danger")}>⚠️ {error}</div>}
      {success && <div style={alertStyle("success")}>✅ {success}</div>}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: "1.75rem 2rem" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "hsl(var(--text-primary))", marginBottom: "1rem" }}>
            {editId ? "✏️ Edit Announcement" : "📝 New Announcement"}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input className="input-field" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Scheduled Maintenance Notice" />
            </div>
            <div>
              <label style={labelStyle}>Message</label>
              <textarea className="input-field" rows={3} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Describe the announcement..." style={{ resize: "vertical", minHeight: "80px" }} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {(["info", "warning", "critical"] as const).map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} style={{
                    padding: "0.5rem 1rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                    backgroundColor: form.type === t ? TYPE_CONFIG[t].bg : "transparent",
                    color: form.type === t ? TYPE_CONFIG[t].color : "hsl(var(--text-muted))",
                    border: `1.5px solid ${form.type === t ? TYPE_CONFIG[t].border : "hsl(var(--border-color))"}`,
                    transition: "all 0.2s ease",
                  }}>
                    {TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={resetForm} style={{ padding: "0.5rem 1.25rem" }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: "0.5rem 1.5rem" }}>
                {saving ? "⏳ Saving..." : editId ? "💾 Update" : "🚀 Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcements List */}
      {loading ? (
        <div style={{ padding: "4rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "hsl(var(--text-secondary))" }}>
          <div style={{ width: "30px", height: "30px", border: "2.5px solid hsl(var(--border-color))", borderTopColor: "hsl(var(--accent))", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span>Loading announcements...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--text-muted))" }}>
          📭 No announcements created yet. Click "New Announcement" to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map(item => {
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
            return (
              <div key={item.id} className="glass-panel" style={{
                padding: "1.25rem 1.5rem",
                borderLeft: `4px solid ${cfg.color}`,
                opacity: item.is_active ? 1 : 0.55,
                transition: "all 0.2s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--text-primary))" }}>{item.title}</span>
                      <span style={{ padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 700, backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                      <span style={{ padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 700, backgroundColor: item.is_active ? "hsl(142 71% 45% / 12%)" : "hsl(var(--bg-tertiary))", color: item.is_active ? "hsl(142 71% 45%)" : "hsl(var(--text-muted))" }}>
                        {item.is_active ? "🟢 LIVE" : "⚫ HIDDEN"}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", lineHeight: 1.5 }}>{item.message}</p>
                    <div style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))", marginTop: "0.35rem" }}>
                      Created: {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <button onClick={() => toggleActive(item)} style={iconBtnStyle} title={item.is_active ? "Hide" : "Show"}>
                      {item.is_active ? "👁️" : "🙈"}
                    </button>
                    <button onClick={() => handleEdit(item)} style={iconBtnStyle} title="Edit">✏️</button>
                    <button onClick={() => handleDelete(item.id)} style={{ ...iconBtnStyle, borderColor: "hsl(var(--danger) / 20%)" }} title="Delete">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem", display: "block" };
const iconBtnStyle: React.CSSProperties = { width: "32px", height: "32px", borderRadius: "8px", border: "1px solid hsl(var(--border-color))", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", transition: "all 0.15s ease" };
const alertStyle = (type: "danger" | "success"): React.CSSProperties => ({ padding: "0.75rem 1.5rem", backgroundColor: type === "danger" ? "hsl(var(--danger) / 10%)" : "hsl(142 71% 45% / 10%)", border: `1px solid ${type === "danger" ? "hsl(var(--danger) / 20%)" : "hsl(142 71% 45% / 20%)"}`, color: type === "danger" ? "hsl(var(--danger))" : "hsl(142 71% 45%)", borderRadius: "12px", fontSize: "0.9rem" });

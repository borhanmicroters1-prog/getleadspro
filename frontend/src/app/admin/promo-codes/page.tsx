"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface PromoCodeItem {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed" | "credits";
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  expiry_at: string | null;
  created_at: string;
}

export default function PromoCodesPage() {
  const [items, setItems] = useState<PromoCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "",
    max_uses: "",
    expiry_at: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/api/admin/promo-codes");
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load promo codes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      code: "",
      discount_type: "percentage",
      discount_value: "",
      max_uses: "",
      expiry_at: "",
    });
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      setError("Promo code name is required.");
      return;
    }
    const valueNum = parseFloat(form.discount_value);
    if (isNaN(valueNum) || valueNum <= 0) {
      setError("Discount value must be a positive number.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: valueNum,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expiry_at: form.expiry_at ? new Date(form.expiry_at).toISOString() : null,
      };

      await api.post("/api/admin/promo-codes", payload);
      setSuccess("Promo code created successfully!");
      resetForm();
      load();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to create promo code.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: PromoCodeItem) => {
    try {
      setError("");
      await api.put(`/api/admin/promo-codes/${item.id}`, { is_active: !item.is_active });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promo code? This action cannot be undone.")) return;
    try {
      setError("");
      await api.delete(`/api/admin/promo-codes/${id}`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getDiscountDisplay = (item: PromoCodeItem) => {
    if (item.discount_type === "percentage") {
      return `${item.discount_value}% Off`;
    } else if (item.discount_type === "fixed") {
      return `৳ ${item.discount_value.toLocaleString()} Off`;
    } else {
      return `+${item.discount_value.toLocaleString()} Extra Credits`;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>🎁 Promo Codes & Coupon System</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
            Generate and manage discount coupons or extra credits promos for user checkouts
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + Create Promo Code
        </button>
      </div>

      {error && <div style={alertStyle("danger")}>⚠️ {error}</div>}
      {success && <div style={alertStyle("success")}>✅ {success}</div>}

      {/* Form Panel */}
      {showForm && (
        <div className="glass-panel" style={{ padding: "1.75rem 2rem" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "hsl(var(--text-primary))", marginBottom: "1rem" }}>
            🎁 Create New Coupon Code
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Coupon Code</label>
              <input className="input-field" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. GETLEADS20" style={{ textTransform: "uppercase" }} />
            </div>
            <div>
              <label style={labelStyle}>Discount Type</label>
              <select className="input-field" value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))} style={{ backgroundColor: "hsl(var(--bg-secondary))" }}>
                <option value="percentage">Percentage Discount (%)</option>
                <option value="fixed">Fixed BDT Discount (৳)</option>
                <option value="credits">Bonus Scraping Credits</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Discount Value</label>
              <input className="input-field" type="number" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} placeholder={form.discount_type === "percentage" ? "e.g. 20 for 20%" : "e.g. 500"} />
            </div>
            <div>
              <label style={labelStyle}>Max Uses (Optional)</label>
              <input className="input-field" type="number" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="e.g. 100 (Leave blank for unlimited)" />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Expiry Date (Optional)</label>
              <input className="input-field" type="datetime-local" value={form.expiry_at} onChange={e => setForm(p => ({ ...p, expiry_at: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
            <button className="btn btn-secondary" onClick={resetForm} style={{ padding: "0.5rem 1.25rem" }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: "0.5rem 1.5rem" }}>
              {saving ? "⏳ Saving..." : "💾 Save Promo Code"}
            </button>
          </div>
        </div>
      )}

      {/* Coupon List Table */}
      <div className="glass-panel" style={{ padding: "1.5rem 2rem" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "hsl(var(--text-secondary))" }}>
            <div style={{ width: "30px", height: "30px", border: "2.5px solid hsl(var(--border-color))", borderTopColor: "hsl(var(--accent))", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <span>Loading promo codes...</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--text-muted))" }}>
            📭 No coupons generated yet. Click "Create Promo Code" to get started.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border-color))" }}>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Benefit</th>
                  <th style={thStyle}>Usage</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Expiry Date</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isExpired = item.expiry_at && new Date(item.expiry_at) < new Date();
                  const isMaxed = item.max_uses !== null && item.uses_count >= item.max_uses;
                  const isValid = item.is_active && !isExpired && !isMaxed;

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid hsl(var(--border-color) / 50%)" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, fontFamily: "monospace", fontSize: "0.95rem", color: "hsl(var(--text-primary))" }}>
                        {item.code}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: "0.2rem 0.6rem", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 700,
                          backgroundColor: item.discount_type === "credits" ? "hsl(142 71% 45% / 10%)" : "hsl(var(--accent) / 10%)",
                          color: item.discount_type === "credits" ? "hsl(142 71% 45%)" : "hsl(var(--accent))",
                          border: `1px solid ${item.discount_type === "credits" ? "hsl(142 71% 45% / 20%)" : "hsl(var(--accent) / 20%)"}`
                        }}>
                          {getDiscountDisplay(item)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: "0.85rem", color: "hsl(var(--text-primary))", fontWeight: 600 }}>{item.uses_count}</span>
                        <span style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))" }}>
                          {" "} / {item.max_uses !== null ? item.max_uses : "∞"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.68rem", fontWeight: 700,
                          backgroundColor: isValid ? "hsl(142 71% 45% / 10%)" : "hsl(346 84% 50% / 10%)",
                          color: isValid ? "hsl(142 71% 45%)" : "hsl(346 84% 50%)",
                          border: `1px solid ${isValid ? "hsl(142 71% 45% / 20%)" : "hsl(346 84% 50% / 20%)"}`
                        }}>
                          {isValid ? "🟢 ACTIVE" : isExpired ? "⌛ EXPIRED" : isMaxed ? "🔒 MAX LIMIT" : "⚫ INACTIVE"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: isExpired ? "hsl(346 84% 50%)" : "hsl(var(--text-secondary))" }}>
                        {item.expiry_at ? new Date(item.expiry_at).toLocaleString() : "Never"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button onClick={() => toggleActive(item)} style={iconBtnStyle} title={item.is_active ? "Deactivate" : "Activate"}>
                            {item.is_active ? "👁️" : "🙈"}
                          </button>
                          <button onClick={() => handleDelete(item.id)} style={{ ...iconBtnStyle, borderColor: "hsl(var(--danger) / 20%)" }} title="Delete">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem", display: "block" };
const iconBtnStyle: React.CSSProperties = { width: "32px", height: "32px", borderRadius: "8px", border: "1px solid hsl(var(--border-color))", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", transition: "all 0.15s ease" };
const alertStyle = (type: "danger" | "success"): React.CSSProperties => ({ padding: "0.75rem 1.5rem", backgroundColor: type === "danger" ? "hsl(var(--danger) / 10%)" : "hsl(142 71% 45% / 10%)", border: `1px solid ${type === "danger" ? "hsl(var(--danger) / 20%)" : "hsl(142 71% 45% / 20%)"}`, color: type === "danger" ? "hsl(var(--danger))" : "hsl(142 71% 45%)", borderRadius: "12px", fontSize: "0.9rem" });
const thStyle: React.CSSProperties = { padding: "0.85rem 1rem", fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "0.85rem 1rem", fontSize: "0.85rem", color: "hsl(var(--text-secondary))" };

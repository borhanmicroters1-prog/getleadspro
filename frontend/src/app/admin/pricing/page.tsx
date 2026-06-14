"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface PricingData {
  FREE_SIGNUP_CREDITS: string;
  STARTER_PRICE_BDT: string;
  STARTER_CREDITS: string;
  PRO_PRICE_BDT: string;
  PRO_CREDITS: string;
  BUSINESS_PRICE_BDT: string;
  BUSINESS_CREDITS: string;
}

interface FieldDef {
  key: keyof PricingData;
  label: string;
  desc: string;
  prefix?: string;
  suffix?: string;
  icon: string;
}

const FIELDS: FieldDef[] = [
  {
    key: "FREE_SIGNUP_CREDITS",
    label: "Free Signup Credits",
    desc: "Credits given to every new user who registers on the platform.",
    suffix: "credits",
    icon: "🎁",
  },
  {
    key: "STARTER_PRICE_BDT",
    label: "Starter Plan Price",
    desc: "Monthly subscription price for the Starter plan.",
    prefix: "৳",
    suffix: "BDT",
    icon: "⭐",
  },
  {
    key: "STARTER_CREDITS",
    label: "Starter Plan Credits",
    desc: "Credits granted per billing cycle for Starter subscribers.",
    suffix: "credits / month",
    icon: "⭐",
  },
  {
    key: "PRO_PRICE_BDT",
    label: "Pro Plan Price",
    desc: "Monthly subscription price for the Pro plan.",
    prefix: "৳",
    suffix: "BDT",
    icon: "🚀",
  },
  {
    key: "PRO_CREDITS",
    label: "Pro Plan Credits",
    desc: "Credits granted per billing cycle for Pro subscribers.",
    suffix: "credits / month",
    icon: "🚀",
  },
  {
    key: "BUSINESS_PRICE_BDT",
    label: "Business Pack Price",
    desc: "One-time purchase price for the Business credit pack.",
    prefix: "৳",
    suffix: "BDT",
    icon: "💼",
  },
  {
    key: "BUSINESS_CREDITS",
    label: "Business Pack Credits",
    desc: "Credits included in the Business one-time credit pack.",
    suffix: "credits",
    icon: "💼",
  },
];

export default function PricingSettingsPage() {
  const [data, setData] = useState<PricingData | null>(null);
  const [form, setForm] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/admin/pricing");
      setData(res);
      setForm(res);
    } catch (err: any) {
      setError(err.message || "Failed to load pricing settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key: keyof PricingData, value: string) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    // Validate all fields are positive integers
    for (const field of FIELDS) {
      const v = parseInt(form[field.key]);
      if (isNaN(v) || v < 0) {
        setError(`"${field.label}" must be a non-negative number.`);
        return;
      }
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const res = await api.post("/api/admin/pricing", form);
      setSuccess(res.message || "Pricing settings saved!");
      setData({ ...form });
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = form && data && JSON.stringify(form) !== JSON.stringify(data);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h3 style={{ fontSize: "1.25rem", color: "hsl(var(--text-primary))" }}>💰 Pricing & Plan Settings</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginTop: "0.25rem" }}>
            Change plan prices, credit amounts, and free signup defaults without touching code
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1.5rem", backgroundColor: "hsl(var(--danger) / 10%)", border: "1px solid hsl(var(--danger) / 20%)", color: "hsl(var(--danger))", borderRadius: "12px", fontSize: "0.9rem" }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "0.75rem 1.5rem", backgroundColor: "hsl(142 71% 45% / 10%)", border: "1px solid hsl(142 71% 45% / 20%)", color: "hsl(142 71% 45%)", borderRadius: "12px", fontSize: "0.9rem" }}>
          ✅ {success}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "4rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "hsl(var(--text-secondary))" }}>
          <div style={{ width: "30px", height: "30px", border: "2.5px solid hsl(var(--border-color))", borderTopColor: "hsl(var(--accent))", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span>Loading pricing configuration...</span>
        </div>
      ) : form ? (
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Free plan defaults */}
          <div className="glass-panel" style={{ padding: "1.75rem 2rem" }}>
            <h4 style={sectionTitleStyle}>🎁 Free Plan Defaults</h4>
            <p style={sectionSubStyle}>Controls how many credits new signups receive on the Free tier</p>
            <div style={{ marginTop: "1.25rem" }}>
              <FieldInput field={FIELDS[0]} value={form[FIELDS[0].key]} onChange={handleChange} />
            </div>
          </div>

          {/* Plan pricing */}
          <div className="glass-panel" style={{ padding: "1.75rem 2rem" }}>
            <h4 style={sectionTitleStyle}>📋 Subscription Plan Pricing</h4>
            <p style={sectionSubStyle}>Prices and credits for recurring monthly subscriptions</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginTop: "1.25rem" }}>
              {FIELDS.slice(1, 5).map(field => (
                <FieldInput key={field.key} field={field} value={form[field.key]} onChange={handleChange} />
              ))}
            </div>
          </div>

          {/* Credit packs */}
          <div className="glass-panel" style={{ padding: "1.75rem 2rem" }}>
            <h4 style={sectionTitleStyle}>💼 One-time Credit Packs</h4>
            <p style={sectionSubStyle}>Price and credits for the Business one-time purchase pack</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginTop: "1.25rem" }}>
              {FIELDS.slice(5).map(field => (
                <FieldInput key={field.key} field={field} value={form[field.key]} onChange={handleChange} />
              ))}
            </div>
          </div>

          {/* Live Preview Cards */}
          <div className="glass-panel" style={{ padding: "1.75rem 2rem" }}>
            <h4 style={sectionTitleStyle}>👁️ Live Pricing Preview</h4>
            <p style={sectionSubStyle}>How your plans will appear to users on the billing page</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1.25rem" }}>
              {[
                { name: "Free", price: "0", credits: form.FREE_SIGNUP_CREDITS, color: "hsl(142 71% 45%)", icon: "🎁" },
                { name: "Starter", price: form.STARTER_PRICE_BDT, credits: form.STARTER_CREDITS, color: "hsl(38 92% 55%)", icon: "⭐" },
                { name: "Pro", price: form.PRO_PRICE_BDT, credits: form.PRO_CREDITS, color: "hsl(217 91% 60%)", icon: "🚀" },
              ].map(plan => (
                <div key={plan.name} style={{
                  padding: "1.25rem", borderRadius: "14px",
                  background: `${plan.color}08`,
                  border: `1px solid ${plan.color}25`,
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                }}>
                  <div style={{ fontSize: "1.25rem" }}>{plan.icon}</div>
                  <div style={{ fontWeight: 700, color: "hsl(var(--text-primary))", fontSize: "1rem" }}>{plan.name} Plan</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: plan.color }}>
                    {plan.price === "0" ? "Free" : `৳${parseInt(plan.price).toLocaleString()}`}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "hsl(var(--text-muted))" }}>
                    {parseInt(plan.credits).toLocaleString()} credits / month
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !hasChanges}
              style={{ padding: "0.75rem 2rem", fontSize: "0.95rem", opacity: (!hasChanges || saving) ? 0.6 : 1 }}
            >
              {saving ? "⏳ Saving..." : hasChanges ? "💾 Save Pricing Settings" : "✅ No Changes"}
            </button>
          </div>

        </form>
      ) : null}
    </div>
  );
}

function FieldInput({ field, value, onChange }: {
  field: FieldDef;
  value: string;
  onChange: (key: keyof PricingData, value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {field.icon} {field.label}
      </label>
      <p style={{ fontSize: "0.78rem", color: "hsl(var(--text-muted))", lineHeight: 1.4 }}>{field.desc}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {field.prefix && (
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "hsl(var(--accent))", minWidth: "20px" }}>{field.prefix}</span>
        )}
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
          className="input-field"
          style={{ flex: 1, fontWeight: 600, fontSize: "1rem" }}
          required
        />
        {field.suffix && (
          <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))", whiteSpace: "nowrap" }}>{field.suffix}</span>
        )}
      </div>
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1rem", fontWeight: 700, color: "hsl(var(--text-primary))",
};
const sectionSubStyle: React.CSSProperties = {
  fontSize: "0.8rem", color: "hsl(var(--text-muted))", marginTop: "0.2rem",
};

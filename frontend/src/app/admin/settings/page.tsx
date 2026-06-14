"use client";

import { useEffect, useState } from "react";
import { api } from "@/utils/api";

interface SettingStatus {
  value: string;
  source: "database" | "environment" | "none";
  is_set: boolean;
}

interface SettingsData {
  [key: string]: SettingStatus;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [visibleKeys, setVisibleKeys] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Maintenance mode state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/api/admin/settings");
      setSettings(data);
      
      // Initialize form fields with the masked/original values
      const initialForm: { [key: string]: string } = {};
      Object.keys(data).forEach((key) => {
        initialForm[key] = data[key].value || "";
      });
      setFormData(initialForm);
    } catch (err: any) {
      setError(err.message || "Failed to load system settings.");
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenanceStatus = async () => {
    try {
      const res = await api.get("/api/admin/maintenance");
      setMaintenanceMode(res.maintenance_mode);
    } catch {}
  };

  useEffect(() => {
    loadSettings();
    loadMaintenanceStatus();
  }, []);


  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleMaintenance = async () => {
    try {
      setMaintenanceLoading(true);
      setMaintenanceMsg("");
      const res = await api.post("/api/admin/maintenance", {});
      setMaintenanceMode(res.maintenance_mode);
      setMaintenanceMsg(res.message);
      setTimeout(() => setMaintenanceMsg(""), 4000);
    } catch (err: any) {
      setMaintenanceMsg(err.message || "Failed to toggle maintenance mode.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");

      // Filter settings that are actually updated
      const payload: { [key: string]: string } = {};
      Object.keys(formData).forEach((key) => {
        const val = formData[key].trim();
        // Only send if it has changed or is empty (meaning delete). 
        // If it starts with masking dots, ignore it.
        const isMasked = val.includes("...") || val.startsWith("****");
        if (!isMasked) {
          payload[key] = val;
        }
      });

      const response = await api.post("/api/admin/settings", { settings: payload });
      setSuccessMsg(response.message || "Settings updated successfully.");
      
      // Wait a moment and fetch fresh state
      await loadSettings();
    } catch (err: any) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Fetching configuration states...</span>
      </div>
    );
  }

  const keyDetails: { [key: string]: { label: string; desc: string; category: string } } = {
    VOIDAI_API_KEY: {
      label: "VoidAI API Key",
      desc: "Used for unified OpenAI-compatible endpoint. Highly recommended for cost savings.",
      category: "AI Engine",
    },
    OPENAI_API_KEY: {
      label: "OpenAI API Key",
      desc: "Used for ChatGPT email draft generations (e.g. gpt-4o).",
      category: "AI Engine",
    },
    ANTHROPIC_API_KEY: {
      label: "Anthropic API Key",
      desc: "Used for Claude email draft generations (e.g. claude-3-5-sonnet).",
      category: "AI Engine",
    },
    GEMINI_API_KEY: {
      label: "Google Gemini API Key",
      desc: "Used for Gemini model email generations (e.g. gemini-1.5-flash).",
      category: "AI Engine",
    },
    GOOGLE_MAPS_API_KEY: {
      label: "Google Maps API Key",
      desc: "Used by background scraping tasks to locate business contact details.",
      category: "Leads Scraper",
    },
    META_ACCESS_TOKEN: {
      label: "Meta Ads Access Token",
      desc: "Required for active Facebook Ads Library scraping details.",
      category: "Leads Scraper",
    },
    SSLCOMMERZ_STORE_ID: {
      label: "SSLCommerz Store ID",
      desc: "Store identifier credentials generated by your SSLCommerz merchant panel.",
      category: "Payment Gateway",
    },
    SSLCOMMERZ_STORE_PASSWORD: {
      label: "SSLCommerz Store Password / Store Pass",
      desc: "Password credential matching the Store ID for payment callbacks validation.",
      category: "Payment Gateway",
    },
  };

  // Group settings by category
  const categories = ["AI Engine", "Leads Scraper", "Payment Gateway"];

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Maintenance Mode Toggle Card ── */}
      <div className="glass-panel" style={{
        padding: "1.5rem 2rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "1.5rem",
        border: maintenanceMode ? "1px solid hsl(0 72% 51% / 35%)" : "1px solid hsl(var(--border-color))",
        background: maintenanceMode ? "hsl(0 72% 51% / 5%)" : undefined,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.25rem" }}>🔧</span>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "hsl(var(--text-primary))" }}>Maintenance Mode</h3>
            <span style={{
              padding: "0.15rem 0.55rem", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 700,
              backgroundColor: maintenanceMode ? "hsl(0 72% 51% / 15%)" : "hsl(142 71% 45% / 15%)",
              color: maintenanceMode ? "hsl(0 72% 60%)" : "hsl(142 71% 45%)",
              border: `1px solid ${maintenanceMode ? "hsl(0 72% 51% / 30%)" : "hsl(142 71% 45% / 30%)"}`,
            }}>
              {maintenanceMode ? "🔴 ON" : "🟢 OFF"}
            </span>
          </div>
          <p style={{ fontSize: "0.82rem", color: "hsl(var(--text-muted))", maxWidth: "520px", lineHeight: 1.55 }}>
            When enabled, all regular users see a maintenance page and cannot access the platform. Admins remain unaffected.
          </p>
          {maintenanceMsg && (
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: maintenanceMode ? "hsl(0 72% 60%)" : "hsl(142 71% 45%)", marginTop: "0.25rem" }}>
              ✓ {maintenanceMsg}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleToggleMaintenance}
          disabled={maintenanceLoading}
          style={{
            padding: "0.75rem 1.75rem", borderRadius: "12px", fontWeight: 700, fontSize: "0.9rem",
            cursor: maintenanceLoading ? "not-allowed" : "pointer", border: "none",
            background: maintenanceMode
              ? "linear-gradient(135deg, hsl(0 72% 51%), #dc2626)"
              : "linear-gradient(135deg, #10B981, #059669)",
            color: "#fff",
            boxShadow: maintenanceMode ? "0 4px 14px rgba(220,38,38,0.35)" : "0 4px 14px rgba(16,185,129,0.35)",
            transition: "all 0.2s ease",
            opacity: maintenanceLoading ? 0.7 : 1,
            minWidth: "160px",
          }}
        >
          {maintenanceLoading
            ? "⏳ Toggling..."
            : maintenanceMode
            ? "🔓 Disable Maintenance"
            : "🔧 Enable Maintenance"}
        </button>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {error && (
          <div className="glass-panel" style={errorAlertStyle}>
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="glass-panel" style={successAlertStyle}>
            ✅ {successMsg}
          </div>
        )}

        <div style={bottomGridStyle}>
          <div className="glass-panel" style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h3 style={panelTitleStyle}>⚙️ System Configuration Settings</h3>
                <p style={panelDescStyle}>Manage system-wide backend API keys and integrations</p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ ...saveBtnStyle, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving changes..." : "💾 Save Settings"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginTop: "1rem" }}>
              {categories.map((category) => {
                const keysInCategory = Object.keys(keyDetails).filter(
                  (k) => keyDetails[k].category === category
                );

                return (
                  <div key={category} style={categoryWrapperStyle}>
                    <h4 style={categoryTitleStyle}>{category} Configuration</h4>
                    <div style={inputsContainerStyle}>
                      {keysInCategory.map((key) => {
                        const status = settings?.[key];
                        const details = keyDetails[key];
                        const isVisible = visibleKeys[key];

                        let badgeColor = "var(--text-muted)";
                        let badgeBg = "hsl(var(--bg-tertiary))";
                        let badgeLabel = "Not Set";

                        if (status?.source === "database") {
                          badgeColor = "#10b981";
                          badgeBg = "rgba(16, 185, 129, 0.1)";
                          badgeLabel = "Active (DB)";
                        } else if (status?.source === "environment") {
                          badgeColor = "#3b82f6";
                          badgeBg = "rgba(59, 130, 246, 0.1)";
                          badgeLabel = "Active (Render Env)";
                        }

                        return (
                          <div key={key} style={inputRowStyle}>
                            <div style={labelWrapperStyle}>
                              <label htmlFor={key} style={labelStyle}>
                                {details.label}
                              </label>
                              <span
                                style={{
                                  ...badgeStyle,
                                  color: badgeColor,
                                  backgroundColor: badgeBg,
                                  border: `1px solid ${badgeColor}25`,
                                }}
                              >
                                {badgeLabel}
                              </span>
                            </div>
                            
                            <p style={inputDescStyle}>{details.desc}</p>
                            
                            <div style={inputFieldWrapperStyle}>
                              <input
                                id={key}
                                type={isVisible ? "text" : "password"}
                                value={formData[key] || ""}
                                onChange={(e) => handleInputChange(key, e.target.value)}
                                placeholder="Enter value..."
                                style={inputFieldStyle}
                              />
                              <button
                                type="button"
                                onClick={() => toggleVisibility(key)}
                                style={visibilityToggleStyle}
                                title={isVisible ? "Hide Key" : "Show Key"}
                              >
                                {isVisible ? "👁️" : "👁️‍🗨️"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}

// Inline Styles
const loadingContainerStyle: React.CSSProperties = {
  padding: "3rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
  color: "hsl(var(--text-secondary))",
};

const spinnerStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  border: "3px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const errorAlertStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  color: "hsl(var(--danger))",
  background: "hsl(var(--danger) / 6%)",
  border: "1px solid hsl(var(--danger) / 15%)",
  borderRadius: "8px",
};

const successAlertStyle: React.CSSProperties = {
  padding: "1rem 1.5rem",
  color: "#10b981",
  background: "rgba(16, 185, 129, 0.06)",
  border: "1px solid rgba(16, 185, 129, 0.15)",
  borderRadius: "8px",
};

const bottomGridStyle: React.CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  flexWrap: "wrap",
};

const panelStyle: React.CSSProperties = {
  padding: "2rem",
  flex: 1,
  minWidth: "320px",
  width: "100%",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "1rem",
  borderBottom: "1px solid hsl(var(--border-color))",
  paddingBottom: "1.5rem",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  color: "hsl(var(--text-primary))",
  marginBottom: "0.25rem",
};

const panelDescStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-muted))",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "0.65rem 1.25rem",
  fontSize: "0.875rem",
  borderRadius: "8px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const categoryWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const categoryTitleStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "hsl(var(--accent))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px dashed hsl(var(--border-color))",
  paddingBottom: "0.5rem",
};

const inputsContainerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "1.5rem",
};

const inputRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelWrapperStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "hsl(var(--text-primary))",
};

const badgeStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  padding: "0.15rem 0.5rem",
  borderRadius: "12px",
  fontWeight: 600,
};

const inputDescStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--text-muted))",
  margin: 0,
};

const inputFieldWrapperStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const inputFieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 2.5rem 0.65rem 0.75rem",
  fontSize: "0.875rem",
  borderRadius: "8px",
  backgroundColor: "hsl(var(--bg-secondary) / 40%)",
  border: "1px solid hsl(var(--border-color))",
  color: "hsl(var(--text-primary))",
  outline: "none",
  transition: "all 0.2s ease",
};

const visibilityToggleStyle: React.CSSProperties = {
  position: "absolute",
  right: "0.5rem",
  backgroundColor: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "0.25rem",
  fontSize: "1rem",
  opacity: 0.6,
  transition: "opacity 0.2s",
};

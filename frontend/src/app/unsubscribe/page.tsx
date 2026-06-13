"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead_id") || searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!leadId) {
      setLoading(false);
      setErrorMsg("Invalid unsubscribe link. Please check your email link details.");
      return;
    }

    const triggerUnsubscribe = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/automation/unsubscribe/${leadId}`);
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.detail || "Opt-out request failed.");
        }
        const data = await res.json();
        setSuccessMsg(data.message || "You have been successfully unsubscribed.");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to process unsubscribe request.");
      } finally {
        setLoading(false);
      }
    };

    triggerUnsubscribe();
  }, [leadId]);

  return (
    <div style={containerStyle}>
      <div style={gradientBgStyle} />
      <div className="glass-panel animate-fade-in" style={panelStyle}>
        
        {/* Brand Header */}
        <div style={brandStyle}>
          <div style={logoIconStyle}>GL</div>
          <span style={logoTextStyle}>GetLeads</span>
        </div>

        {/* Dynamic content */}
        {loading ? (
          <div style={statusWrapperStyle}>
            <div style={spinnerStyle} />
            <span style={textStyle}>Processing your opt-out request...</span>
          </div>
        ) : errorMsg ? (
          <div style={statusWrapperStyle}>
            <div style={errorIconStyle}>⚠️</div>
            <h3 style={titleStyle}>Something went wrong</h3>
            <p style={{ ...subTextStyle, color: "hsl(var(--danger))" }}>{errorMsg}</p>
            <p style={subTextStyle}>If you continue to receive unwanted emails, please contact the sender directly.</p>
          </div>
        ) : (
          <div style={statusWrapperStyle}>
            <div style={successIconStyle}>✓</div>
            <h3 style={titleStyle}>Unsubscribed Successfully</h3>
            <p style={subTextStyle}>
              We have updated your preferences. Your email has been added to our Do Not Contact list, and you will not receive any further automated outreach emails from this sender.
            </p>
            <div style={dividerStyle} />
            <p style={{ ...subTextStyle, fontSize: "11px", color: "hsl(var(--text-muted))" }}>
              Please allow up to 24 hours for the system changes to fully apply.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div style={containerStyle}>
        <div style={gradientBgStyle} />
        <div className="glass-panel" style={panelStyle}>
          <div style={brandStyle}>
            <div style={logoIconStyle}>GL</div>
            <span style={logoTextStyle}>GetLeads</span>
          </div>
          <div style={statusWrapperStyle}>
            <div style={spinnerStyle} />
            <span style={textStyle}>Loading unsubscribe page...</span>
          </div>
        </div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}

// Inline Styles
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  position: "relative",
  backgroundColor: "hsl(var(--bg-primary))",
  fontFamily: "var(--font-family-sans)"
};

const gradientBgStyle: React.CSSProperties = {
  position: "absolute",
  top: "0",
  left: "0",
  right: "0",
  bottom: "0",
  zIndex: 1,
  background: "radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.08), transparent 50%), radial-gradient(circle at 20% 80%, rgba(5, 150, 105, 0.06), transparent 50%)",
  pointerEvents: "none",
};

const panelStyle: React.CSSProperties = {
  padding: "3rem 2.5rem",
  maxWidth: "480px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2rem",
  boxShadow: "var(--glass-shadow)",
  zIndex: 2,
};

const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const logoIconStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  background: "linear-gradient(135deg, #10B981, #059669)",
  color: "#fff",
  borderRadius: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "0.8rem",
};

const logoTextStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: "bold",
  color: "hsl(var(--text-primary))",
  letterSpacing: "-0.02em",
};

const statusWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "1rem",
};

const spinnerStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  border: "3px solid var(--glass-border)",
  borderTopColor: "#10B981",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const textStyle: React.CSSProperties = {
  color: "hsl(var(--text-secondary))",
  fontSize: "0.9rem",
  marginTop: "0.5rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
};

const subTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
  lineHeight: "1.5",
};

const successIconStyle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  backgroundColor: "rgba(16, 185, 129, 0.15)",
  border: "1px solid rgba(16, 185, 129, 0.3)",
  color: "#10b981",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "1.5rem",
  marginBottom: "0.5rem",
};

const errorIconStyle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  backgroundColor: "rgba(239, 68, 68, 0.15)",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  color: "#ef4444",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "1.5rem",
  marginBottom: "0.5rem",
};

const dividerStyle: React.CSSProperties = {
  width: "100%",
  height: "1px",
  backgroundColor: "hsl(var(--border-color))",
  margin: "1rem 0 0.5rem 0",
};

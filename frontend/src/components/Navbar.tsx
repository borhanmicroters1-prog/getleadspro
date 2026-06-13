"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/utils/auth";
import { useTheme } from "@/utils/theme";

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [credits, setCredits] = useState(50);
  const [maxCredits, setMaxCredits] = useState(50);

  useEffect(() => {
    const updateCredits = () => {
      const user = auth.getCurrentUser();
      if (user) {
        setCredits(user.credits);
        setMaxCredits(user.plan === "Pro" ? 10000 : user.plan === "Starter" ? 2500 : 50);
      }
    };

    updateCredits();

    window.addEventListener("storage", updateCredits);
    window.addEventListener("credits_updated", updateCredits);

    return () => {
      window.removeEventListener("storage", updateCredits);
      window.removeEventListener("credits_updated", updateCredits);
    };
  }, []);

  // Format page title from pathname
  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard Overview";
    if (pathname.includes("/scraper/google-maps")) return "Google Maps Lead Scraper";
    if (pathname.includes("/scraper/facebook-ads")) return "Facebook Ads Scraper";
    if (pathname.includes("/upload")) return "Upload Lead List (CSV)";
    if (pathname === "/leads") return "Leads Management";
    if (pathname === "/email-accounts") return "Connected Email Accounts";
    if (pathname === "/campaigns") return "Email Campaigns";
    if (pathname === "/blacklist") return "Outreach Blacklist";
    if (pathname === "/settings") return "Account Settings";
    return "GetLeads";
  };

  return (
    <header style={navbarStyle} className="glass-panel">
      {/* Title */}
      <h1 style={titleStyle}>{getPageTitle()}</h1>

      {/* Utilities */}
      <div style={utilityWrapperStyle}>
        {/* Credits Counter Widget */}
        <div style={creditPillStyle} title="Credits available for scraping leads">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={creditIconStyle}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3" />
          </svg>
          <span style={creditTextStyle}>
            Credits: <strong>{credits}</strong> / {maxCredits}
          </span>
          <div style={progressBarBgStyle}>
            <div style={{
              ...progressBarFillStyle,
              width: `${Math.min(100, (credits / maxCredits) * 100)}%`
            }} />
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            /* Sun icon for dark mode — click to go light */
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            /* Moon icon for light mode — click to go dark */
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {/* Server Health Status */}
        <div style={healthBadgeStyle}>
          <div style={dotStyle} />
          <span style={healthTextStyle}>API Connected</span>
        </div>
      </div>
    </header>
  );
}

// Inline Styles
const navbarStyle: React.CSSProperties = {
  position: "fixed",
  top: "0",
  right: "0",
  left: "0",
  height: "var(--navbar-height)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 2rem 0 calc(var(--sidebar-width) + 2rem)",
  zIndex: 90,
  borderRadius: "0 0 16px 16px",
  borderTopWidth: "0",
  borderRightWidth: "0",
  borderLeftWidth: "0",
  backgroundColor: "var(--navbar-bg)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
  fontFamily: "var(--font-family-heading)",
};

const utilityWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
};

const creditPillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  backgroundColor: "hsl(var(--bg-secondary))",
  border: "1px solid hsl(var(--border-color))",
  padding: "0.4rem 0.8rem",
  borderRadius: "30px",
  fontSize: "0.8rem",
};

const creditIconStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  color: "hsl(var(--accent))",
};

const creditTextStyle: React.CSSProperties = {
  color: "hsl(var(--text-secondary))",
};

const progressBarBgStyle: React.CSSProperties = {
  width: "60px",
  height: "5px",
  backgroundColor: "hsl(var(--bg-tertiary))",
  borderRadius: "3px",
  overflow: "hidden",
  marginLeft: "0.25rem",
};

const progressBarFillStyle: React.CSSProperties = {
  height: "100%",
  backgroundColor: "#10B981",
  backgroundImage: "linear-gradient(90deg, #10B981, #34D399)",
  borderRadius: "3px",
  transition: "width 0.5s ease",
};

const healthBadgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  backgroundColor: "rgba(16, 185, 129, 0.08)",
  border: "1px solid rgba(16, 185, 129, 0.15)",
  padding: "0.4rem 0.8rem",
  borderRadius: "30px",
  fontSize: "0.75rem",
};

const dotStyle: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  backgroundColor: "rgb(16, 185, 129)",
  boxShadow: "0 0 8px rgb(16, 185, 129)",
};

const healthTextStyle: React.CSSProperties = {
  color: "rgb(16, 185, 129)",
  fontWeight: 500,
};

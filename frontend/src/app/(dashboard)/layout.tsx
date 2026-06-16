"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/auth";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isOAuthCallback = typeof window !== "undefined" && (window.location.hash.includes("access_token=") || window.location.search.includes("code="));

    const checkAuth = () => {
      const currentUser = auth.getCurrentUser();
      if (!currentUser) {
        if (!isOAuthCallback) {
          router.push("/login");
        }
      } else {
        setAuthorized(true);
        setLoading(false);
      }
    };

    checkAuth();

    window.addEventListener("storage", checkAuth);
    window.addEventListener("credits_updated", checkAuth);

    let timeoutId: NodeJS.Timeout;
    if (isOAuthCallback) {
      timeoutId = setTimeout(() => {
        if (!auth.isAuthenticated()) {
          router.push("/login");
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("credits_updated", checkAuth);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [router]);

  if (loading || !authorized) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Loading your workspace...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Shared Sidebar */}
      <Sidebar />

      {/* Main Panel */}
      <div className="main-content">
        {/* Shared Navbar */}
        <Navbar />
        {children}
      </div>
    </div>
  );
}

// Inline Styles for Loading State
const loadingContainerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
  color: "hsl(var(--text-secondary))",
};

const spinnerStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "3px solid hsl(var(--border-color))",
  borderTopColor: "hsl(var(--accent))",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

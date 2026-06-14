"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/auth";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      router.push("/login");
    } else {
      const isAdminEmail =
        user.email?.toLowerCase() === "admin@getleads.com" ||
        user.email?.toLowerCase() === "admin@getclient.com" ||
        user.email?.toLowerCase() === "borhan.seoexpert@gmail.com";
      if (!user.is_admin && !isAdminEmail) {
        router.push("/dashboard");
      } else {
        setAuthorized(true);
        setLoading(false);
      }
    }
  }, [router]);

  if (loading || !authorized) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle} />
        <span>Authenticating Admin...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {children}
        </main>
      </div>
    </div>
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

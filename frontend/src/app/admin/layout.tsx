"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/utils/auth";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      router.push("/login");
    } else {
      const isAdminEmail = user.email?.toLowerCase() === "admin@getleads.com" || user.email?.toLowerCase() === "admin@getclient.com" || user.email?.toLowerCase() === "borhan.seoexpert@gmail.com";
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

  const subNavItems = [
    { name: "📊 Overview", path: "/admin" },
    { name: "👥 Users", path: "/admin/users" },
    { name: "🔥 Warmup Pool", path: "/admin/warmup" },
    { name: "💳 Transactions", path: "/admin/transactions" },
    { name: "⚙️ API Settings", path: "/admin/settings" },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="content-pane animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Admin Header & Sub Navigation */}
          <div className="glass-panel" style={adminHeaderStyle}>
            <div style={headerTitleWrapperStyle}>
              <h2 style={titleStyle}>⚙️ Super Admin Control Center</h2>
              <p style={subTitleStyle}>System monitoring, user audits, and credit adjustments</p>
            </div>
            
            {/* Sub-nav Links */}
            <div style={subNavWrapperStyle}>
              {subNavItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    style={{
                      ...subNavItemStyle,
                      color: isActive ? "hsl(var(--text-primary))" : "hsl(var(--text-secondary))",
                      backgroundColor: isActive ? "hsl(var(--accent) / 15%)" : "transparent",
                      borderColor: isActive ? "hsl(var(--accent) / 40%)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = "hsl(var(--bg-tertiary))";
                        e.currentTarget.style.color = "hsl(var(--text-primary))";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "hsl(var(--text-secondary))";
                      }
                    }}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

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

const adminHeaderStyle: React.CSSProperties = {
  padding: "1.5rem 2rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const headerTitleWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "hsl(var(--text-primary))",
};

const subTitleStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "hsl(var(--text-muted))",
};

const subNavWrapperStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  borderTop: "1px solid hsl(var(--border-color))",
  paddingTop: "1rem",
};

const subNavItemStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  fontSize: "0.85rem",
  fontWeight: 500,
  border: "1px solid transparent",
  transition: "all 0.2s ease",
};

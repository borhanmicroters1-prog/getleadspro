"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/utils/auth";
import { useEffect, useState } from "react";

interface MenuItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("User");
  const [userPlan, setUserPlan] = useState("Free");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (user) {
      setUserName(user.name);
      setUserPlan(user.plan);
      setIsAdmin(user.is_admin || user.email?.toLowerCase() === "admin@getleads.com" || user.email?.toLowerCase() === "admin@getclient.com" || user.email?.toLowerCase() === "borhan.seoexpert@gmail.com");
    }
  }, []);

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21.75h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21.75h8.25" />
        </svg>
      )
    },
    {
      name: "All Leads",
      path: "/leads",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0110.089 18H10.07A11.386 11.386 0 015.016 19.237v-.109c0-1.113.285-2.16.786-3.07M19.5 9.75a3 3 0 11-6 0 3 3 0 016 0zM4 19.128a9.38 9.38 0 012.625-.372 9.337 9.337 0 014.121.952 4.125 4.125 0 01-7.533-2.493M4 19.128v-.003c0-1.113.285-2.16.786-3.07M7.5 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      name: "Google Maps Scraper",
      path: "/leads/scraper/google-maps",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      )
    },
    {
      name: "FB Ads Scraper",
      path: "/leads/scraper/facebook-ads",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
        </svg>
      )
    },
    {
      name: "Campaigns",
      path: "/campaigns",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      )
    },
    {
      name: "Analytics",
      path: "/analytics",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.625c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.75v-5.625zM16.5 13.5c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V18.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V13.5zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v10.125c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z" />
        </svg>
      )
    },
    {
      name: "Email Setup",
      path: "/email-accounts",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      )
    },
    {
      name: "Blacklist",
      path: "/blacklist",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      name: "Settings",
      path: "/settings",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.936 6.936 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  const handleLogout = () => {
    auth.logout();
    router.push("/");
  };

  return (
    <aside style={sidebarStyle} className="glass-panel">
      {/* Brand logo */}
      <div style={brandStyle}>
        <div style={logoIconStyle}>GL</div>
        <span style={logoTextStyle}>GetLeads</span>
      </div>

      {/* User profile widget */}
      <div style={profileWidgetStyle}>
        <img 
          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${userName}`} 
          alt="Avatar" 
          style={avatarStyle} 
        />
        <div style={profileInfoStyle}>
          <div style={profileNameStyle}>{userName}</div>
          <span className={`badge ${userPlan === 'Pro' ? 'badge-primary' : 'badge-success'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
            {userPlan} Plan
          </span>
        </div>
      </div>

      {/* Navigation menu */}
      <nav style={navStyle}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              href={item.path}
              style={{
                ...navItemStyle,
                backgroundColor: isActive ? "hsl(var(--accent) / 0.15)" : "transparent",
                color: isActive ? "hsl(var(--text-primary))" : "hsl(var(--text-secondary))",
                borderColor: isActive ? "hsl(var(--accent) / 0.4)" : "transparent"
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
              <span style={{ 
                color: isActive ? "hsl(var(--accent))" : "hsl(var(--text-muted))",
                display: "flex", 
                alignItems: "center" 
              }}>
                {item.icon}
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link 
            href="/admin"
            style={{
              ...navItemStyle,
              backgroundColor: pathname.startsWith("/admin") ? "hsl(var(--accent) / 0.15)" : "transparent",
              color: pathname.startsWith("/admin") ? "hsl(var(--text-primary))" : "hsl(var(--text-secondary))",
              borderColor: pathname.startsWith("/admin") ? "hsl(var(--accent) / 0.4)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/admin")) {
                e.currentTarget.style.backgroundColor = "hsl(var(--bg-tertiary))";
                e.currentTarget.style.color = "hsl(var(--text-primary))";
              }
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/admin")) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "hsl(var(--text-secondary))";
              }
            }}
          >
            <span style={{ 
              color: pathname.startsWith("/admin") ? "hsl(var(--accent))" : "hsl(var(--text-muted))",
              display: "flex", 
              alignItems: "center" 
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </span>
            <span>Admin Panel</span>
          </Link>
        )}
      </nav>

      {/* Logout button */}
      <button 
        onClick={handleLogout} 
        style={logoutButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "hsl(var(--danger) / 0.1)";
          e.currentTarget.style.color = "hsl(var(--danger))";
          e.currentTarget.style.borderColor = "hsl(var(--danger) / 0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "hsl(var(--text-secondary))";
          e.currentTarget.style.borderColor = "transparent";
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "20px", height: "20px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
        </svg>
        <span>Logout</span>
      </button>
    </aside>
  );
}

// Inline Styles
const sidebarStyle: React.CSSProperties = {
  position: "fixed",
  top: "0",
  left: "0",
  bottom: "0",
  width: "var(--sidebar-width)",
  display: "flex",
  flexDirection: "column",
  padding: "1.5rem 1rem",
  borderRadius: "0 16px 16px 0",
  borderTopWidth: "0",
  borderLeftWidth: "0",
  borderBottomWidth: "0",
  zIndex: 100,
};

const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.5rem 0.75rem 1.5rem 0.75rem",
  borderBottom: "1px solid hsl(var(--border-color))",
};

const logoIconStyle: React.CSSProperties = {
  width: "32px",
  height: "32px",
  background: "linear-gradient(135deg, #10B981, #059669)",
  color: "#fff",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontFamily: "var(--font-family-heading)",
  fontSize: "0.9rem",
  boxShadow: "0 2px 10px rgba(16, 185, 129, 0.25)",
};

const logoTextStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: "bold",
  fontFamily: "var(--font-family-heading)",
  color: "hsl(var(--text-primary))",
};

const profileWidgetStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "1rem 0.75rem",
  margin: "1rem 0",
  borderRadius: "12px",
  backgroundColor: "hsl(var(--bg-secondary) / 0.5)",
  border: "1px solid var(--glass-border)",
};

const avatarStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  backgroundColor: "hsl(var(--bg-tertiary))",
  border: "1.5px solid hsl(var(--accent) / 0.3)",
};

const profileInfoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
  minWidth: 0,
};

const profileNameStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "hsl(var(--text-primary))",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
  flex: 1,
};

const navItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  borderRadius: "10px",
  fontSize: "0.9rem",
  fontWeight: 500,
  border: "1px solid transparent",
  cursor: "pointer",
};

const logoutButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  borderRadius: "10px",
  fontSize: "0.9rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
  backgroundColor: "transparent",
  border: "1px solid transparent",
  cursor: "pointer",
  marginTop: "auto",
  textAlign: "left",
  transition: "all 0.2s ease",
};

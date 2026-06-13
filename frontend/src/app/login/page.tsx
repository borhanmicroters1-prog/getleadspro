"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/auth";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    const checkAuthAndRedirect = () => {
      if (auth.isAuthenticated()) {
        router.push("/dashboard");
      }
    };

    checkAuthAndRedirect();

    window.addEventListener("storage", checkAuthAndRedirect);
    window.addEventListener("credits_updated", checkAuthAndRedirect);

    const interval = setInterval(checkAuthAndRedirect, 500);

    return () => {
      window.removeEventListener("storage", checkAuthAndRedirect);
      window.removeEventListener("credits_updated", checkAuthAndRedirect);
      clearInterval(interval);
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password || (!isLogin && !name)) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await auth.login(email, password);
        router.push("/dashboard");
      } else {
        await auth.signUp(email, password, name);
        router.push("/dashboard");
      }
    } catch (err: any) {
      if (err.message && err.message.includes("Verification code sent")) {
        setVerificationSent(true);
        setVerificationEmail(email);
        setError("");
      } else {
        setError(err.message || "An error occurred during authentication.");
      }
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length !== 6) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await auth.verifyCode(verificationEmail, otpCode, name);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Verification failed. Please check the code and try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setIsLoading(true);

    try {
      await auth.loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "An error occurred during Google OAuth.");
      setIsLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div className="glass-panel animate-fade-in" style={cardStyle}>
        {/* Logo */}
        <div style={logoWrapperStyle}>
          <Link href="/" style={logoLinkStyle}>
            <div style={logoIconStyle}>GL</div>
            <span style={logoTextStyle}>GetLeads</span>
          </Link>
        </div>

        {verificationSent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", margin: "1rem 0 0.5rem 0", animation: "pulse 2s infinite" }}>✉️</div>
            <div>
              <h2 style={{ fontSize: "1.5rem", color: "#fff", marginBottom: "0.5rem" }}>Verify your email</h2>
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "0.95rem", lineHeight: "1.6" }}>
                Thanks for signing up! We've sent a 6-digit verification code to <strong style={{ color: "#fff" }}>{verificationEmail}</strong>. Please enter the code below to verify your account.
              </p>
            </div>

            {/* OTP Input Form */}
            <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "0.5rem" }}>
              <div style={inputGroupStyle}>
                <label style={{ ...labelStyle, textAlign: "left" }}>6-Digit Verification Code</label>
                <input 
                  type="text" 
                  maxLength={6}
                  placeholder="123456" 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="input-field" 
                  style={{ 
                    textAlign: "center", 
                    fontSize: "1.5rem", 
                    letterSpacing: "0.25em",
                    fontFamily: "monospace",
                    padding: "0.5rem"
                  }}
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <div style={errorStyle}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: "18px", height: "18px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: "100%", padding: "0.85rem", fontSize: "0.95rem" }}
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Confirm & Create Account"}
              </button>
            </form>

            <button
              onClick={() => {
                setVerificationSent(false);
                setOtpCode("");
                setError("");
              }}
              className="btn btn-secondary"
              style={{ width: "100%", padding: "0.85rem", fontSize: "0.95rem", backgroundColor: "rgba(255, 255, 255, 0.03)" }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={headerStyle}>
              <h2 style={titleStyle}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
              <p style={subtitleStyle}>
                {isLogin 
                  ? "Sign in to manage your campaigns and leads" 
                  : "Get started with 50 free scraping credits"
                }
              </p>
            </div>

            {error && (
              <div style={errorStyle}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: "18px", height: "18px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={formStyle}>
              {!isLogin && (
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field" 
                    disabled={isLoading}
                  />
                </div>
              )}

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Email Address</label>
                <input 
                  type="email" 
                  placeholder="you@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field" 
                  disabled={isLoading}
                  required
                />
              </div>

              <div style={inputGroupStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={labelStyle}>Password</label>
                  {isLogin && <a href="#" style={forgotPasswordLinkStyle}>Forgot?</a>}
                </div>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field" 
                  disabled={isLoading}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={submitButtonStyle}
                disabled={isLoading}
              >
                {isLoading ? "Authenticating..." : isLogin ? "Sign In" : "Sign Up"}
              </button>
            </form>

            {/* Divider */}
            <div style={dividerStyle}>
              <div style={dividerLineStyle} />
              <span style={dividerTextStyle}>or continue with</span>
              <div style={dividerLineStyle} />
            </div>

            {/* Google OAuth Button */}
            <button 
              onClick={handleGoogleLogin} 
              className="btn btn-secondary" 
              style={googleButtonStyle}
              disabled={isLoading}
            >
              <svg style={googleIconStyle} viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Sign In with Google</span>
            </button>

            {/* Footer */}
            <p style={footerTextStyle}>
              {isLogin ? "New to GetLeads? " : "Already have an account? "}
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }} 
                style={toggleButtonStyle}
              >
                {isLogin ? "Create account" : "Sign in here"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  padding: "2.5rem",
  display: "flex",
  flexDirection: "column",
};

const logoWrapperStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "1.5rem",
};

const logoLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.75rem",
};

const logoIconStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  background: "linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent-secondary)))",
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
  fontFamily: "var(--font-family-heading)",
  background: "linear-gradient(135deg, #fff, hsl(var(--text-secondary)))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "2rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  color: "#fff",
  marginBottom: "0.4rem",
};

const subtitleStyle: React.CSSProperties = {
  color: "hsl(var(--text-secondary))",
  fontSize: "0.9rem",
};

const errorStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  backgroundColor: "hsl(var(--danger) / 0.1)",
  border: "1px solid hsl(var(--danger) / 0.2)",
  color: "hsl(var(--danger))",
  padding: "0.75rem 1rem",
  borderRadius: "10px",
  fontSize: "0.85rem",
  marginBottom: "1.5rem",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "hsl(var(--text-secondary))",
};

const forgotPasswordLinkStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "hsl(var(--accent))",
  fontWeight: 500,
};

const submitButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.8rem",
  marginTop: "0.5rem",
  fontSize: "0.95rem",
};

const dividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1rem",
  margin: "1.5rem 0",
};

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: "1px",
  backgroundColor: "hsl(var(--border-color))",
};

const dividerTextStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "hsl(var(--text-muted))",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const googleButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.8rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.75rem",
  fontSize: "0.95rem",
  backgroundColor: "rgba(255, 255, 255, 0.03)",
};

const googleIconStyle: React.CSSProperties = {
  flexShrink: 0,
};

const footerTextStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: "2rem",
  fontSize: "0.85rem",
  color: "hsl(var(--text-secondary))",
};

const toggleButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "hsl(var(--accent))",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "inherit",
  fontFamily: "inherit",
  padding: 0,
};

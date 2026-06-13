import { createClient } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  plan: string;
  credits: number;
  is_admin?: boolean;
}

const STORAGE_KEY = "getleads_session";
const TOKEN_KEY = "getleads_token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Synchronize Supabase authentication state with local storage
if (typeof window !== "undefined" && supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const user = session.user;
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
        avatar: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.id}`,
        plan: "Free",
        credits: 50,
        is_admin: user.email?.toLowerCase() === "admin@getleads.com" || user.email?.toLowerCase() === "admin@getclient.com" || user.email?.toLowerCase() === "borhan.seoexpert@gmail.com"
      };
      
      // Fetch latest profile settings from backend database
      try {
        const apiBase = window.location.hostname !== "localhost" ? "/api/proxy" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
          }
        });
        if (res.ok) {
          const dbUser = await res.json();
          userProfile.name = dbUser.name || userProfile.name;
          userProfile.avatar = dbUser.avatar || userProfile.avatar;
          userProfile.plan = dbUser.plan || userProfile.plan;
          userProfile.credits = dbUser.credits !== undefined ? dbUser.credits : userProfile.credits;
          userProfile.is_admin = dbUser.is_admin !== undefined ? dbUser.is_admin : userProfile.is_admin;
        }
      } catch (e) {
        console.error("Failed to sync auth profile with backend database:", e);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
      localStorage.setItem(TOKEN_KEY, session.access_token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
    
    // Dispatch events to trigger UI re-renders
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("credits_updated"));
  });
}

export const auth = {
  isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(STORAGE_KEY);
  },

  getCurrentUser(): UserProfile | null {
    if (typeof window === "undefined") return null;
    const session = localStorage.getItem(STORAGE_KEY);
    if (!session) return null;
    try {
      return JSON.parse(session) as UserProfile;
    } catch {
      return null;
    }
  },

  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  async login(email: string, password?: string): Promise<UserProfile> {
    if (!supabase) {
      throw new Error("Authentication service (Supabase) is not configured.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    // Wait briefly for onAuthStateChange to populate localStorage
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error("Failed to retrieve user profile after login.");
    }
    return user;
  },

  async signUp(email: string, password?: string, name?: string): Promise<UserProfile> {
    if (!supabase) {
      throw new Error("Authentication service (Supabase) is not configured.");
    }
    if (!password) {
      throw new Error("Password is required.");
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split("@")[0]
        }
      }
    });
    if (error) {
      throw new Error(error.message);
    }
    // If email verification is enabled, session might be null initially
    if (data.session) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error("Failed to retrieve user profile after registration.");
      }
      return user;
    } else {
      throw new Error("Verification email sent! Please check your inbox before logging in.");
    }
  },

  async verifyCode(email: string, code: string, name?: string): Promise<UserProfile> {
    if (!supabase) {
      throw new Error("Authentication service (Supabase) is not configured.");
    }
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup'
    });
    if (error) {
      throw new Error(error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error("Failed to retrieve user profile after verification.");
    }
    return user;
  },

  async loginWithGoogle(): Promise<void> {
    if (!supabase) {
      throw new Error("Authentication service (Supabase) is not configured.");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard"
      }
    });
    if (error) {
      throw new Error(error.message);
    }
  },

  async logout(): Promise<void> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("credits_updated"));
    }
  },

  updateCurrentUserProfile(profile: UserProfile): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("credits_updated"));
  }
};

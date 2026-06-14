import { auth, supabase } from "./auth";

// In production, use same-origin proxy to avoid CORS issues.
// In development, call backend directly.
const IS_PRODUCTION = typeof window !== "undefined" && window.location.hostname !== "localhost";
const BASE_URL = IS_PRODUCTION ? "/api/proxy" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  isMultipart?: boolean;
  isBlob?: boolean;
  _isRetry?: boolean; // Internal flag to prevent infinite retry loops
}

/** Attempts to refresh the Supabase session and update localStorage token. */
async function tryRefreshToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return null;
    // Update token in localStorage immediately so the retry picks it up
    localStorage.setItem("getleads_token", data.session.access_token);
    return data.session.access_token;
  } catch {
    return null;
  }
}

async function request(endpoint: string, options: RequestOptions = {}) {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers: Record<string, string> = { ...options.headers };
  
  // Set Authorization header if user is authenticated
  const token = auth.getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Set Content-Type to application/json by default unless it's multipart
  if (!options.isMultipart && options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body) {
    fetchOptions.body = options.isMultipart ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  // Handle 401 — try to refresh the token once and retry
  if (response.status === 401 && !options._isRetry) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      // Retry the same request with the fresh token
      return request(endpoint, { ...options, _isRetry: true });
    }
    // Refresh failed — force logout and redirect to login
    if (typeof window !== "undefined") {
      auth.logout().catch(() => {});
      window.location.href = "/login";
    }
    throw new Error("Token has expired. Please log in again.");
  }

  if (!response.ok) {
    let errorDetail = "An error occurred";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  if (options.isBlob) {
    return response.blob();
  }

  return response.json();
}

export const api = {
  get(endpoint: string, params?: Record<string, any>) {
    let queryStr = "";
    if (params) {
      const cleanParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          cleanParams[key] = String(val);
        }
      });
      queryStr = "?" + new URLSearchParams(cleanParams).toString();
    }
    return request(`${endpoint}${queryStr}`, { method: "GET" });
  },

  post(endpoint: string, body: any, options: { isMultipart?: boolean } = {}) {
    return request(endpoint, {
      method: "POST",
      body,
      isMultipart: options.isMultipart,
    });
  },

  put(endpoint: string, body: any) {
    return request(endpoint, {
      method: "PUT",
      body,
    });
  },

  delete(endpoint: string) {
    return request(endpoint, { method: "DELETE" });
  },

  download(endpoint: string, params?: Record<string, any>) {
    let queryStr = "";
    if (params) {
      const cleanParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          cleanParams[key] = String(val);
        }
      });
      queryStr = "?" + new URLSearchParams(cleanParams).toString();
    }
    return request(`${endpoint}${queryStr}`, { method: "GET", isBlob: true });
  },
};

import { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session expiry: 6 hours
const SESSION_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const loginTime = localStorage.getItem("login_time");
    
    if (stored && loginTime) {
      const elapsed = Date.now() - parseInt(loginTime);
      
      // Check if 6 hours have passed
      if (elapsed >= SESSION_DURATION) {
        // Session expired - auto logout
        logout();
        window.location.href = "/login";
      } else {
        setUser(JSON.parse(stored));
        
        // Set timeout to auto-logout when 6 hours are reached
        const remainingTime = SESSION_DURATION - elapsed;
        const timeoutId = setTimeout(() => {
          logout();
          alert("Your session has expired after 6 hours. Please login again.");
          window.location.href = "/login";
        }, remainingTime);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, []);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("login_time");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

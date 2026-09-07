import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "technician" | "employee";
  phone?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Omit<Profile, 'id' | 'email' | 'role'>>) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProfile = async (userId?: string) => {
    try {
      const response = await apiClient.getProfile();
      const userData = response.user || response.profile || response;
      if (userData) {
        setProfile({
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role as "admin" | "technician" | "employee",
          phone: userData.phone,
          department: userData.department || userData.department_id,
          avatar_url: userData.avatar_url,
          branch_id: userData.branch_id,
          department_id: userData.department_id,
          created_at: userData.created_at,
          updated_at: userData.updated_at,
        });
        // If we have a user object from JWT token, sync it
        if (!user && userData.id && userData.email) {
          setUser({ id: userData.id, email: userData.email });
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  useEffect(() => {
    // Check for existing JWT tokens on mount
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      // Try to restore session by fetching profile
      apiClient.getProfile()
        .then((response) => {
          const userData = response.user || response.profile || response;
          if (userData) {
            setUser({ id: userData.id, email: userData.email });
            setProfile({
              id: userData.id,
              email: userData.email,
              full_name: userData.full_name,
              role: userData.role,
              phone: userData.phone,
              department: userData.department || userData.department_id,
              avatar_url: userData.avatar_url,
              branch_id: userData.branch_id,
              department_id: userData.department_id,
              created_at: userData.created_at,
              updated_at: userData.updated_at,
            });
          }
        })
        .catch((error) => {
          // Token may be invalid; clear it
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          console.error("Session restore failed:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiClient.login(email, password);
      const userData = data.user || data.profile || data;
      if (userData && userData.id && userData.email) {
        setUser({ id: userData.id, email: userData.email });
      }
      // Fetch profile for full details
      await fetchProfile();
      return { error: null };
    } catch (error: any) {
      return { error: error.message || "Login failed" };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const data = await apiClient.register(email, password, fullName);
      const userData = data.user || data.profile || data;
      if (userData && userData.id && userData.email) {
        setUser({ id: userData.id, email: userData.email });
      }
      return { error: null };
    } catch (error: any) {
      return { error: error.message || "Registration failed" };
    }
  };

  const signOut = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      setUser(null);
      setProfile(null);
      navigate("/auth");
    }
  };

  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'email' | 'role'>>) => {
    if (!user) return { error: "Not authenticated" };
    try {
      const response = await apiClient.updateProfile(updates);
      await fetchProfile();
      return { error: null };
    } catch (error: any) {
      return { error: error.message || "Update failed" };
    }
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

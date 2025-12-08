import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  branch_id?: string;
  department_id?: string;
}

interface AuthContextType {
  user: User | null;
  profile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session on app load
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          // Verify token is still valid by fetching profile
          const profileData = await apiClient.getProfile();
          setUser(profileData.user);
          setProfile(profileData.user);
        } catch (error) {
          console.error('Token validation failed:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password);
      setUser(response.user);
      setProfile(response.user);
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const response = await apiClient.register(email, password, fullName);
      setUser(response.user);
      setProfile(response.user);
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setProfile(null);
      navigate('/auth');
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      const response = await apiClient.updateProfile(updates);
      setProfile(response.user);
      return { error: null };
    } catch (error: any) {
      return { error: error.message };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const profileData = await apiClient.getProfile();
        setProfile(profileData.user);
      } catch (error) {
        console.error('Profile refresh failed:', error);
      }
    }
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

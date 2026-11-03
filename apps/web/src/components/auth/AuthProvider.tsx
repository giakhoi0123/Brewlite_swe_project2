'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMeApi, loginApi, logoutApi, registerApi } from '../../services/auth-api';
import { User } from '../../types/auth';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'brewlite_access_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      if (storedToken) {
        setToken(storedToken);
      }
      const data = await getMeApi(storedToken);
      setUser(data.user);
    } catch {
      setUser(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await loginApi(email, password);
    setUser(res.user);
    setToken(res.accessToken);
    if (typeof window !== 'undefined' && res.accessToken) {
      localStorage.setItem(TOKEN_KEY, res.accessToken);
    }
    return res.user;
  };

  const register = async (fullName: string, email: string, password: string): Promise<User> => {
    const res = await registerApi(fullName, email, password);
    setUser(res.user);
    setToken(res.accessToken);
    if (typeof window !== 'undefined' && res.accessToken) {
      localStorage.setItem(TOKEN_KEY, res.accessToken);
    }
    return res.user;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng trong AuthProvider');
  }
  return context;
}

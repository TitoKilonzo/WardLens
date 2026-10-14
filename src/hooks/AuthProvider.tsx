import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setToken } from '../utils/api';
import type { Role, User } from '../types';

interface AuthContextValue { user: User | null; loading: boolean; signIn: (email: string, password: string, role: Role) => Promise<void>; signUp: (data: { name:string; email:string; password:string; ward_id:number }) => Promise<void>; signOut: () => Promise<void>; }
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<{ user: User }>('/auth/me').then((data) => { if (active) setUser(data.user); }).catch(() => { setToken(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading,
    async signIn(email, password, role) { const data = await api<{ token:string; user:User }>('/auth/login', { method:'POST', body:JSON.stringify({ email,password,role }) }); setToken(data.token); setUser(data.user); },
    async signUp(data) { const result = await api<{ token:string; user:User }>('/auth/register', { method:'POST', body:JSON.stringify(data) }); setToken(result.token); setUser(result.user); },
    async signOut() { try { await api('/auth/logout', { method:'POST' }); } finally { setToken(null); setUser(null); } }
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

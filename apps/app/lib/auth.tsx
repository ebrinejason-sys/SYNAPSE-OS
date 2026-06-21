import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { apiRequest } from './api'

const TOKEN_KEY = 'synapse_mobile_token'

export interface MobileUser {
  id: string
  email: string
  role: string
  fullName: string | null
  tenantId: string
  tenantName: string
  isAdmin: boolean
  mustChangePassword: boolean
}

interface AuthState {
  user: MobileUser | null
  token: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  verifyLoginOtp: (email: string, otp: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
  })

  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const stored = await Promise.race([
          SecureStore.getItemAsync(TOKEN_KEY),
          new Promise<string | null>((resolve) => {
            setTimeout(() => resolve(null), 8_000)
          }),
        ])
        if (cancelled) return
        if (!stored) {
          setState({ user: null, token: null, isLoading: false })
          return
        }
        const user = await apiRequest<MobileUser>('/api/auth/mobile/me', {
          token: stored,
          timeoutMs: 20_000,
        })
        if (cancelled) return
        setState({ user, token: stored, isLoading: false })
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {})
        if (!cancelled) {
          setState({ user: null, token: null, isLoading: false })
        }
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await apiRequest<{ otpSent: boolean }>(
      '/api/auth/mobile/login',
      { method: 'POST', body: { email, password } }
    )
  }, [])

  const verifyLoginOtp = useCallback(async (email: string, otp: string) => {
    const data = await apiRequest<{ token: string; user: MobileUser }>(
      '/api/auth/mobile/otp-verify',
      { method: 'POST', body: { email, otp } }
    )
    await SecureStore.setItemAsync(TOKEN_KEY, data.token)
    setState({ user: data.user, token: data.token, isLoading: false })
  }, [])

  const logout = useCallback(async () => {
    const currentToken = state.token
    setState({ user: null, token: null, isLoading: false })
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {})
    if (currentToken) {
      await apiRequest('/api/auth/mobile/logout', {
        method: 'POST',
        token: currentToken,
      }).catch(() => {})
    }
  }, [state.token])

  return (
    <AuthContext.Provider value={{ ...state, login, verifyLoginOtp, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

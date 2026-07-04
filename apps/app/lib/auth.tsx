import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { apiRequest } from './api'

const TOKEN_KEY = 'synapse_mobile_token'
const BIOMETRIC_LAST_KEY = 'synapse_biometric_last_auth'
const BIOMETRIC_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export interface MobileUser {
  id: string
  email: string
  role: string
  fullName: string | null
  synapseId: string | null
  tenantId: string
  tenantName: string
  isAdmin: boolean
  mustChangePassword: boolean
  dashboardKind: string
}

interface AuthState {
  user: MobileUser | null
  token: string | null
  isLoading: boolean
  isLocked: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  verifyLoginOtp: (email: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  unlock: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isLocked: false,
  })

  const backgroundedAt = useRef<number | null>(null)

  // Biometric lock: if app was backgrounded > 5 min, lock on return
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now()
      } else if (nextState === 'active') {
        const bg = backgroundedAt.current
        if (bg !== null && Date.now() - bg > BIOMETRIC_TIMEOUT_MS && state.token) {
          setState((prev) => ({ ...prev, isLocked: true }))
        }
        backgroundedAt.current = null
      }
    }
    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [state.token])

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
          setState({ user: null, token: null, isLoading: false, isLocked: false })
          return
        }
        const user = await apiRequest<MobileUser>('/api/auth/mobile/me', {
          token: stored,
          timeoutMs: 20_000,
        })
        if (cancelled) return
        setState({
          user: {
            ...user,
            synapseId: user.synapseId ?? null,
            dashboardKind: user.dashboardKind ?? 'generic',
          },
          token: stored,
          isLoading: false,
          isLocked: false,
        })
        // Register push token after session restore
        registerPushToken(stored, user.role).catch(() => {})
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {})
        if (!cancelled) {
          setState({ user: null, token: null, isLoading: false, isLocked: false })
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
    setState({ user: data.user, token: data.token, isLoading: false, isLocked: false })
    // Register push token after new login
    registerPushToken(data.token, data.user.role).catch(() => {})
  }, [])

  const logout = useCallback(async () => {
    const currentToken = state.token
    setState({ user: null, token: null, isLoading: false, isLocked: false })
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {})
    if (currentToken) {
      // Deregister push token
      deregisterPushToken(currentToken).catch(() => {})
      await apiRequest('/api/auth/mobile/logout', {
        method: 'POST',
        token: currentToken,
      }).catch(() => {})
    }
  }, [state.token])

  const unlock = useCallback(async (): Promise<boolean> => {
    try {
      const hasBiometrics = await LocalAuthentication.hasHardwareAsync()
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()

      if (!hasBiometrics || !isEnrolled) {
        // No biometrics available — auto-unlock (user must re-login for true security)
        setState((prev) => ({ ...prev, isLocked: false }))
        return true
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm it\'s you',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Sign out',
        disableDeviceFallback: false,
      })

      if (result.success) {
        setState((prev) => ({ ...prev, isLocked: false }))
        return true
      }

      // User pressed cancel — force logout
      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        logout()
      }
      return false
    } catch {
      setState((prev) => ({ ...prev, isLocked: false }))
      return true
    }
  }, [logout])

  return (
    <AuthContext.Provider value={{ ...state, login, verifyLoginOtp, logout, unlock }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Push notification helpers

async function registerPushToken(token: string, role: string) {
  if (!Device.isDevice) return

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return

  const pushToken = await Notifications.getExpoPushTokenAsync().catch(() => null)
  if (!pushToken) return

  await apiRequest('/api/mobile/push-token', {
    method: 'POST',
    token,
    body: { token: pushToken.data, deviceId: await getDeviceId(), role },
  }).catch(() => {})
}

async function deregisterPushToken(token: string) {
  await apiRequest('/api/mobile/push-token', {
    method: 'DELETE',
    token,
    body: { deviceId: await getDeviceId() },
  }).catch(() => {})
}

async function getDeviceId(): Promise<string> {
  const stored = await SecureStore.getItemAsync('synapse_device_id')
  if (stored) return stored
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await SecureStore.setItemAsync('synapse_device_id', id)
  return id
}

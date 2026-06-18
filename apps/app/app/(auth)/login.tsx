import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth'

type Step = 'credentials' | 'otp'

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, verifyLoginOtp } = useAuth()
  const router = useRouter()

  const handleCredentials = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await login(email.trim().toLowerCase(), password)
      setStep('otp')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtp = async () => {
    if (otp.length !== 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await verifyLoginOtp(email.trim().toLowerCase(), otp)
      router.replace('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>S</Text>
          </View>
          <Text style={styles.logoText}>
            Synapse <Text style={styles.logoAccent}>Health</Text>
          </Text>
          <Text style={styles.logoSub}>
            {step === 'credentials' ? 'Sign in to continue' : 'Enter verification code'}
          </Text>
        </View>

        <View style={styles.card}>
          {step === 'credentials' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@hospital.org"
                  placeholderTextColor="#52525B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  style={styles.input}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#52525B"
                  secureTextEntry
                  autoComplete="password"
                  editable={!isLoading}
                  style={styles.input}
                />
              </View>
            </>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Email code</Text>
              <TextInput
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor="#52525B"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                editable={!isLoading}
                style={[styles.input, styles.otpInput]}
              />
              <Text style={styles.hint}>Sent to {email}</Text>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={step === 'credentials' ? handleCredentials : handleOtp}
            disabled={isLoading}
            style={[styles.btn, isLoading && styles.btnDisabled]}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {step === 'credentials' ? 'Continue' : 'Verify & Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {step === 'otp' ? (
            <TouchableOpacity
              onPress={() => { setStep('credentials'); setOtp(''); setError(null) }}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>Back</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070A' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoMark: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#F97316',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  logoLetter: { color: '#fff', fontSize: 28, fontWeight: '900' },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  logoAccent: { color: '#E8B84B' },
  logoSub: { color: '#71717A', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#111117',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 24,
  },
  field: { marginBottom: 16 },
  label: {
    color: '#A1A1AA', fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  input: {
    backgroundColor: '#18181B', borderRadius: 12,
    borderWidth: 1, borderColor: '#27272A',
    color: '#fff', fontSize: 15, padding: 14,
  },
  otpInput: { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontVariant: ['tabular-nums'] },
  hint: { color: '#71717A', fontSize: 12, marginTop: 8, textAlign: 'center' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { color: '#F87171', fontSize: 13 },
  btn: {
    backgroundColor: '#F97316', borderRadius: 12,
    height: 50, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#FB7E3C', fontSize: 14 },
})

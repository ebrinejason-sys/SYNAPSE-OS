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

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/(main)/home')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Try again.')
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
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>S</Text>
          </View>
          <Text style={styles.logoText}>
            Synapse <Text style={styles.logoAccent}>Health</Text>
          </Text>
          <Text style={styles.logoSub}>Clinical Staff Portal</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
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
              returnKeyType="next"
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
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!isLoading}
              style={styles.input}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            style={[styles.btn, isLoading && styles.btnDisabled]}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Synapse Health Technologies © {new Date().getFullYear()}
        </Text>
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
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
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
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  footer: {
    textAlign: 'center', color: '#3F3F46', fontSize: 12, marginTop: 28,
  },
})

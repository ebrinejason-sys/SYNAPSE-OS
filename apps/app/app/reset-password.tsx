import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BrandWordmark } from '@/components/BrandWordmark'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { apiRequest, ApiError } from '@/lib/api'
import { radii, spacing, typography, useTheme } from '@/lib/theme'

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>()
  const [token, setToken] = useState(typeof params.token === 'string' ? params.token : '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const submit = async () => {
    if (!token.trim()) {
      setError('Paste the reset token from your email link.')
      return
    }
    if (!password || password !== confirm) {
      setError('New password and confirmation must match.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await apiRequest('/api/auth/mobile/reset-password', {
        method: 'POST',
        body: { token: token.trim(), password },
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Screen glow>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandWordmark logoSize="xl" subtitle="Choose a new password" />

          <Card padded={false}>
            <View style={styles.formInner}>
              {done ? (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>Password updated</Text>
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    You can sign in with your new password.
                  </Text>
                  <Button label="Sign in" onPress={() => router.replace('/(auth)/login')} />
                </>
              ) : (
                <>
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    Open the reset link from your email on this phone, or paste the token from the
                    link, then set a new password.
                  </Text>
                  <TextField
                    label="Reset token"
                    value={token}
                    onChangeText={setToken}
                    placeholder="Token from email link"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <TextField
                    label="New password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="new-password"
                    editable={!isLoading}
                  />
                  <TextField
                    label="Confirm password"
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="new-password"
                    editable={!isLoading}
                  />
                  {error ? (
                    <View style={[styles.errorBox, { backgroundColor: colors.errorBg, borderColor: colors.errorBorder }]}>
                      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                  ) : null}
                  <Button label="Update password" onPress={submit} loading={isLoading} />
                  <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.linkBtn}>
                    <Text style={[styles.linkText, { color: colors.primary }]}>Back to sign in</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.xxxl,
  },
  formInner: { padding: spacing.xxl, gap: spacing.sm },
  title: { ...typography.h3, fontFamily: 'DMSans_700Bold', marginBottom: spacing.sm },
  help: { ...typography.bodySm, fontFamily: 'DMSans_400Regular', marginBottom: spacing.sm },
  errorBox: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  linkBtn: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { ...typography.bodyMedium, fontFamily: 'DMSans_500Medium' },
})

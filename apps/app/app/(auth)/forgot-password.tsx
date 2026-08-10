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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { BrandWordmark } from '@/components/BrandWordmark'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { apiRequest, ApiError } from '@/lib/api'
import { radii, spacing, typography, useTheme } from '@/lib/theme'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  const submit = async () => {
    if (!email.trim()) {
      setError('Enter the email on your account.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await apiRequest('/api/auth/mobile/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send reset email. Try again.')
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
          <BrandWordmark logoSize="xl" subtitle="Reset your password" />

          <Card style={styles.formCard} padded={false}>
            <View style={styles.formInner}>
              {sent ? (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    If an account exists for {email.trim().toLowerCase()}, we sent a reset link.
                    Open it to set a new password, then sign in here.
                  </Text>
                  <Button label="Back to sign in" onPress={() => router.replace('/(auth)/login')} />
                  <Pressable
                    onPress={() => router.push({ pathname: '/reset-password', params: {} } as never)}
                    style={styles.linkBtn}
                  >
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      I already have a reset token
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.help, { color: colors.textSecondary }]}>
                    Enter your work email and we will send a secure link to choose a new password.
                  </Text>
                  <TextField
                    label="Email address"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@pharmacy.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!isLoading}
                  />
                  {error ? (
                    <View style={[styles.errorBox, { backgroundColor: colors.errorBg, borderColor: colors.errorBorder }]}>
                      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                  ) : null}
                  <Button label="Send reset link" onPress={submit} loading={isLoading} />
                  <Pressable onPress={() => router.back()} style={styles.linkBtn}>
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
  formCard: { marginTop: spacing.sm },
  formInner: { padding: spacing.xxl, gap: spacing.md },
  title: { ...typography.h3, fontFamily: 'DMSans_700Bold' },
  help: { ...typography.bodySm, fontFamily: 'DMSans_400Regular', marginBottom: spacing.sm },
  errorBox: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: {
    ...typography.caption,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  linkBtn: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { ...typography.bodyMedium, fontFamily: 'DMSans_500Medium' },
})

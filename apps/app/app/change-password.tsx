import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { apiRequest, ApiError } from '@/lib/api'
import { colors, radii, spacing, typography } from '@/lib/theme'

export default function ChangePasswordScreen() {
  const { token, refreshUser, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!token) return
    if (!current || !next) {
      Alert.alert('Missing fields', 'Enter your current and new password.')
      return
    }
    if (next !== confirm) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.')
      return
    }
    setSaving(true)
    try {
      await apiRequest('/api/auth/mobile/change-password', {
        method: 'POST',
        token,
        body: { currentPassword: current, newPassword: next },
      })
      await refreshUser()
      // Back to the entry gate, which now routes to onboarding or home.
      router.replace('/' as never)
    } catch (err) {
      Alert.alert('Could not change password', err instanceof ApiError ? err.message : 'Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.help}>
          For your security you must change the temporary password before continuing.
        </Text>

        <Text style={styles.label}>Current password</Text>
        <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" placeholder="Current password" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>New password</Text>
        <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" placeholder="New password" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" placeholder="Confirm new password" placeholderTextColor={colors.textMuted} />

        <Button label="Update password" onPress={submit} loading={saving} />
        <Button label="Sign out" onPress={() => logout()} variant="ghost" style={styles.signOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.h2, color: colors.text, fontFamily: 'BricolageGrotesque_700Bold' },
  help: { ...typography.bodySm, color: colors.textSecondary, fontFamily: 'DMSans_400Regular', marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, fontFamily: 'DMSans_500Medium' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.bgElevated,
    fontFamily: 'DMSans_400Regular',
  },
  signOut: { marginTop: spacing.sm },
})

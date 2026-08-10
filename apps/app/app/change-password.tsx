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
import { radii, spacing, typography, useTheme } from '@/lib/theme'

export default function ChangePasswordScreen() {
  const { token, user, refreshUser, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const forced = Boolean(user?.mustChangePassword)
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
      Alert.alert('Password updated', 'Your password has been changed.')
      router.replace(forced ? ('/' as never) : ('/(main)/profile' as never))
    } catch (err) {
      Alert.alert('Could not change password', err instanceof ApiError ? err.message : 'Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {forced ? 'Set a new password' : 'Change password'}
        </Text>
        <Text style={[styles.help, { color: colors.textSecondary }]}>
          {forced
            ? 'For your security you must change the temporary password before continuing.'
            : 'Choose a strong password you have not used elsewhere.'}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Current password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgElevated, borderColor: colors.border, color: colors.text }]}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Current password"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>New password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgElevated, borderColor: colors.border, color: colors.text }]}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoCapitalize="none"
          placeholder="New password"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm new password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgElevated, borderColor: colors.border, color: colors.text }]}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Confirm password"
          placeholderTextColor={colors.textMuted}
        />

        <Button label="Update password" onPress={submit} loading={saving} />
        {forced ? (
          <Button label="Sign out" onPress={() => logout()} variant="ghost" style={styles.signOut} />
        ) : (
          <Button label="Cancel" onPress={() => router.back()} variant="ghost" style={styles.signOut} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.h2, fontFamily: 'DMSans_700Bold', marginBottom: spacing.sm },
  help: { ...typography.bodySm, fontFamily: 'DMSans_400Regular', marginBottom: spacing.lg },
  label: { ...typography.caption, fontFamily: 'DMSans_500Medium', marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontFamily: 'DMSans_400Regular',
    marginBottom: spacing.sm,
  },
  signOut: { marginTop: spacing.md },
})

import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SynapseLogo } from '@/components/SynapseLogo'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { spacing, typography, useTheme } from '@/lib/theme'

export function LockScreen() {
  const { unlock } = useAuth()
  const { colors } = useTheme()
  const [attempting, setAttempting] = useState(true)
  const triedOnMount = useRef(false)

  useEffect(() => {
    if (triedOnMount.current) return
    triedOnMount.current = true
    unlock().finally(() => setAttempting(false))
  }, [unlock])

  function handlePress() {
    setAttempting(true)
    unlock().finally(() => setAttempting(false))
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SynapseLogo size="lg" />
      <Text style={[styles.title, { color: colors.text }]}>Locked</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>Confirm it&apos;s you to continue.</Text>
      {attempting ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : (
        <Button label="Unlock" onPress={handlePress} style={styles.button} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  title: {
    ...typography.title,
    marginTop: spacing.md,
  },
  body: {
    ...typography.body,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  spinner: { marginTop: spacing.md },
  button: { minWidth: 160, marginTop: spacing.md },
})

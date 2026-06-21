import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Redirect } from 'expo-router'
import { SynapseLogo } from '@/components/SynapseLogo'
import { useAuth } from '@/lib/auth'
import { colors } from '@/lib/theme'

export default function Index() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={styles.root}>
        <SynapseLogo size="lg" />
        <ActivityIndicator color={colors.primary} size="large" style={styles.spinner} />
      </View>
    )
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />
  }

  return <Redirect href="/(main)/home" />
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    gap: 24,
  },
  spinner: { marginTop: 8 },
})

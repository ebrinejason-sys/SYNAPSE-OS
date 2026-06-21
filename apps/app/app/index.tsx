import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '@/lib/auth'

export default function Index() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#07070A' }}>
        <ActivityIndicator color="#F97316" size="large" />
      </View>
    )
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />
  }

  // Every authenticated user lands on the same role-aware dashboard, which renders
  // the appropriate experience for their role (resolved from the /me + /dashboard endpoints).
  return <Redirect href="/(main)/home" />
}

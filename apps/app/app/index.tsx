import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '@/lib/auth'

function homeForRole(role: string | undefined): string {
  if (role === 'patient') return '/(main)/patient-home'
  return '/(main)/home'
}

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

  return <Redirect href={homeForRole(user.role) as '/(main)/home' | '/(main)/patient-home'} />
}

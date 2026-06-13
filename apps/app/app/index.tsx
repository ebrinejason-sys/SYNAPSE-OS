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

  return <Redirect href={user ? '/(main)/home' : '/(auth)/login'} />
}

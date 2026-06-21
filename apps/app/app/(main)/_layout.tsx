import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/lib/auth'
import { isClinicalRole } from '@/lib/roles'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

interface TabIconProps {
  name: IoniconsName
  focused: boolean
}

function TabIcon({ name, focused }: TabIconProps) {
  return <Ionicons name={name} size={24} color={focused ? '#F97316' : '#52525B'} />
}

export default function MainLayout() {
  const { user } = useAuth()
  const showPatients = isClinicalRole(user?.role)

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#111117',
          borderTopColor: '#1C1C24',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#F97316',
        tabBarInactiveTintColor: '#52525B',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#07070A' },
        headerTitleStyle: { color: '#fff', fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: 'Patients',
          headerShown: true,
          // Hide the Patients tab for non-clinical roles (patient, pharmacy, billing).
          href: showPatients ? undefined : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}

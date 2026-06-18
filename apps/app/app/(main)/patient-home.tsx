import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/lib/auth'

export default function PatientHomeScreen() {
  const { user } = useAuth()

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        Hello{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
      </Text>
      <Text style={styles.sub}>Your health summary</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Records & visits</Text>
        <Text style={styles.cardBody}>
          View lab results, medications, and visit history from your care team.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Appointments</Text>
        <Text style={styles.cardBody}>No upcoming appointments scheduled.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Medications</Text>
        <Text style={styles.cardBody}>Your active prescriptions will appear here.</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070A' },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { color: '#ECECEF', fontSize: 24, fontWeight: '600', marginBottom: 4 },
  sub: { color: '#71717A', fontSize: 14, marginBottom: 24 },
  card: {
    backgroundColor: '#16161B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26262C',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: '#ECECEF', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cardBody: { color: '#A1A1AC', fontSize: 14, lineHeight: 20 },
})

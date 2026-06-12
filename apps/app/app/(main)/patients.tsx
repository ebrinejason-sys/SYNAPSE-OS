import { StyleSheet, Text, View } from 'react-native'

export default function PatientsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.icon}>👤</Text>
        <Text style={styles.title}>Patient Search</Text>
        <Text style={styles.subtitle}>Search and view patient records</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Coming soon</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#52525B', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  pill: {
    backgroundColor: '#18181B', borderRadius: 20, borderWidth: 1,
    borderColor: '#27272A', paddingHorizontal: 16, paddingVertical: 6,
  },
  pillText: { color: '#71717A', fontSize: 12, fontWeight: '600' },
})

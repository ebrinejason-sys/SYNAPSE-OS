import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, FlatList, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { apiRequest } from '@/lib/api'

interface Patient {
  id: string
  fullName: string
  mrn: string | null
  dateOfBirth: string | null
  sex: string | null
  createdAt: string
}

export default function PatientsScreen() {
  const { token } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!token) {
      setLoading(false)
      return
    }
    setSearching(true)
    try {
      const path = q ? `/api/mobile/patients?q=${encodeURIComponent(q)}` : '/api/mobile/patients'
      const data = await apiRequest<{ patients: Patient[] }>(path, { token })
      setPatients(data.patients)
    } catch {
      setPatients([])
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [token])

  useEffect(() => { search('') }, [token])

  const handleQuery = (text: string) => {
    setQuery(text)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(text.trim()), 400)
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={handleQuery}
          placeholder="Search by name or MRN..."
          placeholderTextColor="#52525B"
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {searching ? <ActivityIndicator color="#F97316" style={styles.spinner} /> : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#F97316" size="large" />
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {query ? 'No patients match your search' : 'No patients registered yet'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => router.push(`/patient/${item.id}` as never)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.fullName[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.fullName}</Text>
                <View style={styles.meta}>
                  {item.mrn ? <Text style={styles.metaText}>MRN {item.mrn}</Text> : null}
                  {item.sex ? <Text style={styles.dot}>·</Text> : null}
                  {item.sex ? <Text style={styles.metaText}>{item.sex}</Text> : null}
                  {item.dateOfBirth ? <Text style={styles.dot}>·</Text> : null}
                  {item.dateOfBirth ? (
                    <Text style={styles.metaText}>DOB {item.dateOfBirth}</Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070A' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, marginBottom: 8,
    backgroundColor: '#111117', borderRadius: 12,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 12 },
  spinner: { marginLeft: 8 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 40 },
  emptyText: { color: '#52525B', fontSize: 14, textAlign: 'center' },

  separator: { height: 1, backgroundColor: '#18181B', marginHorizontal: 16 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardLeft: { marginRight: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1C1C24',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#F97316', fontSize: 16, fontWeight: '700' },
  cardBody: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 3, gap: 2 },
  metaText: { color: '#71717A', fontSize: 12 },
  dot: { color: '#3F3F46', fontSize: 12 },
  chevron: { color: '#3F3F46', fontSize: 20, marginLeft: 8 },
})

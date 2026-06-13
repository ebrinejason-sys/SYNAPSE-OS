import { useEffect, useState } from 'react'
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { apiRequest } from '@/lib/api'

interface PatientDetail {
  id: string
  fullName: string
  mrn: string | null
  dateOfBirth: string | null
  sex: string | null
  phone: string | null
  address: string | null
  bloodGroup: string | null
  allergies: string[] | null
  createdAt: string
}

interface Encounter {
  id: string
  status: string
  chiefComplaint: string | null
  clinicalStage: string | null
  visitDate: string | null
  createdAt: string
}

interface Vitals {
  bpSystolic: number | null
  bpDiastolic: number | null
  heartRate: number | null
  temperatureC: number | null
  spo2: number | null
  recordedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  open: '#F97316',
  in_progress: '#E8B84B',
  completed: '#22C55E',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { token } = useAuth()
  const router = useRouter()
  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [vitals, setVitals] = useState<Vitals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    apiRequest<{ patient: PatientDetail; encounters: Encounter[]; latestVitals: Vitals | null }>(
      `/api/mobile/patients/${id}`,
      { token }
    )
      .then(data => {
        setPatient(data.patient)
        setEncounters(data.encounters)
        setVitals(data.latestVitals)
      })
      .catch(() => setError('Failed to load patient'))
      .finally(() => setLoading(false))
  }, [id, token])

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#F97316" size="large" />
      </View>
    )
  }

  if (error || !patient) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorText}>{error ?? 'Patient not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const age = patient.dateOfBirth ? calcAge(patient.dateOfBirth) : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Patients</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{patient.fullName[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{patient.fullName}</Text>
          <Text style={styles.headerSub}>
            {[patient.mrn ? `MRN ${patient.mrn}` : null, patient.sex, age ? `Age ${age}` : null]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* Demographics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Demographics</Text>
        <View style={styles.card}>
          <InfoRow label="Date of Birth" value={patient.dateOfBirth ?? '—'} />
          <Divider />
          <InfoRow label="Sex" value={patient.sex ?? '—'} />
          <Divider />
          <InfoRow label="Blood Group" value={patient.bloodGroup ?? '—'} />
          <Divider />
          <InfoRow label="Phone" value={patient.phone ?? '—'} />
          {patient.allergies?.length ? (
            <>
              <Divider />
              <InfoRow label="Allergies" value={patient.allergies.join(', ')} />
            </>
          ) : null}
        </View>
      </View>

      {/* Vitals */}
      {vitals ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest Vitals</Text>
          <View style={styles.vitalsGrid}>
            <VitalCard label="BP" value={vitals.bpSystolic && vitals.bpDiastolic ? `${vitals.bpSystolic}/${vitals.bpDiastolic}` : '—'} unit="mmHg" />
            <VitalCard label="HR" value={vitals.heartRate ? String(vitals.heartRate) : '—'} unit="bpm" />
            <VitalCard label="Temp" value={vitals.temperatureC ? `${vitals.temperatureC}` : '—'} unit="°C" />
            <VitalCard label="SpO2" value={vitals.spo2 ? `${vitals.spo2}` : '—'} unit="%" />
          </View>
          <Text style={styles.vitalsTime}>Recorded {formatDate(vitals.recordedAt)}</Text>
        </View>
      ) : null}

      {/* Encounters */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Encounters</Text>
        {encounters.length === 0 ? (
          <Text style={styles.noData}>No encounters on record</Text>
        ) : (
          encounters.map(enc => (
            <View key={enc.id} style={styles.encounterCard}>
              <View style={styles.encounterHeader}>
                <Text style={styles.encounterDate}>{formatDate(enc.createdAt)}</Text>
                <View style={[styles.statusPill, { borderColor: STATUS_COLORS[enc.status] ?? '#52525B' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[enc.status] ?? '#52525B' }]}>
                    {STATUS_LABELS[enc.status] ?? enc.status}
                  </Text>
                </View>
              </View>
              {enc.chiefComplaint ? (
                <Text style={styles.encounterComplaint}>{enc.chiefComplaint}</Text>
              ) : null}
              {enc.clinicalStage ? (
                <Text style={styles.encounterDx}>Dx: {enc.clinicalStage}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#1C1C24' }} />
}

function VitalCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.vitalCard}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={styles.vitalValue}>{value}</Text>
      <Text style={styles.vitalUnit}>{unit}</Text>
    </View>
  )
}

function calcAge(dob: string) {
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070A' },
  content: { padding: 20, paddingBottom: 40 },
  centerScreen: { flex: 1, backgroundColor: '#07070A', justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#F87171', fontSize: 14, marginBottom: 16 },

  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backArrow: { color: '#F97316', fontSize: 26, marginRight: 4, lineHeight: 28 },
  backLabel: { color: '#F97316', fontSize: 15, fontWeight: '600' },
  backBtn: {
    backgroundColor: '#111117', borderRadius: 10,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  headerAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1C1C24',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: { color: '#F97316', fontSize: 22, fontWeight: '800' },
  headerName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#71717A', fontSize: 13, marginTop: 3 },

  section: { marginBottom: 28 },
  sectionTitle: { color: '#A1A1AA', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  card: { backgroundColor: '#111117', borderRadius: 14, borderWidth: 1, borderColor: '#27272A', overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  infoLabel: { color: '#71717A', fontSize: 13 },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 16 },

  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vitalCard: {
    flex: 1, minWidth: '44%', backgroundColor: '#111117',
    borderRadius: 12, borderWidth: 1, borderColor: '#27272A',
    padding: 14, alignItems: 'center',
  },
  vitalLabel: { color: '#71717A', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  vitalValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  vitalUnit: { color: '#52525B', fontSize: 10, marginTop: 2 },
  vitalsTime: { color: '#3F3F46', fontSize: 11, marginTop: 8, textAlign: 'right' },

  encounterCard: {
    backgroundColor: '#111117', borderRadius: 12,
    borderWidth: 1, borderColor: '#27272A',
    padding: 14, marginBottom: 10,
  },
  encounterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  encounterDate: { color: '#71717A', fontSize: 12 },
  statusPill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '600' },
  encounterComplaint: { color: '#fff', fontSize: 13, marginBottom: 4 },
  encounterDx: { color: '#22C55E', fontSize: 12 },

  noData: { color: '#52525B', fontSize: 13 },
})

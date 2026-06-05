export interface HealthIntegration {
  id: string
  name: string
  icon: string
  metrics: string[]
  authType: 'oauth2' | 'none'
  available: boolean
  alwaysActive?: boolean
  comingSoon?: string
}

export const HEALTH_INTEGRATIONS: HealthIntegration[] = [
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: '🏃',
    metrics: ['heart_rate', 'steps', 'spo2', 'sleep_hours'],
    authType: 'oauth2',
    available: true,
  },
  {
    id: 'withings',
    name: 'Withings',
    icon: '⚖️',
    metrics: ['systolic_bp', 'diastolic_bp', 'weight_kg', 'heart_rate'],
    authType: 'oauth2',
    available: true,
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    icon: '🏃',
    metrics: ['heart_rate', 'weight_kg', 'steps'],
    authType: 'oauth2',
    available: true,
  },
  {
    id: 'omron',
    name: 'Omron',
    icon: '💓',
    metrics: ['systolic_bp', 'diastolic_bp', 'heart_rate'],
    authType: 'oauth2',
    available: true,
  },
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: '🍎',
    metrics: ['heart_rate', 'spo2'],
    authType: 'none',
    available: false,
    comingSoon: 'Available in Synapse iOS app',
  },
  {
    id: 'samsung',
    name: 'Samsung Health',
    icon: '📱',
    metrics: ['heart_rate', 'systolic_bp'],
    authType: 'none',
    available: false,
    comingSoon: 'Available in Synapse Android app',
  },
  {
    id: 'manual',
    name: 'Manual Entry',
    icon: '✏️',
    metrics: ['heart_rate', 'systolic_bp', 'diastolic_bp', 'temperature', 'spo2', 'weight_kg', 'blood_glucose'],
    authType: 'none',
    available: true,
    alwaysActive: true,
  },
]

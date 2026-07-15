import { StyleSheet, Text, View } from 'react-native'
import { SynapseLogo } from '@/components/SynapseLogo'
import { colors, typography } from '@/lib/theme'

interface BrandWordmarkProps {
  subtitle?: string
  logoSize?: 'md' | 'lg' | 'xl'
}

export function BrandWordmark({ subtitle, logoSize = 'lg' }: BrandWordmarkProps) {
  return (
    <View style={styles.wrap}>
      <SynapseLogo size={logoSize} />
      <Text style={styles.title}>
        Synapse <Text style={styles.accent}>Health</Text>
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16 },
  title: {
    ...typography.title,
    color: colors.text,
    marginTop: 4,
  },
  accent: { color: colors.gold },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
})

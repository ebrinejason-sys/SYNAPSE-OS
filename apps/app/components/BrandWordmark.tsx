import { StyleSheet, Text, View } from 'react-native'
import { SynapseLogo } from '@/components/SynapseLogo'
import { typography, useTheme } from '@/lib/theme'

interface BrandWordmarkProps {
  subtitle?: string
  logoSize?: 'md' | 'lg' | 'xl'
}

export function BrandWordmark({ subtitle, logoSize = 'lg' }: BrandWordmarkProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.wrap}>
      <SynapseLogo size={logoSize} />
      <Text style={[styles.title, { color: colors.text }]}>
        Synapse <Text style={{ color: colors.gold }}>Health</Text>
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16 },
  title: {
    ...typography.title,
    marginTop: 4,
  },
  subtitle: {
    ...typography.caption,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
})

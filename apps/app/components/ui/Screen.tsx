import { LinearGradient } from 'expo-linear-gradient'
import { ReactNode } from 'react'
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native'
import { useTheme } from '@/lib/theme'

interface ScreenProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  glow?: boolean
}

export function Screen({ children, style, glow = false }: ScreenProps) {
  const { colors } = useTheme()
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }, style]}>
      {glow ? (
        <LinearGradient
          colors={[colors.glowTeal, colors.glowOrange, 'transparent']}
          style={styles.glow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.45 }}
        />
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
})

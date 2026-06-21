import { LinearGradient } from 'expo-linear-gradient'
import { ReactNode } from 'react'
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native'
import { colors } from '@/lib/theme'

interface ScreenProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  glow?: boolean
}

export function Screen({ children, style, glow = false }: ScreenProps) {
  return (
    <View style={[styles.root, style]}>
      {glow ? (
        <LinearGradient
          colors={['rgba(20, 184, 166, 0.14)', 'rgba(249, 115, 22, 0.06)', 'transparent']}
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
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
})

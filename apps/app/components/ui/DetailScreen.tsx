import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, typography } from '@/lib/theme'

interface DetailScreenProps {
  title: string
  subtitle?: string
  children: ReactNode
  onBack?: () => void
}

export function DetailScreen({ title, subtitle, children, onBack }: DetailScreenProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  function handleBack() {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Spacer to keep title visually centered */}
        <View style={styles.backBtn} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    opacity: 0.6,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
})

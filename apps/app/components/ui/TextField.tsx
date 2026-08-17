import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native'
import { radii, spacing, typography, useTheme } from '@/lib/theme'

interface TextFieldProps extends TextInputProps {
  label: string
  hint?: string
}

export function TextField({ label, hint, style, ...props }: TextFieldProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...props}
      />
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    ...typography.body,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
})

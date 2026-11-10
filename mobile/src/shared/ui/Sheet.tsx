import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";

import { colors, useThemedStyles, type Theme } from "@/shared/theme";

import { AppText } from "./AppText";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Bottom sheet over a dimmed backdrop. Pressing the backdrop or the system back closes it. */
export function Sheet({ visible, title, onClose, children }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={styles.sheet}>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: Theme) => ({
  container: { flex: 1, justifyContent: "flex-end" as const },
  // The darkest token dims the screen behind the sheet in both schemes.
  backdrop: { ...absoluteFill, backgroundColor: colors.light.text, opacity: 0.4 },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
});

const absoluteFill = {
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

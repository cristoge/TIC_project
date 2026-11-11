import { useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView } from "react-native";

import { useSession } from "@/features/auth";
import {
  useTheme,
  useThemedStyles,
  useThemePreference,
  type Theme,
  type ThemePreference,
} from "@/shared/theme";
import { AppText, Button, Card, ErrorState, SegmentedControl, TextField } from "@/shared/ui";

import { NAME_MAX_LENGTH, useMe, useUpdateName } from "./api";

const SCHEMES = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

export function SettingsScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const me = useMe();
  const updateName = useUpdateName();
  const preference = useThemePreference((state) => state.preference);
  // What the user typed; until then the field shows the saved name.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  // Guards a second press that arrives before the loading state re-renders the button.
  const saving = useRef(false);

  const name = draft ?? me.data?.name ?? "";

  async function save() {
    if (saving.current) return;
    const trimmed = name.trim();
    setSaved(false);
    if (!trimmed) return setError("Escribe un nombre.");
    setError(undefined);
    saving.current = true;
    try {
      await updateName.mutateAsync(trimmed);
      setDraft(null);
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      saving.current = false;
    }
  }

  function confirmSignOut() {
    Alert.alert(
      "¿Cerrar sesión?",
      "Tendrás que volver a entrar con tu email y contraseña.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: () => {
            useSession.getState().signOut();
          },
        },
      ],
      { cancelable: true },
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <AppText variant="label">Perfil</AppText>
        {me.isPending ? (
          <ActivityIndicator color={theme.colors.textMuted} />
        ) : me.isError ? (
          <ErrorState message={me.error.message} onRetry={() => me.refetch()} />
        ) : (
          <>
            <AppText color="textMuted">{me.data.email}</AppText>
            <TextField
              label="Nombre"
              value={name}
              onChangeText={(text) => {
                setDraft(text);
                setSaved(false);
              }}
              maxLength={NAME_MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            {error ? (
              <AppText color="danger" accessibilityRole="alert">
                {error}
              </AppText>
            ) : saved ? (
              <AppText variant="caption" color="textMuted">
                Nombre guardado.
              </AppText>
            ) : null}
            <Button
              label="Guardar nombre"
              variant="secondary"
              onPress={save}
              loading={updateName.isPending}
            />
          </>
        )}
      </Card>
      <Card>
        <AppText variant="label">Tema</AppText>
        <SegmentedControl
          options={SCHEMES}
          value={preference}
          onChange={(value) => useThemePreference.getState().setPreference(value)}
        />
      </Card>
      <Button label="Cerrar sesión" variant="danger" onPress={confirmSignOut} />
    </ScrollView>
  );
}

const createStyles = (theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
});

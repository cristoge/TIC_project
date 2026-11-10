import { View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, TextField } from "@/shared/ui";

type Props = {
  email: string;
  password: string;
  onChangeEmail: (email: string) => void;
  onChangePassword: (password: string) => void;
  onSubmit: () => void;
  emailError?: string;
  passwordError?: string;
  /** Sign-in failure shown under the fields. */
  error?: string;
  loading?: boolean;
};

export function LoginForm({
  email,
  password,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  emailError,
  passwordError,
  error,
  loading,
}: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.form}>
      <TextField
        label="Email"
        value={email}
        onChangeText={onChangeEmail}
        error={emailError}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={onChangePassword}
        error={passwordError}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button label="Entrar" onPress={onSubmit} loading={loading} />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  form: { gap: theme.spacing.lg },
});

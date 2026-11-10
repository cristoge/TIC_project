import { useRef, useState } from "react";

import { AppText, Screen } from "@/shared/ui";

import { AuthError } from "./cognito";
import { LoginForm } from "./components/LoginForm";
import { useSession } from "./session";

type Errors = { email?: string; password?: string; form?: string };

export function LoginScreen() {
  const signIn = useSession((state) => state.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  // Guards a second submit that arrives before the loading state re-renders the button.
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    const trimmedEmail = email.trim();
    const fieldErrors: Errors = {
      email: trimmedEmail ? undefined : "Escribe tu email.",
      password: password ? undefined : "Escribe tu contraseña.",
    };
    setErrors(fieldErrors);
    if (fieldErrors.email || fieldErrors.password) return;

    submitting.current = true;
    setLoading(true);
    try {
      // On success the root layout's route guard leaves this screen.
      await signIn(trimmedEmail, password);
    } catch (error) {
      setErrors({
        form: error instanceof AuthError ? error.message : new AuthError("unknown").message,
      });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">Iniciar sesión</AppText>
      <LoginForm
        email={email}
        password={password}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onSubmit={submit}
        emailError={errors.email}
        passwordError={errors.password}
        error={errors.form}
        loading={loading}
      />
    </Screen>
  );
}

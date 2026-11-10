import { render, screen, userEvent } from "@testing-library/react-native";

import { LoginForm } from "./LoginForm";

const props = {
  email: "",
  password: "",
  onChangeEmail: () => {},
  onChangePassword: () => {},
  onSubmit: () => {},
};

describe("LoginForm", () => {
  it("configures the fields for email and password autofill", async () => {
    await render(<LoginForm {...props} />);

    expect(screen.getByLabelText("Email").props).toMatchObject({
      autoCapitalize: "none",
      keyboardType: "email-address",
      autoComplete: "email",
      textContentType: "username",
    });
    expect(screen.getByLabelText("Contraseña").props).toMatchObject({
      secureTextEntry: true,
      textContentType: "password",
      autoComplete: "password",
    });
  });

  it("reports typed values and submits", async () => {
    const onChangeEmail = jest.fn();
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(<LoginForm {...props} onChangeEmail={onChangeEmail} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Email"), "a");
    await user.press(screen.getByRole("button", { name: "Entrar" }));

    expect(onChangeEmail).toHaveBeenLastCalledWith("a");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows field and form errors", async () => {
    await render(
      <LoginForm
        {...props}
        emailError="Escribe tu email."
        passwordError="Escribe tu contraseña."
        error="Email o contraseña incorrectos."
      />,
    );

    expect(screen.getAllByRole("alert").map((alert) => alert.props.children)).toEqual([
      "Escribe tu email.",
      "Escribe tu contraseña.",
      "Email o contraseña incorrectos.",
    ]);
  });

  it("is busy while loading", async () => {
    await render(<LoginForm {...props} loading />);

    expect(screen.getByRole("button", { name: "Entrar" })).toBeBusy();
  });
});

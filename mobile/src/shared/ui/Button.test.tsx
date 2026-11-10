import { render, screen, userEvent } from "@testing-library/react-native";

import { Button } from "./Button";

describe("Button", () => {
  it("calls onPress when pressed", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Entrar" onPress={onPress} />);

    await user.press(screen.getByRole("button", { name: "Entrar" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Entrar" onPress={onPress} disabled />);

    const button = screen.getByRole("button", { name: "Entrar" });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("is busy and ignores presses while loading", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Entrar" onPress={onPress} loading />);

    const button = screen.getByRole("button", { name: "Entrar" });
    await user.press(button);

    expect(button).toBeBusy();
    expect(onPress).not.toHaveBeenCalled();
  });
});

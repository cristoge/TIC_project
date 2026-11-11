import { render, screen, userEvent } from "@testing-library/react-native";

import { FloatingButton } from "./FloatingButton";

describe("FloatingButton", () => {
  it("is a button named by its label", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<FloatingButton icon="newChat" label="Nuevo chat" onPress={onPress} />);

    await user.press(screen.getByRole("button", { name: "Nuevo chat" }));

    expect(screen.getByText("Nuevo chat")).toBeOnTheScreen();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not respond while disabled", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<FloatingButton icon="add" label="Crear test" onPress={onPress} disabled />);

    const button = screen.getByRole("button", { name: "Crear test" });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("is busy and ignores presses while loading", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<FloatingButton icon="upload" label="Subir PDF" onPress={onPress} loading />);

    const button = screen.getByRole("button", { name: "Subir PDF" });
    await user.press(button);

    expect(button).toBeBusy();
    expect(onPress).not.toHaveBeenCalled();
  });
});

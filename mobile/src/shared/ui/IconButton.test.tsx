import { render, screen, userEvent } from "@testing-library/react-native";

import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

describe("Icon", () => {
  it("is hidden from screen readers, which read the control's label instead", async () => {
    await render(<Icon name="settings" />);

    // Queries skip what screen readers cannot reach unless asked to include it.
    expect(screen.queryByTestId("icon-settings")).toBeNull();
    expect(screen.getByTestId("icon-settings", { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe("IconButton", () => {
  it("is a button named by its label", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<IconButton icon="options" label="Opciones de Tema 1" onPress={onPress} />);

    await user.press(screen.getByRole("button", { name: "Opciones de Tema 1" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not respond while disabled", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<IconButton icon="send" label="Enviar" onPress={onPress} disabled />);

    const button = screen.getByRole("button", { name: "Enviar" });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

import { render, screen, userEvent } from "@testing-library/react-native";

import { AppText } from "./AppText";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("shows its title and content while visible", async () => {
    await render(
      <Sheet visible title="Nuevo proyecto" onClose={() => {}}>
        <AppText>Contenido</AppText>
      </Sheet>,
    );

    expect(screen.getByText("Nuevo proyecto")).toBeOnTheScreen();
    expect(screen.getByText("Contenido")).toBeOnTheScreen();
  });

  it("renders nothing while hidden", async () => {
    await render(
      <Sheet visible={false} title="Nuevo proyecto" onClose={() => {}}>
        <AppText>Contenido</AppText>
      </Sheet>,
    );

    expect(screen.queryByText("Contenido")).not.toBeOnTheScreen();
  });

  it("closes when the backdrop is pressed", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    await render(
      <Sheet visible title="Nuevo proyecto" onClose={onClose}>
        <AppText>Contenido</AppText>
      </Sheet>,
    );

    await user.press(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

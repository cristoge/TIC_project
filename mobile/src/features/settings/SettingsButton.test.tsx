import { render, screen, userEvent } from "@testing-library/react-native";

import { SettingsButton } from "./SettingsButton";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

it("opens the settings", async () => {
  const user = userEvent.setup();
  await render(<SettingsButton />);

  await user.press(screen.getByRole("button", { name: "Ajustes" }));

  expect(mockPush).toHaveBeenCalledWith("/settings");
});

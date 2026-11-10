import { render, screen, userEvent } from "@testing-library/react-native";

import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("announces the message and retries on demand", async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();
    await render(<ErrorState message="Servidor caído" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Servidor caído");
    await user.press(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

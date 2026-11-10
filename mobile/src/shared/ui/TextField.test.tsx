import { render, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";

import { TextField } from "./TextField";

function ControlledField({ onChangeText }: { onChangeText: (text: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <TextField
      label="Email"
      value={value}
      onChangeText={(text) => {
        setValue(text);
        onChangeText(text);
      }}
    />
  );
}

describe("TextField", () => {
  it("is reachable by its label and reports typed text", async () => {
    const onChangeText = jest.fn();
    const user = userEvent.setup();
    await render(<ControlledField onChangeText={onChangeText} />);

    await user.type(screen.getByLabelText("Email"), "a@b.c");

    expect(onChangeText).toHaveBeenLastCalledWith("a@b.c");
  });

  it("announces the error message", async () => {
    await render(
      <TextField label="Email" value="" onChangeText={() => {}} error="Email no válido" />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Email no válido");
  });
});

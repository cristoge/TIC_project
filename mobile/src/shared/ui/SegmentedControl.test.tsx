import { render, screen, userEvent } from "@testing-library/react-native";

import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "chats", label: "Chats" },
  { value: "documents", label: "Documentos" },
] as const;

describe("SegmentedControl", () => {
  it("renders one tab per option and marks the selected one", async () => {
    await render(<SegmentedControl options={options} value="documents" onChange={jest.fn()} />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Documentos" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Chats" })).not.toBeSelected();
  });

  it("reports the pressed option", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(<SegmentedControl options={options} value="documents" onChange={onChange} />);

    await user.press(screen.getByRole("tab", { name: "Chats" }));

    expect(onChange).toHaveBeenCalledWith("chats");
  });
});

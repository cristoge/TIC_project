import { render, screen, userEvent } from "@testing-library/react-native";

import { colors } from "@/shared/theme";

import { MarkdownText } from "./MarkdownText";

const tema1 = { n: 1, document_id: "d1", document_name: "Tema 1.pdf", page: 3 };

describe("MarkdownText", () => {
  it("renders bold text and lists with the theme's text colour", async () => {
    await render(<MarkdownText value={"Un **grafo** tiene:\n\n- nodos\n- aristas"} />);

    expect(screen.getByText("grafo")).toHaveStyle({ color: colors.light.text });
    expect(screen.getByText("nodos")).toBeOnTheScreen();
    expect(screen.getByText("aristas")).toBeOnTheScreen();
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it("turns a citation into a button that reports its source", async () => {
    const onCitation = jest.fn();
    const user = userEvent.setup();
    await render(
      <MarkdownText
        value={"Un grafo es un conjunto de nodos [1].\n\n- **Aristas** [1]"}
        sources={[tema1]}
        onCitation={onCitation}
      />,
    );

    const citations = screen.getAllByRole("button", { name: "Cita 1: Tema 1.pdf, página 3" });
    expect(citations).toHaveLength(2);
    await user.press(citations[0]);

    expect(onCitation).toHaveBeenCalledWith(tema1);
  });

  it("leaves a number without a source as plain text", async () => {
    await render(<MarkdownText value="Ver la tabla [7]." sources={[tema1]} />);

    expect(screen.getByText("Ver la tabla [7].")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

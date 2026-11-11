import { useMemo, type ReactNode } from "react";
import { Text, View, type TextStyle } from "react-native";
import { Renderer, useMarkdown, type MarkedStyles } from "react-native-marked";

import { fonts, useTheme, type Theme } from "@/shared/theme";

import type { Source } from "../stream";

type Props = {
  value: string;
  /** The passages the answer cites; a `[n]` without one stays as plain text. */
  sources?: Source[];
  onCitation?: (source: Source) => void;
};

const CITATION = /\[(\d+)\]/;

/** The agent's Markdown (bold and short lists) with its citations `[n]` as buttons. */
export function MarkdownText({ value, sources, onCitation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => markdownStyles(theme), [theme]);
  const renderer = useMemo(
    () => new CitationRenderer(sources ?? [], onCitation, { color: theme.colors.textMuted }),
    [sources, onCitation, theme],
  );

  return <View>{useMarkdown(value, { renderer, styles })}</View>;
}

class CitationRenderer extends Renderer {
  constructor(
    private readonly sources: Source[],
    private readonly onCitation: Props["onCitation"],
    private readonly citationStyle: TextStyle,
  ) {
    // Selectable text swallows the press on a nested citation.
    super({ selectable: false });
  }

  text(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (typeof text !== "string") return super.text(text, styles);
    // Splitting on a capture group leaves the cited numbers at the odd positions.
    const parts = text.split(CITATION);
    if (parts.length === 1) return super.text(text, styles);
    return super.text(
      parts.map((part, index) => (index % 2 === 0 ? part : this.citation(part))),
      styles,
    );
  }

  private citation(number: string): ReactNode {
    const source = this.sources.find((candidate) => candidate.n === Number(number));
    if (!source) return `[${number}]`;
    return (
      <Text
        key={this.getKey()}
        accessibilityRole="button"
        accessibilityLabel={`Cita ${source.n}: ${source.document_name}, página ${source.page}`}
        onPress={() => this.onCitation?.(source)}
        style={[this.citationStyle, { fontFamily: fonts.semibold }]}
      >
        [{number}]
      </Text>
    );
  }
}

function markdownStyles(theme: Theme): MarkedStyles {
  const text = { ...theme.typography.body, color: theme.colors.text };
  return {
    text,
    li: text,
    // The weight comes from the font file; a bold weight on top makes Android fall back to a system font.
    strong: { ...text, fontFamily: fonts.semibold, fontWeight: "normal" },
    em: { ...text, fontStyle: "italic" },
    paragraph: { paddingVertical: theme.spacing.xs },
  };
}

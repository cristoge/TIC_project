import { useState } from "react";
import { Pressable, View } from "react-native";

import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Button, Screen } from "@/shared/ui";

import { useDeck } from "./api";
import { GenerationState } from "./components/GenerationState";

type Props = { deckId: string };

/** Study a deck: a card shows its question, a press flips it to the answer. */
export function DeckScreen({ deckId }: Props) {
  const styles = useThemedStyles(createStyles);
  const deck = useDeck(deckId);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cards = deck.data?.status === "ready" ? deck.data.cards : [];
  const card = cards[index];

  function go(next: number) {
    setIndex(next);
    setFlipped(false);
  }

  return (
    <Screen>
      <GenerationState
        query={deck}
        pendingText="Generando las flashcards…"
        failedText="No se pudieron generar las flashcards"
      />
      {card ? (
        <>
          <AppText variant="caption" color="textMuted" style={styles.counter}>
            {index + 1} / {cards.length}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityHint={flipped ? "Toca para ver la pregunta" : "Toca para ver la respuesta"}
            onPress={() => setFlipped(!flipped)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <AppText variant="heading" style={styles.text}>
              {flipped ? card.answer : card.question}
            </AppText>
            {flipped ? (
              <AppText variant="caption" color="textMuted">
                Página {card.page}
              </AppText>
            ) : null}
          </Pressable>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label="Anterior"
                variant="secondary"
                disabled={index === 0}
                onPress={() => go(index - 1)}
              />
            </View>
            <View style={styles.action}>
              <Button
                label="Siguiente"
                disabled={index === cards.length - 1}
                onPress={() => go(index + 1)}
              />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const createStyles = (theme: Theme) => ({
  counter: { textAlign: "center" as const },
  card: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  text: { textAlign: "center" as const },
  pressed: { opacity: 0.85 },
  actions: { flexDirection: "row" as const, gap: theme.spacing.sm },
  action: { flex: 1 },
});

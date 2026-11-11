import { Stack, useLocalSearchParams } from "expo-router";

import { DeckScreen, useDeck } from "@/features/study";

export default function Deck() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { data: deck } = useDeck(deckId);

  return (
    <>
      <Stack.Screen options={{ title: deck?.topic || "Flashcards" }} />
      <DeckScreen deckId={deckId} />
    </>
  );
}

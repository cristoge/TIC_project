import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { View } from "react-native";

import { useTheme, type ColorName } from "@/shared/theme";

// The app's icons by meaning: SF Symbols on iOS, Material Symbols on Android.
const symbols = {
  menu: { ios: "line.3.horizontal", android: "menu" },
  newChat: { ios: "square.and.pencil", android: "edit_square" },
  settings: { ios: "gearshape", android: "settings" },
  options: { ios: "ellipsis", android: "more_horiz" },
  send: { ios: "arrow.up", android: "arrow_upward" },
  delete: { ios: "trash", android: "delete" },
  chats: { ios: "bubble.left.and.bubble.right", android: "forum" },
  documents: { ios: "doc.text", android: "description" },
  study: { ios: "graduationcap", android: "school" },
  upload: { ios: "arrow.up.doc", android: "upload_file" },
  chevron: { ios: "chevron.right", android: "chevron_right" },
  switch: { ios: "chevron.up.chevron.down", android: "unfold_more" },
  close: { ios: "xmark", android: "close" },
  project: { ios: "folder", android: "folder" },
  add: { ios: "plus", android: "add" },
} as const satisfies Record<string, Extract<SymbolViewProps["name"], object>>;

export type IconName = keyof typeof symbols;

type Props = {
  name: IconName;
  size?: number;
  color?: Extract<ColorName, "text" | "textMuted" | "onAccent" | "accent" | "danger">;
};

/** A decorative icon; the control around it carries the accessible label. */
export function Icon({ name, size = 20, color = "text" }: Props) {
  const theme = useTheme();

  return (
    <View
      testID={`icon-${name}`}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <SymbolView name={symbols[name]} size={size} tintColor={theme.colors[color]} />
    </View>
  );
}

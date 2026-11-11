// The side menu of a project, in the manner of the Claude app: a new chat, the project (tap to switch),
// its sections, its recent chats and, at the bottom, who is signed in.

import type { Href } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { conversationTitle, useConversations } from "@/features/chat";
import { useProjectName } from "@/features/projects";
import { useMe } from "@/features/settings";
import { useThemedStyles, type Theme } from "@/shared/theme";
import { AppText, Icon, type IconName } from "@/shared/ui";

const RECENT_CHATS = 8;

export type MenuSection = "chats" | "documents" | "study";

type Props = {
  projectId: string;
  /** The section or chat on screen, highlighted in the menu. */
  active: MenuSection | { conversationId: string } | null;
  onNavigate: (href: Href) => void;
};

const SECTIONS: { section: MenuSection; label: string; icon: IconName }[] = [
  { section: "chats", label: "Chats", icon: "chats" },
  { section: "documents", label: "Documentos", icon: "documents" },
  { section: "study", label: "Estudio", icon: "study" },
];

export function ProjectMenu({ projectId, active, onNavigate }: Props) {
  const styles = useThemedStyles(createStyles);
  const projectName = useProjectName(projectId);
  const conversations = useConversations(projectId);
  const me = useMe();
  const base = `/projects/${projectId}` as const;
  const activeChat = typeof active === "object" && active ? active.conversationId : null;
  const recent = (conversations.data ?? []).slice(0, RECENT_CHATS);
  const userName = me.data?.name?.trim() || me.data?.email || "";

  return (
    <View style={styles.menu}>
      <ScrollView contentContainerStyle={styles.content}>
        <MenuItem
          icon="newChat"
          label="Nuevo chat"
          onPress={() => onNavigate(`${base}/chats/new`)}
          accent
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cambiar de proyecto: ${projectName}`}
          onPress={() => onNavigate("/projects")}
          style={({ pressed }) => [styles.project, pressed && styles.pressed]}
        >
          <Icon name="project" color="textMuted" />
          <AppText variant="label" numberOfLines={1} style={styles.grow}>
            {projectName}
          </AppText>
          <Icon name="switch" size={16} color="textMuted" />
        </Pressable>
        <View style={styles.group}>
          {SECTIONS.map(({ section, label, icon }) => (
            <MenuItem
              key={section}
              icon={icon}
              label={label}
              selected={active === section}
              onPress={() => onNavigate(`${base}/${section}`)}
            />
          ))}
        </View>
        {recent.length > 0 ? (
          <View style={styles.group}>
            <AppText variant="caption" color="textMuted" style={styles.heading}>
              Recientes
            </AppText>
            {recent.map((conversation) => (
              <MenuItem
                key={conversation.id}
                label={conversationTitle(conversation)}
                selected={conversation.id === activeChat}
                onPress={() => onNavigate(`${base}/chats/${conversation.id}`)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ajustes: ${userName}`}
        onPress={() => onNavigate("/settings")}
        style={({ pressed }) => [styles.account, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <AppText variant="label" color="onAccent">
            {userName.charAt(0).toUpperCase()}
          </AppText>
        </View>
        <View style={styles.grow}>
          <AppText variant="label" numberOfLines={1}>
            {userName}
          </AppText>
          {me.data?.name?.trim() ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {me.data.email}
            </AppText>
          ) : null}
        </View>
        <Icon name="settings" color="textMuted" />
      </Pressable>
    </View>
  );
}

type MenuItemProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  selected?: boolean;
  /** The menu's one call to action, "Nuevo chat". */
  accent?: boolean;
};

function MenuItem({ label, onPress, icon, selected = false, accent = false }: MenuItemProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, selected && styles.selected, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} color={accent || selected ? "accent" : "textMuted"} /> : null}
      <AppText
        variant={icon ? "label" : "body"}
        color={accent ? "accent" : "text"}
        numberOfLines={1}
        style={styles.grow}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  menu: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, gap: theme.spacing.lg },
  group: { gap: 2 },
  heading: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs },
  item: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  selected: { backgroundColor: theme.colors.accentSoft },
  project: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  account: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.pill,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: theme.colors.accent,
  },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
});

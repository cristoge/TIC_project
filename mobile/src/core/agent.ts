// The app-wide chat stream: turns carry the session's ID token and a rejected token refreshes it once.

import { useSession } from "@/features/auth";
import { createChatStream, type ChatStream } from "@/features/chat/stream";
import { getEnv } from "@/shared/config/env";

let chatStream: ChatStream | undefined;

/** Built on first use so importing this module does not read the environment. */
export function getChatStream(): ChatStream {
  chatStream ??= createChatStream({
    url: getEnv().agentUrl,
    getIdToken: async () => useSession.getState().idToken,
    onUnauthorized: () => useSession.getState().refresh(),
    // Read at call time so tests can replace the global.
    fetch: (url, init) => globalThis.fetch(url, init),
  });
  return chatStream;
}

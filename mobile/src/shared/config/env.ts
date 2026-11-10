// Settings come from EXPO_PUBLIC_* variables (see mobile/.env.example), so moving from the local
// backend to AWS is configuration only. Contract: docs/app/README.md § Configuración.

export type Env = {
  apiUrl: string;
  agentUrl: string;
  cognitoRegion: string;
  cognitoClientId: string;
};

type Source = Record<string, string | undefined>;

const names = {
  apiUrl: "EXPO_PUBLIC_API_URL",
  agentUrl: "EXPO_PUBLIC_AGENT_URL",
  cognitoRegion: "EXPO_PUBLIC_COGNITO_REGION",
  cognitoClientId: "EXPO_PUBLIC_COGNITO_CLIENT_ID",
} as const satisfies Record<keyof Env, string>;

export function readEnv(source: Source): Env {
  const missing = Object.values(names).filter((name) => !source[name]?.trim());
  if (missing.length > 0) throw new Error(`Missing ${missing.join(", ")}`);

  const value = (key: keyof Env) => source[names[key]]!.trim();
  return {
    apiUrl: value("apiUrl").replace(/\/+$/, ""),
    agentUrl: value("agentUrl"),
    cognitoRegion: value("cognitoRegion"),
    cognitoClientId: value("cognitoClientId"),
  };
}

let cached: Env | undefined;

export function getEnv(): Env {
  // Expo only inlines EXPO_PUBLIC_* variables read with a literal `process.env.NAME`.
  cached ??= readEnv({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_AGENT_URL: process.env.EXPO_PUBLIC_AGENT_URL,
    EXPO_PUBLIC_COGNITO_REGION: process.env.EXPO_PUBLIC_COGNITO_REGION,
    EXPO_PUBLIC_COGNITO_CLIENT_ID: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
  });
  return cached;
}

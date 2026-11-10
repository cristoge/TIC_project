// Cognito user pool sign-in by direct fetch to InitiateAuth (no Amplify).
// Contract: docs/app/README.md § Login con Cognito.

import { getEnv } from "@/shared/config/env";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type CognitoConfig = { region: string; clientId: string };

export type Tokens = { idToken: string; refreshToken: string };

export type AuthErrorCode = "invalidCredentials" | "challenge" | "network" | "unknown";

const messages: Record<AuthErrorCode, string> = {
  invalidCredentials: "Email o contraseña incorrectos.",
  challenge: "Esta cuenta necesita un paso extra de inicio de sesión que la app no admite.",
  network: "No se pudo conectar. Revisa tu conexión.",
  unknown: "No se pudo iniciar sesión. Inténtalo de nuevo.",
};

/** A sign-in or refresh failure with a message ready to show to the user. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(messages[code]);
    this.name = "AuthError";
  }
}

type InitiateAuthResponse = {
  __type?: string;
  ChallengeName?: string;
  AuthenticationResult?: { IdToken?: string; RefreshToken?: string };
};

type Options = {
  getConfig?: () => CognitoConfig;
  fetch?: Fetch;
};

const defaultConfig = (): CognitoConfig => {
  const env = getEnv();
  return { region: env.cognitoRegion, clientId: env.cognitoClientId };
};

export function createCognitoAuth({
  getConfig = defaultConfig,
  // Looked up per call so the global can be replaced after this module loads.
  fetch = (url, init) => globalThis.fetch(url, init),
}: Options = {}) {
  async function initiateAuth(
    flow: "USER_PASSWORD_AUTH" | "REFRESH_TOKEN_AUTH",
    parameters: Record<string, string>,
  ) {
    const { region, clientId } = getConfig();
    let response: Response;
    try {
      response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
        body: JSON.stringify({ AuthFlow: flow, ClientId: clientId, AuthParameters: parameters }),
      });
    } catch {
      throw new AuthError("network");
    }

    const data = await readJson(response);
    if (!response.ok) {
      const type = data.__type?.split("#").pop();
      const wrongCredentials =
        type === "NotAuthorizedException" || type === "UserNotFoundException";
      throw new AuthError(wrongCredentials ? "invalidCredentials" : "unknown");
    }
    if (!data.AuthenticationResult) {
      throw new AuthError(data.ChallengeName ? "challenge" : "unknown");
    }
    return data.AuthenticationResult;
  }

  return {
    async signIn(email: string, password: string): Promise<Tokens> {
      const result = await initiateAuth("USER_PASSWORD_AUTH", {
        USERNAME: email,
        PASSWORD: password,
      });
      if (!result.IdToken || !result.RefreshToken) throw new AuthError("unknown");
      return { idToken: result.IdToken, refreshToken: result.RefreshToken };
    },

    /** Cognito does not rotate the refresh token here, so only a new ID token comes back. */
    async refreshSession(refreshToken: string): Promise<string> {
      const result = await initiateAuth("REFRESH_TOKEN_AUTH", { REFRESH_TOKEN: refreshToken });
      if (!result.IdToken) throw new AuthError("unknown");
      return result.IdToken;
    },
  };
}

export type CognitoAuth = ReturnType<typeof createCognitoAuth>;

async function readJson(response: Response): Promise<InitiateAuthResponse> {
  try {
    const text = await response.text();
    return text ? (JSON.parse(text) as InitiateAuthResponse) : {};
  } catch {
    return {};
  }
}

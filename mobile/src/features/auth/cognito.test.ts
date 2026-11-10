import { AuthError, createCognitoAuth } from "./cognito";
import { fakeFetch, refreshResult, signInResult, type FakeResponse } from "./testing/fakeFetch";

const config = { region: "eu-south-2", clientId: "client-1" };
const password = "s3cret-Pass!";

function setup(...responses: FakeResponse[]) {
  const fetch = fakeFetch(...responses);
  return { fetch, auth: createCognitoAuth({ getConfig: () => config, fetch }) };
}

function bodyOf(fetch: ReturnType<typeof fakeFetch>, call = 0): unknown {
  return JSON.parse(fetch.mock.calls[call][1].body as string);
}

async function signInError(...responses: FakeResponse[]): Promise<AuthError> {
  const { auth } = setup(...responses);
  const error = await auth.signIn("ana@example.com", password).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AuthError);
  expect((error as AuthError).message).not.toContain(password);
  return error as AuthError;
}

describe("createCognitoAuth", () => {
  it("signs in with USER_PASSWORD_AUTH against the regional endpoint", async () => {
    const { auth, fetch } = setup(signInResult("id-1", "refresh-1"));

    await auth.signIn("ana@example.com", password);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://cognito-idp.eu-south-2.amazonaws.com/");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    });
    expect(bodyOf(fetch)).toEqual({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: "client-1",
      AuthParameters: { USERNAME: "ana@example.com", PASSWORD: password },
    });
  });

  it("returns the ID and refresh tokens of a successful sign-in", async () => {
    const { auth } = setup(signInResult("id-1", "refresh-1"));

    await expect(auth.signIn("ana@example.com", password)).resolves.toEqual({
      idToken: "id-1",
      refreshToken: "refresh-1",
    });
  });

  it("refreshes with REFRESH_TOKEN_AUTH and returns the new ID token", async () => {
    const { auth, fetch } = setup(refreshResult("id-2"));

    await expect(auth.refreshSession("refresh-1")).resolves.toBe("id-2");

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://cognito-idp.eu-south-2.amazonaws.com/");
    expect(init.headers).toMatchObject({
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    });
    expect(bodyOf(fetch)).toEqual({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: "client-1",
      AuthParameters: { REFRESH_TOKEN: "refresh-1" },
    });
  });

  it.each(["NotAuthorizedException", "UserNotFoundException"])(
    "reports wrong credentials for %s",
    async (type) => {
      const error = await signInError({
        status: 400,
        body: { __type: type, message: "Incorrect username or password." },
      });

      expect(error.message).toBe("Email o contraseña incorrectos.");
    },
  );

  it("reports a challenge the app does not support", async () => {
    const error = await signInError({
      status: 200,
      body: { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "s" },
    });

    expect(error.message).toBe(
      "Esta cuenta necesita un paso extra de inicio de sesión que la app no admite.",
    );
  });

  it("reports a network failure", async () => {
    const error = await signInError(new TypeError("Network request failed"));

    expect(error.message).toBe("No se pudo conectar. Revisa tu conexión.");
  });

  it.each<[string, FakeResponse]>([
    ["another Cognito error", { status: 400, body: { __type: "TooManyRequestsException" } }],
    ["a server error", { status: 500 }],
    ["a success without tokens", { status: 200, body: {} }],
  ])("reports a generic failure for %s", async (_name, response) => {
    const error = await signInError(response);

    expect(error.message).toBe("No se pudo iniciar sesión. Inténtalo de nuevo.");
  });
});

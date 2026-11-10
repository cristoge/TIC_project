import { createCognitoAuth, createSessionStore } from "@/features/auth";
import { fakeFetch, refreshResult, signInResult } from "@/features/auth/testing/fakeFetch";

import { createSessionApiClient } from "./api";

jest.mock("expo-secure-store", () =>
  jest.requireActual("@/features/auth/testing/memorySecureStore"),
);

describe("createSessionApiClient", () => {
  it("sends the session's ID token and refreshes it through the session on a 401", async () => {
    const cognitoFetch = fakeFetch(signInResult("id-1", "refresh-1"), refreshResult("id-2"));
    const session = createSessionStore(
      createCognitoAuth({
        getConfig: () => ({ region: "eu-south-2", clientId: "client-1" }),
        fetch: cognitoFetch,
      }),
    );
    await session.getState().signIn("ana@example.com", "pass");
    const apiFetch = fakeFetch({ status: 401 }, { status: 200, body: { id: "me" } });
    const api = createSessionApiClient(session, { baseUrl: "http://api", fetch: apiFetch });

    await expect(api.get("/me")).resolves.toEqual({ id: "me" });

    const authorization = (call: number) =>
      (apiFetch.mock.calls[call][1].headers as Record<string, string>).Authorization;
    expect(authorization(0)).toBe("Bearer id-1");
    expect(authorization(1)).toBe("Bearer id-2");
    expect(cognitoFetch).toHaveBeenCalledTimes(2);
    expect(session.getState().idToken).toBe("id-2");
  });
});

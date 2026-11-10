import { readEnv } from "./env";

const complete = {
  EXPO_PUBLIC_API_URL: "http://192.168.1.20:8000/",
  EXPO_PUBLIC_AGENT_URL: "http://192.168.1.20:8080/invocations",
  EXPO_PUBLIC_COGNITO_REGION: "eu-south-2",
  EXPO_PUBLIC_COGNITO_CLIENT_ID: "client-id",
};

describe("readEnv", () => {
  it("reads every setting and drops the API URL's trailing slash", () => {
    expect(readEnv(complete)).toEqual({
      apiUrl: "http://192.168.1.20:8000",
      agentUrl: "http://192.168.1.20:8080/invocations",
      cognitoRegion: "eu-south-2",
      cognitoClientId: "client-id",
    });
  });

  it("names every missing or blank variable", () => {
    expect(() =>
      readEnv({ ...complete, EXPO_PUBLIC_API_URL: undefined, EXPO_PUBLIC_COGNITO_CLIENT_ID: " " }),
    ).toThrow("Missing EXPO_PUBLIC_API_URL, EXPO_PUBLIC_COGNITO_CLIENT_ID");
  });
});

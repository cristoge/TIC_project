import { ApiError } from "./client";
import { shouldRetry } from "./queryClient";

describe("shouldRetry", () => {
  it("never retries a client error", () => {
    expect(shouldRetry(0, new ApiError(404, "Not found."))).toBe(false);
    expect(shouldRetry(0, new ApiError(409, "Not ready."))).toBe(false);
  });

  it("retries server and network errors twice", () => {
    expect(shouldRetry(0, new ApiError(503, "Unavailable"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Network request failed"))).toBe(true);
    expect(shouldRetry(2, new TypeError("Network request failed"))).toBe(false);
  });
});

import type { components } from "./schema";

export * from "./client";
export * from "./queryClient";

/** Response and request bodies generated from the backend's OpenAPI (`npm run api:types`). */
export type Schemas = components["schemas"];

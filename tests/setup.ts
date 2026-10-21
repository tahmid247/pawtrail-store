import { vi } from "vitest";

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("Refusing to run tests against a non-test database. Use `npm test` (loads .env.test).");
}

// Request-scoped Next.js APIs are replaced by controllable fakes.
const requestState = vi.hoisted(() => ({ cookie: "" as string, jar: new Map<string, string>() }));
(globalThis as Record<string, unknown>).__requestState = requestState;

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: requestState.cookie, "x-forwarded-for": "127.0.0.1" }),
  cookies: async () => ({
    get: (name: string) => (requestState.jar.has(name) ? { name, value: requestState.jar.get(name)! } : undefined),
    set: (name: string, value: string) => void requestState.jar.set(name, value),
    delete: (name: string) => void requestState.jar.delete(name),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` });
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

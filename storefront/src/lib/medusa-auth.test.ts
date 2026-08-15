import { FetchError } from "@medusajs/js-sdk";

import {
  AUTH_TOKEN_KEY,
  clearAuthToken,
  hasAuthToken,
  healIfUnauthorized,
  isUnauthorizedError,
} from "./medusa-auth";

const unauthorized = () => new FetchError("Unauthorized", "Unauthorized", 401);

// jsdom's localStorage is shadowed by Node 22's experimental global
// (unavailable without --localstorage-file), so install a plain in-memory
// Storage stub that matches the real API the auth helpers rely on.
function installStorageStub() {
  const store = new Map<string, string>();
  const stub = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  Object.defineProperty(window, "localStorage", { value: stub, configurable: true });
}

describe("auth token helpers", () => {
  beforeEach(() => {
    installStorageStub();
  });

  it("hasAuthToken reflects the stored JWT", () => {
    expect(hasAuthToken()).toBe(false);
    window.localStorage.setItem(AUTH_TOKEN_KEY, "jwt-token");
    expect(hasAuthToken()).toBe(true);
  });

  it("clearAuthToken drops the stored JWT", () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, "jwt-token");
    clearAuthToken();
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(hasAuthToken()).toBe(false);
  });
});

describe("isUnauthorizedError", () => {
  it("recognizes a 401 FetchError", () => {
    expect(isUnauthorizedError(unauthorized())).toBe(true);
  });

  it("rejects other statuses and non-FetchErrors", () => {
    expect(isUnauthorizedError(new FetchError("Forbidden", "Forbidden", 403))).toBe(false);
    expect(isUnauthorizedError(new Error("boom"))).toBe(false);
    expect(isUnauthorizedError(null)).toBe(false);
  });
});

describe("healIfUnauthorized", () => {
  it("drops the token and reports true on a 401", () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, "stale-jwt");
    expect(healIfUnauthorized(unauthorized())).toBe(true);
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it("keeps the token and reports false on other errors", () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, "valid-jwt");
    expect(healIfUnauthorized(new Error("network down"))).toBe(false);
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe("valid-jwt");
  });
});

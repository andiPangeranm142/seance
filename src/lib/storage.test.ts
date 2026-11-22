/**
 * Unit tests for storage.ts
 */

import { describe, expect, test, beforeEach, vi, afterEach } from "vitest";
import {
  loadGraveyard,
  addToGraveyard,
  removeFromGraveyard,
  loadApiKey,
  saveApiKey,
  clearApiKey,
  type GraveyardEntry,
} from "./storage";

// Mock localStorage for tests
function setupMockStorage() {
  const storage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    }),
  };

  Object.defineProperty(global, "localStorage", {
    value: mockLocalStorage,
    writable: true,
  });

  return { storage, mockLocalStorage };
}

describe("Graveyard operations", () => {
  beforeEach(() => {
    setupMockStorage();
    // Clear any existing data
    localStorage.clear();
  });

  test("loadGraveyard returns empty array when no entries exist", () => {
    expect(loadGraveyard()).toEqual([]);
  });

  test("addToGraveyard adds an entry", () => {
    const entry: GraveyardEntry = {
      url: "https://example.com/dead",
      timestamp: "20261122030900",
      title: "Dead Page",
      resurrectedAt: "2026-11-22T22:00:00.000Z",
    };

    addToGraveyard(entry);

    expect(loadGraveyard()).toEqual([entry]);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "seance_graveyard",
      JSON.stringify([entry]),
    );
  });

  test("addToGraveyard adds multiple entries (newest first)", () => {
    const entry1: GraveyardEntry = {
      url: "https://example.com/1",
      timestamp: "20261122030900",
      title: "Page 1",
      resurrectedAt: "2026-11-22T22:00:00.000Z",
    };
    const entry2: GraveyardEntry = {
      url: "https://example.com/2",
      timestamp: "20261122031000",
      title: "Page 2",
      resurrectedAt: "2026-11-22T22:01:00.000Z",
    };

    addToGraveyard(entry1);
    addToGraveyard(entry2);

    expect(loadGraveyard()).toEqual([entry2, entry1]);
  });

  test("addToGraveyard caps at 50 entries (drops oldest)", () => {
    // Add 51 entries (0-50)
    for (let i = 0; i < 51; i++) {
      addToGraveyard({
        url: `https://example.com/${i}`,
        timestamp: `20261122030${i}00`,
        title: `Page ${i}`,
        resurrectedAt: `2026-11-22T22:0${i}:00.000Z`,
      });
    }

    const entries = loadGraveyard();
    expect(entries.length).toBe(50);
    // entries[0] is newest (50), entries[49] is oldest (1)
    // Entry 0 was dropped as the oldest
    expect(entries[0].url).toBe("https://example.com/50");
    expect(entries[49].url).toBe("https://example.com/1");
  });

  test("removeFromGraveyard removes entry by URL", () => {
    const entry1: GraveyardEntry = {
      url: "https://example.com/dead",
      timestamp: "20261122030900",
      title: "Dead Page",
      resurrectedAt: "2026-11-22T22:00:00.000Z",
    };
    const entry2: GraveyardEntry = {
      url: "https://example.com/alive",
      timestamp: "20261122031000",
      title: "Alive Page",
      resurrectedAt: "2026-11-22T22:01:00.000Z",
    };

    addToGraveyard(entry1);
    addToGraveyard(entry2);
    removeFromGraveyard("https://example.com/dead");

    expect(loadGraveyard()).toEqual([entry2]);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "seance_graveyard",
      JSON.stringify([entry2]),
    );
  });

  test("removeFromGraveyard removes all matching URLs", () => {
    const entry1: GraveyardEntry = {
      url: "https://example.com/dead",
      timestamp: "20261122030900",
      title: "Dead Page 1",
      resurrectedAt: "2026-11-22T22:00:00.000Z",
    };
    const entry2: GraveyardEntry = {
      url: "https://example.com/dead",
      timestamp: "20261122031000",
      title: "Dead Page 2",
      resurrectedAt: "2026-11-22T22:01:00.000Z",
    };
    const entry3: GraveyardEntry = {
      url: "https://example.com/alive",
      timestamp: "20261122031100",
      title: "Alive Page",
      resurrectedAt: "2026-11-22T22:02:00.000Z",
    };

    addToGraveyard(entry1);
    addToGraveyard(entry2);
    addToGraveyard(entry3);
    removeFromGraveyard("https://example.com/dead");

    expect(loadGraveyard()).toEqual([entry3]);
  });

  test("loadGraveyard handles invalid localStorage data", () => {
    // Set invalid JSON
    localStorage.setItem("seance_graveyard", "not valid json");
    expect(loadGraveyard()).toEqual([]);

    // Set non-array data
    localStorage.setItem("seance_graveyard", '{"key": "value"}');
    expect(loadGraveyard()).toEqual([]);

    // Set null
    localStorage.setItem("seance_graveyard", null as unknown as string);
    expect(loadGraveyard()).toEqual([]);
  });
});

describe("API key operations", () => {
  beforeEach(() => {
    setupMockStorage();
    localStorage.clear();
  });

  test("loadApiKey returns null when no key exists", () => {
    expect(loadApiKey()).toBeNull();
  });

  test("saveApiKey stores the key", () => {
    saveApiKey("my-api-key-123");

    expect(loadApiKey()).toBe("my-api-key-123");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "seance_api_key",
      "my-api-key-123",
    );
  });

  test("saveApiKey trims whitespace", () => {
    saveApiKey("  my-api-key-123  ");

    expect(loadApiKey()).toBe("my-api-key-123");
  });

  test("saveApiKey throws for empty string", () => {
    expect(() => saveApiKey("")).toThrow("API key cannot be empty");
  });

  test("saveApiKey throws for whitespace-only string", () => {
    expect(() => saveApiKey("   ")).toThrow("API key cannot be empty");
  });

  test("clearApiKey removes the key", () => {
    saveApiKey("my-api-key-123");
    clearApiKey();

    expect(loadApiKey()).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith("seance_api_key");
  });

  test("loadApiKey handles localStorage errors", () => {
    // Mock getItem to throw
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("localStorage error");
    });

    expect(loadApiKey()).toBeNull();
  });

  test("saveApiKey handles localStorage errors", () => {
    // Mock setItem to throw
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("localStorage error");
    });

    // Should not throw
    expect(() => saveApiKey("my-api-key")).not.toThrow();
  });

  test("clearApiKey handles localStorage errors", () => {
    // Mock removeItem to throw
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("localStorage error");
    });

    // Should not throw
    expect(() => clearApiKey()).not.toThrow();
  });
});

describe("localStorage unavailability", () => {
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    // Save the original localStorage and replace it with undefined
    originalLocalStorage = (global as unknown as { localStorage?: Storage })
      .localStorage;
    Object.defineProperty(global, "localStorage", {
      value: undefined,
      writable: true,
    });
  });

  afterEach(() => {
    // Restore localStorage
    if (originalLocalStorage) {
      Object.defineProperty(global, "localStorage", {
        value: originalLocalStorage,
        writable: true,
      });
    }
  });

  test("loadGraveyard returns empty array without localStorage", () => {
    expect(loadGraveyard()).toEqual([]);
  });

  test("addToGraveyard does not throw without localStorage", () => {
    expect(() =>
      addToGraveyard({
        url: "https://example.com",
        timestamp: "20261122030900",
        title: "Test",
        resurrectedAt: "2026-11-22T22:00:00.000Z",
      }),
    ).not.toThrow();
  });

  test("removeFromGraveyard does not throw without localStorage", () => {
    expect(() => removeFromGraveyard("https://example.com")).not.toThrow();
  });

  test("loadApiKey returns null without localStorage", () => {
    expect(loadApiKey()).toBeNull();
  });

  test("saveApiKey does not throw without localStorage", () => {
    expect(() => saveApiKey("my-key")).not.toThrow();
  });

  test("clearApiKey does not throw without localStorage", () => {
    expect(() => clearApiKey()).not.toThrow();
  });
});

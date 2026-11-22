/**
 * Local storage utilities for Séance.
 * 
 * Provides safe CRUD operations for the Graveyard (history) and API key storage,
 * all guarded against localStorage unavailability.
 */

const GRAVEYARD_KEY = "seance_graveyard";
const API_KEY_KEY = "seance_api_key";
const MAX_GRAVEYARD_ENTRIES = 50;

export type GraveyardEntry = {
  url: string;
  timestamp: string;
  title: string;
  resurrectedAt: string; // ISO timestamp
};

/**
 * Load the graveyard from localStorage.
 * Returns an empty array if localStorage is unavailable or no entries exist.
 */
export function loadGraveyard(): GraveyardEntry[] {
  try {
    const raw = localStorage.getItem(GRAVEYARD_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as GraveyardEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Add an entry to the graveyard, keeping only the 50 most recent.
 * The new entry is added at the front (newest first).
 */
export function addToGraveyard(entry: GraveyardEntry): void {
  try {
    const entries = loadGraveyard();
    const updated = [entry, ...entries].slice(0, MAX_GRAVEYARD_ENTRIES);
    localStorage.setItem(GRAVEYARD_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Remove an entry from the graveyard by URL.
 * All entries with the matching URL are removed.
 */
export function removeFromGraveyard(url: string): void {
  try {
    const entries = loadGraveyard();
    const updated = entries.filter((e) => e.url !== url);
    localStorage.setItem(GRAVEYARD_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Load the saved API key.
 * Returns null if no key is stored or localStorage is unavailable.
 */
export function loadApiKey(): string | null {
  try {
    const raw = localStorage.getItem(API_KEY_KEY);
    return raw ?? null;
  } catch {
    return null;
  }
}

/**
 * Save an API key to localStorage.
 * Throws if the key is empty or whitespace-only.
 */
export function saveApiKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty");
  }
  try {
    localStorage.setItem(API_KEY_KEY, trimmed);
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Clear the saved API key.
 */
export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_KEY);
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

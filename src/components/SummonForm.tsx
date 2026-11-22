import { useState } from "react";

/**
 * Props for SummonForm component.
 * 
 * @param busy - When true, the form is disabled and shows loading state
 * @param progressText - Staged progress text to display (e.g., "Consulting the archives…")
 * @param onSummon - Callback called with the raw (unnormalized) URL when a valid summon is submitted
 */
export interface SummonFormProps {
  busy: boolean;
  progressText?: string;
  onSummon: (rawUrl: string) => void;
}

/**
 * SummonForm - URL input form for summoning dead links.
 * 
 * Features:
 * - Inline validation errors for invalid URLs
 * - Disabled state while summoning (busy prop)
 * - Staged progress text display
 * - Calls onSummon with raw input on valid submit
 */
export default function SummonForm({ busy, progressText, onSummon }: SummonFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Validate URL format (client-side)
  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setError("Please enter a URL");
      return false;
    }

    try {
      const parsed = new URL(input);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("URL must start with http:// or https://");
        return false;
      }
      if (!parsed.hostname) {
        setError("URL must include a hostname");
        return false;
      }
    } catch {
      setError("Invalid URL format");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Don't submit if busy or if validation fails
    if (busy) {
      return;
    }

    if (!validateUrl(url)) {
      return;
    }

    // Call the handler with raw input (no normalization here—App will normalize)
    onSummon(url.trim());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    // Clear error when user starts typing
    if (error && e.target.value.trim()) {
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <form className="summon-form" onSubmit={handleSubmit} aria-label="Summon a dead link">
      <label htmlFor="summon-url" className="summon-form-label">
        Enter dead URL
      </label>
      <div className="summon-form-input-wrapper">
        <input
          id="summon-url"
          type="text"
          value={url}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com/dead-page"
          disabled={busy}
          aria-invalid={!!error}
          aria-describedby={error ? "summon-error" : undefined}
          className="summon-form-input"
        />
        <button
          type="submit"
          disabled={busy || !!error}
          className="summon-form-button"
          aria-busy={busy ? "true" : "false"}
        >
          {busy ? (
            <>
              <span className="summon-form-button-spinner" aria-hidden="true" />
              <span className="summon-form-button-text">
                {progressText || "Summoning…"}
              </span>
            </>
          ) : (
            "Summon"
          )}
        </button>
      </div>
      {error && (
        <p id="summon-error" className="summon-form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

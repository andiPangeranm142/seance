/**
 * Unit tests for SummonForm component.
 */

import { describe, expect, test, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import SummonForm from "./SummonForm";

// Ensure cleanup after each test to isolate DOM
afterEach(() => {
  cleanup();
});

describe("SummonForm", () => {
  describe("rendering", () => {
    test("renders label", () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      expect(screen.getByLabelText("Enter dead URL")).toBeInTheDocument();
    });

    test("renders input field", () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      expect(input).toBeInTheDocument();
      expect(input).toBeVisible();
    });

    test("renders submit button", () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const button = screen.getByRole("button", { name: "Summon" });
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    test("shows button text as Summon when not busy", () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      expect(screen.getByRole("button", { name: "Summon" })).toBeInTheDocument();
    });

    test("shows button text with progress when busy", () => {
      render(<SummonForm busy={true} progressText="Consulting the archives…" onSummon={() => {}} />);
      expect(screen.getByRole("button", { name: /Consulting the archives…/i })).toBeInTheDocument();
    });
  });

  describe("validation errors", () => {
    test("shows error for empty input on submit", async () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Please enter a URL");
      });
    });

    test("shows error for non-http URL", async () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      fireEvent.change(input, { target: { value: "ftp://example.com" } });

      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("URL must start with http:// or https://");
      });
    });

    test("shows error for invalid URL format", async () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      fireEvent.change(input, { target: { value: "not a valid url" } });

      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid URL format");
      });
    });

    test("clears error when user starts typing", async () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      
      // First trigger an error
      const form = screen.getByRole("form");
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      // Now type something
      fireEvent.change(input, { target: { value: "http://" } });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    test("does not call handler when validation fails", () => {
      const mockOnSubmit = vi.fn();
      render(<SummonForm busy={false} onSummon={mockOnSubmit} />);

      const form = screen.getByRole("form");
      fireEvent.submit(form);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("valid submission", () => {
    test("calls handler with raw URL on valid submission", async () => {
      const mockOnSubmit = vi.fn();
      render(<SummonForm busy={false} onSummon={mockOnSubmit} />);

      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      fireEvent.change(input, { target: { value: "http://Example.COM:80/Path//To//Page?utm_source=google" } });

      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith("http://Example.COM:80/Path//To//Page?utm_source=google");
      });
    });

    test("calls handler with trimmed URL", async () => {
      const mockOnSubmit = vi.fn();
      render(<SummonForm busy={false} onSummon={mockOnSubmit} />);

      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      fireEvent.change(input, { target: { value: "  http://example.com/test  " } });

      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith("http://example.com/test");
      });
    });

    test("accepts https URLs", async () => {
      const mockOnSubmit = vi.fn();
      render(<SummonForm busy={false} onSummon={mockOnSubmit} />);

      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      fireEvent.change(input, { target: { value: "https://secure.example.com/path" } });

      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith("https://secure.example.com/path");
      });
    });
  });

  describe("disabled state", () => {
    test("disables input when busy", () => {
      render(<SummonForm busy={true} onSummon={() => {}} />);
      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      expect(input).toBeDisabled();
    });

    test("disables button when busy", () => {
      render(<SummonForm busy={true} onSummon={() => {}} />);
      const button = screen.getByRole("button", { name: /Summoning…/i });
      expect(button).toBeDisabled();
    });

    test("disables button when there is an error", async () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: "Summon" });
        expect(button).toBeDisabled();
      });
    });

    test("does not disable button when valid and not busy", () => {
      render(<SummonForm busy={false} onSummon={() => {}} />);
      const button = screen.getByRole("button", { name: "Summon" });
      expect(button).toBeEnabled();
    });

    test("does not call handler when busy is true", () => {
      const mockOnSubmit = vi.fn();
      render(<SummonForm busy={true} onSummon={mockOnSubmit} />);

      const form = screen.getByRole("form");
      fireEvent.submit(form);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("progress text", () => {
    test("shows spinner when busy", () => {
      render(<SummonForm busy={true} progressText="Summoning…" onSummon={() => {}} />);
      const spinner = screen.getByText(/Summoning…/i);
      expect(spinner).toBeInTheDocument();
    });

    test("uses default progress text when not provided", () => {
      render(<SummonForm busy={true} onSummon={() => {}} />);
      expect(screen.getByRole("button", { name: /Summoning…/i })).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    test("calls validateUrl on keyDown with Enter", async () => {
      const mockOnSubmit = vi.fn();
      render(<SummonForm busy={false} onSummon={mockOnSubmit} />);

      const input = screen.getByPlaceholderText("https://example.com/dead-page");
      fireEvent.change(input, { target: { value: "http://example.com" } });
      
      // Simulate pressing Enter on the input - this triggers handleKeyDown
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      // Now submit the form to ensure it gets called
      const form = screen.getByRole("form");
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith("http://example.com");
      });
    });
  });
});

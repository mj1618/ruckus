"use client";

import { useState } from "react";
import { useUser } from "@/components/UserContext";
import { getAvatarColor } from "@/lib/avatarColor";

export function JoinScreen() {
  const { join } = useUser();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = username.trim();
  const avatarColor = trimmed ? getAvatarColor(trimmed) : "#6b7280";
  const firstLetter = trimmed ? trimmed[0].toUpperCase() : "?";

  const validate = (name: string): string | null => {
    if (name.length === 0) return "Username is required";
    if (name.length > 30) return "Username must be 30 characters or less";
    if (!/^[a-zA-Z0-9 _-]+$/.test(name))
      return "Only letters, numbers, spaces, underscores, and hyphens";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await join(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col items-center gap-6 px-4"
      >
        <h1 className="text-5xl font-bold text-text">Ruckus</h1>
        <p className="text-text-muted">
          Jump in. Pick a name. Start talking.
        </p>

        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg transition-colors"
          style={{ backgroundColor: avatarColor }}
        >
          {firstLetter}
        </div>

        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError("");
          }}
          placeholder="Enter your name..."
          maxLength={30}
          autoFocus
          className="w-full rounded-lg border border-border bg-overlay px-4 py-3 text-text placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !trimmed}
          className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Joining..." : "Join"}
        </button>
      </form>
    </div>
  );
}

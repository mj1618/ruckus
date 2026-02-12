"use client";

import { useState } from "react";
import { useUser } from "@/components/UserContext";
import { getAvatarColor } from "@/lib/avatarColor";
import { Avatar } from "@/components/Avatar";

type Mode = "signup" | "login";

export function JoinScreen() {
  const { signup, login } = useUser();
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = username.trim();
  const avatarColor = trimmed ? getAvatarColor(trimmed) : "#6b7280";

  const validate = (): string | null => {
    if (trimmed.length === 0) return "Username is required";
    if (trimmed.length > 30) return "Username must be 30 characters or less";
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed))
      return "Only letters, numbers, spaces, underscores, and hyphens";
    if (password.length < 4) return "Password must be at least 4 characters";
    if (mode === "signup" && password !== confirmPassword)
      return "Passwords do not match";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      if (mode === "signup") {
        await signup(trimmed, password);
      } else {
        await login(trimmed, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signup" ? "login" : "signup");
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col items-center gap-5 px-4"
      >
        <h1 className="text-5xl font-bold text-text">Ruckus</h1>
        <p className="text-text-muted">
          {mode === "signup"
            ? "Pick a name and password to get started."
            : "Welcome back. Log in to continue."}
        </p>

        <Avatar
          username={trimmed || "?"}
          avatarColor={avatarColor}
          size="lg"
          className="h-16 w-16 text-2xl shadow-lg transition-colors"
        />

        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError("");
          }}
          placeholder="Username"
          maxLength={30}
          autoFocus
          className="w-full rounded-lg border border-border bg-overlay px-4 py-3 text-text placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          placeholder="Password"
          className="w-full rounded-lg border border-border bg-overlay px-4 py-3 text-text placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        {mode === "signup" && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            placeholder="Confirm password"
            className="w-full rounded-lg border border-border bg-overlay px-4 py-3 text-text placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || !trimmed || !password}
          className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? mode === "signup"
              ? "Creating account..."
              : "Logging in..."
            : mode === "signup"
              ? "Sign Up"
              : "Log In"}
        </button>

        <p className="text-sm text-text-muted">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="font-medium text-accent hover:underline"
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </form>
    </div>
  );
}

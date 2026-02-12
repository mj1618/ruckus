"use client";

import { useEffect } from "react";
import { useTheme, Theme } from "@/components/ThemeContext";

// Theme definitions with preview colors
const THEMES: {
  id: Theme;
  label: string;
  icon: string;
  preview: {
    bg: string;
    surface: string;
    accent: string;
    text: string;
    muted: string;
  };
}[] = [
  {
    id: "dark",
    label: "Dark",
    icon: "🌑",
    preview: {
      bg: "#1e1f22",
      surface: "#2b2d31",
      accent: "#5865f2",
      text: "#f2f3f5",
      muted: "#949ba4",
    },
  },
  {
    id: "light",
    label: "Light",
    icon: "☀️",
    preview: {
      bg: "#f2f3f5",
      surface: "#ffffff",
      accent: "#5865f2",
      text: "#060607",
      muted: "#6d6f78",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    icon: "🌌",
    preview: {
      bg: "#0d1117",
      surface: "#161b22",
      accent: "#58a6ff",
      text: "#e6edf3",
      muted: "#8b949e",
    },
  },
  {
    id: "forest",
    label: "Forest",
    icon: "🌲",
    preview: {
      bg: "#0f1612",
      surface: "#171f1a",
      accent: "#34d399",
      text: "#ecfdf5",
      muted: "#7a9c8a",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    icon: "🌅",
    preview: {
      bg: "#1a1412",
      surface: "#231c18",
      accent: "#f97316",
      text: "#fef3e2",
      muted: "#a89888",
    },
  },
];

interface ThemePickerProps {
  onClose: () => void;
}

export function ThemePicker({ onClose }: ThemePickerProps) {
  const { theme, setTheme } = useTheme();

  // Close on escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Choose Theme</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-hover hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                theme === t.id
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-border hover:border-text-muted"
              }`}
            >
              {/* Mini preview */}
              <div
                className="aspect-[4/3] p-2"
                style={{ backgroundColor: t.preview.bg }}
              >
                {/* Fake sidebar */}
                <div
                  className="mb-1.5 h-1.5 w-8 rounded-sm"
                  style={{ backgroundColor: t.preview.muted }}
                />
                <div className="flex gap-1.5">
                  {/* Sidebar area */}
                  <div className="w-6 space-y-1">
                    <div
                      className="h-1 w-full rounded-sm"
                      style={{ backgroundColor: t.preview.muted, opacity: 0.5 }}
                    />
                    <div
                      className="h-1 w-full rounded-sm"
                      style={{ backgroundColor: t.preview.accent }}
                    />
                    <div
                      className="h-1 w-full rounded-sm"
                      style={{ backgroundColor: t.preview.muted, opacity: 0.5 }}
                    />
                  </div>
                  {/* Main content area */}
                  <div
                    className="flex-1 rounded-sm p-1"
                    style={{ backgroundColor: t.preview.surface }}
                  >
                    <div
                      className="mb-1 h-1 w-3/4 rounded-sm"
                      style={{ backgroundColor: t.preview.text, opacity: 0.8 }}
                    />
                    <div
                      className="mb-0.5 h-0.5 w-full rounded-sm"
                      style={{ backgroundColor: t.preview.muted, opacity: 0.5 }}
                    />
                    <div
                      className="mb-0.5 h-0.5 w-5/6 rounded-sm"
                      style={{ backgroundColor: t.preview.muted, opacity: 0.5 }}
                    />
                    <div
                      className="h-0.5 w-2/3 rounded-sm"
                      style={{ backgroundColor: t.preview.muted, opacity: 0.5 }}
                    />
                  </div>
                </div>
              </div>

              {/* Label */}
              <div
                className="flex items-center justify-center gap-1.5 px-2 py-2"
                style={{ backgroundColor: t.preview.surface }}
              >
                <span className="text-sm">{t.icon}</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: t.preview.text }}
                >
                  {t.label}
                </span>
                {theme === t.id && (
                  <span
                    className="ml-auto text-xs"
                    style={{ color: t.preview.accent }}
                  >
                    ✓
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

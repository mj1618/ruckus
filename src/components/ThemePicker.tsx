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
  {
    id: "ocean",
    label: "Ocean",
    icon: "🌊",
    preview: {
      bg: "#0a1628",
      surface: "#0f2137",
      accent: "#06b6d4",
      text: "#e0f2fe",
      muted: "#7aa2c4",
    },
  },
  {
    id: "rose",
    label: "Rose",
    icon: "🌸",
    preview: {
      bg: "#1a1318",
      surface: "#241c22",
      accent: "#f472b6",
      text: "#fce7f3",
      muted: "#b58a9f",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    icon: "🧛",
    preview: {
      bg: "#21222c",
      surface: "#282a36",
      accent: "#bd93f9",
      text: "#f8f8f2",
      muted: "#6272a4",
    },
  },
  {
    id: "nord",
    label: "Nord",
    icon: "❄️",
    preview: {
      bg: "#2e3440",
      surface: "#3b4252",
      accent: "#88c0d0",
      text: "#eceff4",
      muted: "#7b88a1",
    },
  },
  {
    id: "coffee",
    label: "Coffee",
    icon: "☕",
    preview: {
      bg: "#1c1816",
      surface: "#2a2420",
      accent: "#d4a574",
      text: "#f5ebe0",
      muted: "#9c8b7a",
    },
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    icon: "🔆",
    preview: {
      bg: "#002b36",
      surface: "#073642",
      accent: "#268bd2",
      text: "#fdf6e3",
      muted: "#839496",
    },
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    icon: "🌤️",
    preview: {
      bg: "#fdf6e3",
      surface: "#eee8d5",
      accent: "#268bd2",
      text: "#073642",
      muted: "#657b83",
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    icon: "🎨",
    preview: {
      bg: "#1e1f1c",
      surface: "#272822",
      accent: "#a6e22e",
      text: "#f8f8f2",
      muted: "#75715e",
    },
  },
  {
    id: "gruvbox",
    label: "Gruvbox",
    icon: "🟤",
    preview: {
      bg: "#1d2021",
      surface: "#282828",
      accent: "#fabd2f",
      text: "#ebdbb2",
      muted: "#928374",
    },
  },
  {
    id: "synthwave",
    label: "Synthwave",
    icon: "🌆",
    preview: {
      bg: "#1a1025",
      surface: "#241b2f",
      accent: "#f92aad",
      text: "#f4eeff",
      muted: "#9d8bba",
    },
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    icon: "🐱",
    preview: {
      bg: "#1e1e2e",
      surface: "#313244",
      accent: "#cba6f7",
      text: "#cdd6f4",
      muted: "#6c7086",
    },
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    icon: "🗼",
    preview: {
      bg: "#16161e",
      surface: "#1a1b26",
      accent: "#7aa2f7",
      text: "#c0caf5",
      muted: "#565f89",
    },
  },
  {
    id: "one-dark",
    label: "One Dark",
    icon: "⚛️",
    preview: {
      bg: "#21252b",
      surface: "#282c34",
      accent: "#61afef",
      text: "#abb2bf",
      muted: "#5c6370",
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
              {/* Selected checkmark - fixed to top right */}
              {theme === t.id && (
                <div
                  className="absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: t.preview.accent }}
                >
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}

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
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

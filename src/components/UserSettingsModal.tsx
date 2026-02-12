"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useTheme, Theme } from "@/components/ThemeContext";
import { clearSessionId } from "@/lib/sessionId";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const THEMES: { id: Theme; name: string; preview: { bg: string; surface: string; accent: string; text: string; muted: string } }[] = [
  { id: "dark", name: "Dark", preview: { bg: "#1e1f22", surface: "#2b2d31", accent: "#5865f2", text: "#f2f3f5", muted: "#949ba4" } },
  { id: "light", name: "Light", preview: { bg: "#f2f3f5", surface: "#ffffff", accent: "#5865f2", text: "#060607", muted: "#6d6f78" } },
  { id: "midnight", name: "Midnight", preview: { bg: "#0d1117", surface: "#161b22", accent: "#58a6ff", text: "#e6edf3", muted: "#8b949e" } },
  { id: "forest", name: "Forest", preview: { bg: "#0f1612", surface: "#171f1a", accent: "#34d399", text: "#ecfdf5", muted: "#7a9c8a" } },
  { id: "sunset", name: "Sunset", preview: { bg: "#1a1412", surface: "#231c18", accent: "#f97316", text: "#fef3e2", muted: "#a89888" } },
  { id: "ocean", name: "Ocean", preview: { bg: "#0a1628", surface: "#0f2137", accent: "#06b6d4", text: "#e0f2fe", muted: "#7aa2c4" } },
  { id: "rose", name: "Rose", preview: { bg: "#1a1318", surface: "#241c22", accent: "#f472b6", text: "#fce7f3", muted: "#b58a9f" } },
  { id: "dracula", name: "Dracula", preview: { bg: "#21222c", surface: "#282a36", accent: "#bd93f9", text: "#f8f8f2", muted: "#6272a4" } },
  { id: "nord", name: "Nord", preview: { bg: "#2e3440", surface: "#3b4252", accent: "#88c0d0", text: "#eceff4", muted: "#7b88a1" } },
  { id: "coffee", name: "Coffee", preview: { bg: "#1c1816", surface: "#2a2420", accent: "#d4a574", text: "#f5ebe0", muted: "#9c8b7a" } },
  { id: "solarized-dark", name: "Solar Dark", preview: { bg: "#002b36", surface: "#073642", accent: "#268bd2", text: "#fdf6e3", muted: "#839496" } },
  { id: "solarized-light", name: "Solar Light", preview: { bg: "#fdf6e3", surface: "#eee8d5", accent: "#268bd2", text: "#073642", muted: "#657b83" } },
  { id: "monokai", name: "Monokai", preview: { bg: "#1e1f1c", surface: "#272822", accent: "#a6e22e", text: "#f8f8f2", muted: "#75715e" } },
  { id: "gruvbox", name: "Gruvbox", preview: { bg: "#1d2021", surface: "#282828", accent: "#fabd2f", text: "#ebdbb2", muted: "#928374" } },
  { id: "synthwave", name: "Synthwave", preview: { bg: "#1a1025", surface: "#241b2f", accent: "#f92aad", text: "#f4eeff", muted: "#9d8bba" } },
  { id: "catppuccin", name: "Catppuccin", preview: { bg: "#1e1e2e", surface: "#313244", accent: "#cba6f7", text: "#cdd6f4", muted: "#6c7086" } },
  { id: "tokyo-night", name: "Tokyo", preview: { bg: "#16161e", surface: "#1a1b26", accent: "#7aa2f7", text: "#c0caf5", muted: "#565f89" } },
  { id: "one-dark", name: "One Dark", preview: { bg: "#21252b", surface: "#282c34", accent: "#61afef", text: "#abb2bf", muted: "#5c6370" } },
];

const PRESET_STATUSES = [
  { emoji: "👀", text: "lurking" },
  { emoji: "🍕", text: "grabbing lunch" },
  { emoji: "💻", text: "coding" },
  { emoji: "🎧", text: "listening to music" },
  { emoji: "🏃", text: "be right back" },
  { emoji: "🌙", text: "away" },
];

type SettingsTab = "profile" | "appearance" | "account";

interface UserSettingsModalProps {
  user: {
    _id: Id<"users">;
    username: string;
    avatarColor: string;
    avatarUrl?: string | null;
    statusEmoji?: string;
    statusText?: string;
  };
  onClose: () => void;
}

export function UserSettingsModal({ user, onClose }: UserSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [statusEmoji, setStatusEmoji] = useState(user.statusEmoji || "");
  const [statusText, setStatusText] = useState(user.statusText || "");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);
  const statusDirty = useRef(false);
  const statusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const setStatus = useMutation(api.users.setStatus);
  const clearStatus = useMutation(api.users.clearStatus);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const updateAvatar = useMutation(api.users.updateAvatar);
  const removeAvatar = useMutation(api.users.removeAvatar);

  function handlePickAvatar() {
    setAvatarError(null);
    avatarInputRef.current?.click();
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError("Please select a JPG, PNG, GIF, or WebP image");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setAvatarError("Image must be less than 5MB");
      return;
    }

    setAvatarUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await updateAvatar({ userId: user._id, storageId });
    } catch {
      setAvatarError("Failed to upload image. Please try again.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await removeAvatar({ userId: user._id });
    } catch {
      setAvatarError("Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  }

  // Auto-save status whenever emoji or text changes (debounced)
  // Only fires after the user has actually touched the inputs
  useEffect(() => {
    if (!statusDirty.current) return;

    if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
    if (statusSavedTimerRef.current) clearTimeout(statusSavedTimerRef.current);
    setStatusSaved(false);
    setStatusSaving(true);

    statusDebounceRef.current = setTimeout(async () => {
      try {
        if (!statusEmoji && !statusText.trim()) {
          await clearStatus({ userId: user._id });
        } else {
          await setStatus({
            userId: user._id,
            statusEmoji: statusEmoji || undefined,
            statusText: statusText.trim() || undefined,
          });
        }
        setStatusSaving(false);
        setStatusSaved(true);
        statusSavedTimerRef.current = setTimeout(() => setStatusSaved(false), 1800);
      } catch {
        setStatusSaving(false);
      }
    }, 600);

    return () => {
      if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
    };
  }, [statusEmoji, statusText, user._id, setStatus, clearStatus]);

  function handlePreset(preset: { emoji: string; text: string }) {
    statusDirty.current = true;
    setStatusEmoji(preset.emoji);
    setStatusText(preset.text);
  }

  async function handleClearStatus() {
    statusDirty.current = false;
    if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
    if (statusSavedTimerRef.current) clearTimeout(statusSavedTimerRef.current);
    setStatusSaving(false);
    setStatusSaved(false);
    await clearStatus({ userId: user._id });
    setStatusEmoji("");
    setStatusText("");
  }

  function handleLogout() {
    clearSessionId();
    window.location.reload();
  }

  const menuItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "profile",
      label: "Profile",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
    },
    {
      id: "account",
      label: "Account",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[600px] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        {/* Sidebar */}
        <div className="flex w-48 flex-col border-r border-border bg-elevated">
          <div className="p-4">
            <h2 className="text-lg font-bold text-text">Settings</h2>
          </div>
          <nav className="flex-1 px-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeTab === item.id
                    ? "bg-selected text-text"
                    : "text-text-muted hover:bg-hover hover:text-text-secondary"
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-lg font-semibold text-text">
              {menuItems.find((m) => m.id === activeTab)?.label}
            </h3>
            <button
              type="button"
              className="rounded p-1 text-text-muted hover:bg-hover hover:text-text"
              onClick={onClose}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* Avatar */}
                <div>
                  <div className="mb-3 text-sm font-semibold text-text-muted">Profile Picture</div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="group relative rounded-full hover:ring-2 hover:ring-accent/50 disabled:opacity-50"
                      onClick={handlePickAvatar}
                      disabled={avatarUploading}
                    >
                      <Avatar
                        username={user.username}
                        avatarColor={user.avatarColor}
                        avatarUrl={user.avatarUrl}
                        size="lg"
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {avatarUploading ? (
                          <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </div>
                    </button>
                    <div>
                      <div className="text-base font-medium text-text">{user.username}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-sm text-accent hover:underline disabled:opacity-50"
                          onClick={handlePickAvatar}
                          disabled={avatarUploading}
                        >
                          {avatarUploading ? "Uploading..." : "Change picture"}
                        </button>
                        {user.avatarUrl && !avatarUploading && (
                          <button
                            type="button"
                            className="text-sm text-danger hover:underline"
                            onClick={handleRemoveAvatar}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {avatarError && (
                    <p className="mt-2 text-xs text-danger">{avatarError}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <div className="mb-3 text-sm font-semibold text-text-muted">Status</div>
                  <div className="mb-3 flex gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded border border-border bg-overlay text-lg hover:bg-hover"
                        onClick={() => setShowEmojiPicker((v) => !v)}
                      >
                        {statusEmoji || "😀"}
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 z-10 mb-1">
                          <EmojiPicker
                            onSelect={(e) => {
                              statusDirty.current = true;
                              setStatusEmoji(e);
                              setShowEmojiPicker(false);
                            }}
                            onClose={() => setShowEmojiPicker(false)}
                          />
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={statusText}
                      onChange={(e) => { statusDirty.current = true; setStatusText(e.target.value); }}
                      placeholder="What's your status?"
                      maxLength={100}
                      className="flex-1 rounded border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-accent"
                    />
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {PRESET_STATUSES.map((preset) => (
                      <button
                        key={preset.text}
                        type="button"
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-hover"
                        onClick={() => handlePreset(preset)}
                      >
                        {preset.emoji} {preset.text}
                      </button>
                    ))}
                  </div>
                  <div className="flex h-6 items-center justify-between">
                    {statusSaving ? (
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted animate-pulse">
                        Saving…
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-xs text-green-400 transition-all duration-300 ${
                          statusSaved ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                        }`}
                      >
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M4 10.5L8 14.5L16 5.5"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={statusSaved ? { animation: "statusCheckDraw 0.35s ease-out both" } : undefined}
                          />
                        </svg>
                        Saved
                      </span>
                    )}
                    {(statusEmoji || statusText || user.statusEmoji || user.statusText) && (
                      <button
                        type="button"
                        className="text-xs text-text-muted hover:text-text-secondary"
                        onClick={handleClearStatus}
                      >
                        Clear status
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div>
                <div className="mb-3 text-sm font-semibold text-text-muted">Theme</div>
                <div className="grid grid-cols-3 gap-3">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                        theme === t.id
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-border hover:border-text-muted"
                      }`}
                      onClick={() => setTheme(t.id)}
                    >
                      {/* Selected checkmark */}
                      {theme === t.id && (
                        <div
                          className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full"
                          style={{ backgroundColor: t.preview.accent }}
                        >
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
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
                        {/* Fake header */}
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
                        className="flex items-center justify-center px-2 py-1.5"
                        style={{ backgroundColor: t.preview.surface }}
                      >
                        <span
                          className="text-xs font-medium"
                          style={{ color: t.preview.text }}
                        >
                          {t.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "account" && (
              <div className="space-y-6">
                <div>
                  <div className="mb-3 text-sm font-semibold text-text-muted">Account Info</div>
                  <div className="rounded-lg border border-border bg-overlay p-4">
                    <div className="text-sm text-text-secondary">
                      Logged in as <span className="font-medium text-text">{user.username}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-sm font-semibold text-text-muted">Log Out</div>
                  <p className="mb-3 text-sm text-text-secondary">
                    This will log you out and clear your session. You can log back in with the same username.
                  </p>
                  <button
                    type="button"
                    className="rounded border border-danger/50 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
}

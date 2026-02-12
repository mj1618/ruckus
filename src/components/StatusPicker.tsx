"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EmojiPicker } from "@/components/EmojiPicker";

const PRESET_STATUSES = [
  { emoji: "👀", text: "lurking" },
  { emoji: "🍕", text: "grabbing lunch" },
  { emoji: "💻", text: "coding" },
  { emoji: "🎧", text: "listening to music" },
  { emoji: "🏃", text: "be right back" },
  { emoji: "🌙", text: "away" },
];

interface StatusPickerProps {
  userId: Id<"users">;
  currentEmoji?: string;
  currentText?: string;
  onClose: () => void;
}

export function StatusPicker({ userId, currentEmoji, currentText, onClose }: StatusPickerProps) {
  const [emoji, setEmoji] = useState(currentEmoji || "");
  const [text, setText] = useState(currentText || "");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const setStatus = useMutation(api.users.setStatus);
  const clearStatus = useMutation(api.users.clearStatus);

  async function handleSave() {
    if (!emoji && !text.trim()) {
      await clearStatus({ userId });
    } else {
      await setStatus({
        userId,
        statusEmoji: emoji || undefined,
        statusText: text.trim() || undefined,
      });
    }
    onClose();
  }

  function handlePreset(preset: { emoji: string; text: string }) {
    setEmoji(preset.emoji);
    setText(preset.text);
  }

  async function handleClear() {
    await clearStatus({ userId });
    onClose();
  }

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl">
      <div className="mb-2 text-xs font-semibold uppercase text-zinc-400">Set a status</div>

      {/* Input row */}
      <div className="mb-2 flex gap-2">
        <div className="relative">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-600 bg-zinc-700 text-lg hover:bg-zinc-600"
            onClick={() => setShowEmojiPicker(v => !v)}
          >
            {emoji || "😀"}
          </button>
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={(e) => { setEmoji(e); setShowEmojiPicker(false); }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's your status?"
          maxLength={100}
          className="flex-1 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }}
          autoFocus
        />
      </div>

      {/* Presets */}
      <div className="mb-2 space-y-1">
        {PRESET_STATUSES.map((preset) => (
          <button
            key={preset.text}
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-700"
            onClick={() => handlePreset(preset)}
          >
            <span>{preset.emoji}</span>
            <span>{preset.text}</span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={handleSave}
        >
          Save
        </button>
        {(currentEmoji || currentText) && (
          <button
            type="button"
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
            onClick={handleClear}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

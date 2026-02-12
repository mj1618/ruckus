"use client";

import { useEffect, useRef, useState } from "react";

const EMOJI_LIST = [
  "😀", "😂", "🥹", "😍", "🤩", "🥲", "😅", "😭",
  "🤔", "😬", "🙄", "😤", "👍", "👎", "👏", "🙌",
  "🤝", "✌️", "🤞", "💪", "❤️", "🧡", "💛", "💚",
  "💙", "💜", "🖤", "🔥", "⭐", "💯", "🎉", "🚀",
  "💡", "👀", "🫡", "✅", "❌", "➕", "🏆", "💎",
];

const PICKER_WIDTH = 280;

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Position the picker relative to the viewport using the parent button's position
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elHeight = elRect.height;

    // Try to place above the button
    let top = parentRect.top - elHeight - 4;
    // If it would go off the top, place below
    if (top < 4) {
      top = parentRect.bottom + 4;
    }
    // Clamp to bottom of viewport
    if (top + elHeight > window.innerHeight - 4) {
      top = window.innerHeight - elHeight - 4;
    }

    // Horizontal: center on parent, clamp to viewport
    let left = parentRect.left + parentRect.width / 2 - PICKER_WIDTH / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - PICKER_WIDTH - 4));

    setPos({ top, left });
  }, []);

  return (
    <div
      ref={ref}
      className="fixed z-50 grid grid-cols-8 gap-0.5 rounded-lg border border-border bg-overlay p-2 shadow-xl"
      style={{
        width: `${PICKER_WIDTH}px`,
        ...(pos ? { top: `${pos.top}px`, left: `${pos.left}px` } : { visibility: "hidden" as const }),
      }}
    >
      {EMOJI_LIST.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="cursor-pointer rounded p-1.5 text-lg hover:bg-active"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

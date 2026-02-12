# Custom User Status Messages

## Summary

Add custom status messages with emoji to user profiles (Phase 5 from PLAN.md). Users can set a status like "🍕 grabbing lunch" or "👀 lurking" that appears next to their name in the online users panel and in message headers. Statuses can be set via a UI popover or via the `/status` slash command.

## Why This Feature

- High visibility — status shows up in the online users panel and alongside messages
- Fun and expressive — users can share what they're doing
- Encourages engagement — people love customizing their presence
- Well-scoped — touches a few files but isn't overly complex

---

## Tasks

### 1. Schema & Backend Changes

**File: `convex/schema.ts`**

Add two optional fields to the `users` table:
```typescript
statusEmoji: v.optional(v.string()),  // e.g. "🍕"
statusText: v.optional(v.string()),   // e.g. "grabbing lunch"
```

No new tables or indexes needed — status is just user metadata.

**File: `convex/users.ts`**

Add a new mutation `setStatus`:
```typescript
export const setStatus = mutation({
  args: {
    userId: v.id("users"),
    statusEmoji: v.optional(v.string()),
    statusText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate: statusEmoji should be 0-10 chars, statusText 0-100 chars
    // If both are empty/undefined, clear the status
    await ctx.db.patch("users", args.userId, {
      statusEmoji: args.statusEmoji || undefined,
      statusText: args.statusText || undefined,
    });
  },
});
```

Add a mutation `clearStatus`:
```typescript
export const clearStatus = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch("users", args.userId, {
      statusEmoji: undefined,
      statusText: undefined,
    });
  },
});
```

Update `getOnlineUsers` to include `statusEmoji` and `statusText` in the returned fields.

Update `getCurrentUser` — the current query already returns the full user object, so it will automatically include the new fields.

Run `pnpm -s convex codegen` after schema changes.

### 2. Add `/status` Slash Command Support

**File: `convex/messages.ts`**

In the `sendMessage` mutation, add handling for `/status` slash command alongside existing `/me`, `/shrug`, `/poll`, `/nick` commands:

```typescript
// Handle /status command
if (text.startsWith("/status ")) {
  const statusStr = text.slice(8).trim();
  // Parse: first token could be an emoji, rest is text
  // Or if empty, clear status
  if (!statusStr) {
    await ctx.db.patch("users", args.userId, { statusEmoji: undefined, statusText: undefined });
  } else {
    // Try to detect emoji at the start (simple heuristic: first "word" if it's 1-4 chars and non-ascii)
    const parts = statusStr.split(/\s+/);
    const firstPart = parts[0];
    const isEmoji = firstPart && firstPart.length <= 4 && /[^\x00-\x7F]/.test(firstPart);
    if (isEmoji) {
      await ctx.db.patch("users", args.userId, {
        statusEmoji: firstPart,
        statusText: parts.slice(1).join(" ") || undefined,
      });
    } else {
      await ctx.db.patch("users", args.userId, {
        statusEmoji: undefined,
        statusText: statusStr,
      });
    }
  }
  // Send a system message confirming the status change
  return await ctx.db.insert("messages", {
    channelId: args.channelId,
    userId: args.userId,
    text: statusStr ? `set their status to ${statusStr}` : "cleared their status",
    type: "action",
  });
}
```

Also handle `/status` with no argument (clear status):
```typescript
if (text === "/status") {
  await ctx.db.patch("users", args.userId, { statusEmoji: undefined, statusText: undefined });
  return await ctx.db.insert("messages", {
    channelId: args.channelId,
    userId: args.userId,
    text: "cleared their status",
    type: "action",
  });
}
```

**File: `src/components/SlashCommandHint.tsx`**

Add the `/status` command to the hints list:
```
{ command: "/status", description: "Set your status — /status 🍕 grabbing lunch" }
```

### 3. Status Display in Online Users Panel

**File: `src/components/OnlineUsers.tsx`**

Update the user list items to show status below the username:

```tsx
<div key={user._id} className="flex items-center gap-2 rounded px-2 py-1.5">
  <div className="relative">
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: user.avatarColor }}
    >
      {user.username[0].toUpperCase()}
    </div>
    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-green-500" />
  </div>
  <div className="min-w-0 flex-1">
    <span className="truncate text-sm text-zinc-300">{user.username}</span>
    {(user.statusEmoji || user.statusText) && (
      <div className="truncate text-xs text-zinc-500">
        {user.statusEmoji && <span>{user.statusEmoji} </span>}
        {user.statusText}
      </div>
    )}
  </div>
</div>
```

### 4. Status Display in Message Headers

**File: `src/components/MessageItem.tsx`**

For non-grouped messages, show the user's status emoji (if set) next to their username in the message header. This requires that the message's user object includes `statusEmoji`.

First, update the `MessageItemProps` interface to include optional status fields on the user:
```typescript
user: {
  _id: Id<"users">;
  username: string;
  avatarColor: string;
  statusEmoji?: string;
  statusText?: string;
};
```

Then in the non-grouped message header, after the username span:
```tsx
<div className="flex items-baseline gap-2">
  <span className="text-sm font-bold text-zinc-100">{message.user.username}</span>
  {message.user.statusEmoji && (
    <span className="text-sm" title={message.user.statusText || undefined}>
      {message.user.statusEmoji}
    </span>
  )}
  <span className="text-xs text-zinc-500">{formatTimestamp(message._creationTime)}</span>
</div>
```

**File: `convex/messages.ts`** — Update `getMessages` and `getThreadMessages` to include `statusEmoji` and `statusText` in the user object they return. Find the places where `user` fields are mapped and add the new fields.

### 5. Status Picker UI Component

**File: `src/components/StatusPicker.tsx`** (new file)

Create a popover component that lets users set their status:

```tsx
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
    <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl">
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
```

### 6. Integrate Status Picker into Channel Sidebar

**File: `src/components/ChannelSidebar.tsx`**

Add a status area at the bottom of the sidebar showing the current user's status. Clicking it opens the `StatusPicker` popover.

At the bottom of the sidebar (above or as part of the user's identity area), add:

```tsx
{user && (
  <div className="relative border-t border-zinc-800 px-3 py-2">
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800"
      onClick={() => setShowStatusPicker(v => !v)}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: user.avatarColor }}
      >
        {user.username[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-200">{user.username}</div>
        <div className="truncate text-xs text-zinc-500">
          {user.statusEmoji || user.statusText
            ? `${user.statusEmoji || ""} ${user.statusText || ""}`.trim()
            : "Set a status"}
        </div>
      </div>
    </button>
    {showStatusPicker && (
      <StatusPicker
        userId={user._id}
        currentEmoji={user.statusEmoji}
        currentText={user.statusText}
        onClose={() => setShowStatusPicker(false)}
      />
    )}
  </div>
)}
```

This requires updating the `UserContext` to expose the status fields. Update the `UserContextType` interface and the `user` object in `UserContext.tsx`:

**File: `src/components/UserContext.tsx`**

Update the `UserContextType` interface:
```typescript
user: {
  _id: Id<"users">;
  username: string;
  avatarColor: string;
  statusEmoji?: string;
  statusText?: string;
} | null;
```

And the `user` construction:
```typescript
const user = currentUser
  ? {
      _id: currentUser._id,
      username: currentUser.username,
      avatarColor: currentUser.avatarColor,
      statusEmoji: currentUser.statusEmoji,
      statusText: currentUser.statusText,
    }
  : null;
```

### 7. Run codegen and type-check

After all changes:
```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any type errors.

---

## Files Modified

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `statusEmoji` and `statusText` fields to users table |
| `convex/users.ts` | Add `setStatus` and `clearStatus` mutations, update `getOnlineUsers` return |
| `convex/messages.ts` | Add `/status` command handler, include status in user fields for getMessages/getThreadMessages |
| `src/components/SlashCommandHint.tsx` | Add `/status` command hint |
| `src/components/OnlineUsers.tsx` | Show status below username |
| `src/components/MessageItem.tsx` | Show status emoji in message header, update user type |
| `src/components/StatusPicker.tsx` | New component — status picker popover |
| `src/components/ChannelSidebar.tsx` | Add user status area at bottom with status picker trigger |
| `src/components/UserContext.tsx` | Include status fields in user context |

## Testing

1. Set a status via the sidebar picker — verify it appears in online users panel and message headers
2. Use `/status 🍕 grabbing lunch` in chat — verify status is set and action message appears
3. Use `/status` with no args — verify status is cleared
4. Verify presets work in the picker
5. Verify clear button works
6. Test on mobile — ensure the status picker is usable on small screens
7. Verify type-checking passes with `pnpm -s tsc -p tsconfig.json --noEmit`

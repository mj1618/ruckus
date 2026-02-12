# Task: Emoji Reactions on Messages

## Overview

Add emoji reactions to messages — one of the most impactful Phase 3 features. Users can click a reaction button on any message to add an emoji reaction. Reactions appear below the message text with counts, and hovering shows who reacted. Multiple users can react with the same emoji, and each user can add multiple different emoji reactions.

**Demo moment:** Someone sends a message, others react with different emojis — the reaction counts update in real time across all connected clients.

**Depends on:** Tasks 001-004 (all complete — schema, backend, chat UI, unread badges)

## Current State

- Messages render via `MessageItem.tsx` with avatar, username, timestamp, and plain text
- `MessageList.tsx` renders messages in a scrollable list
- No reactions infrastructure exists in schema or backend
- Messages have a hover state (`hover:bg-zinc-800/30`) where we can show a reaction button
- The `getMessages` query returns messages with user info attached

## Requirements

### 1. Add `reactions` Table to Schema (`convex/schema.ts`)

Add a new table to track reactions:

```typescript
// Add this table to the existing schema (keep all existing tables unchanged):
reactions: defineTable({
  messageId: v.id("messages"),
  userId: v.id("users"),
  emoji: v.string(), // the emoji character, e.g. "🔥", "👍", "😂"
})
  .index("by_messageId", ["messageId"])
  .index("by_messageId_emoji", ["messageId", "emoji"]),
```

This goes inside the `defineSchema({...})` call alongside the existing tables. Do NOT modify any existing table definitions.

### 2. Create Reactions Backend (`convex/reactions.ts`)

Create a new file with these functions:

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// mutation: toggleReaction
// - Args: { messageId: Id<"messages">, userId: Id<"users">, emoji: string }
// - Check if this user already reacted with this emoji on this message
//   - Query reactions with index "by_messageId_emoji" using .eq("messageId", messageId).eq("emoji", emoji)
//   - Then filter for userId match
// - If reaction exists: DELETE it (toggle off)
// - If not: INSERT new reaction { messageId, userId, emoji }
// - Validate emoji is non-empty and <= 10 chars (to allow multi-codepoint emoji)

// query: getReactionsForMessages
// - Args: { messageIds: v.array(v.id("messages")) }
// - For each messageId, fetch all reactions using index "by_messageId"
// - Group by messageId, then by emoji
// - Return shape: Record<messageId, Array<{ emoji: string, count: number, userIds: Id<"users">[], usernames: string[] }>>
// - Fetch user info for reactors (username only needed for hover tooltip)
// - Use Promise.all for parallel fetches across messageIds
// - Implementation:
//   1. Use Promise.all to fetch reactions for all messageIds in parallel
//   2. For each message's reactions, group by emoji
//   3. For each emoji group, collect count, userIds, and usernames
//   4. Fetch all unique user IDs once and build a map for username lookup
```

### 3. Integrate Reactions into Message Fetching

Modify `convex/messages.ts` — update the `getMessages` query to also return reactions inline with each message. This is more efficient than a separate query since it avoids the frontend needing a second subscription.

In `getMessages`, after building the messages array, fetch reactions for all message IDs in a single batch:

```typescript
// After building the messages array with user info:
// 1. Collect all message IDs
const messageIds = messages.map((m) => m._id);

// 2. Fetch all reactions for these messages in parallel
const allReactions = await Promise.all(
  messageIds.map((id) =>
    ctx.db
      .query("reactions")
      .withIndex("by_messageId", (q) => q.eq("messageId", id))
      .collect()
  )
);

// 3. Fetch unique reactor user info
const reactorUserIds = [...new Set(allReactions.flat().map((r) => r.userId))];
const reactorUsers = await Promise.all(
  reactorUserIds.map((id) => ctx.db.get("users", id))
);
const reactorMap = new Map(
  reactorUsers.filter((u) => u !== null).map((u) => [u._id, u.username])
);

// 4. Group reactions by emoji for each message
// For each message, build: Array<{ emoji, count, users: Array<{ _id, username }>, currentUserReacted: boolean }>
// Note: currentUserReacted can't be computed server-side (no auth context), so the frontend will determine it

// 5. Add reactions to each message in the return value
return messages.map((m, i) => {
  const msgReactions = allReactions[i];
  // Group by emoji
  const emojiMap = new Map<string, { userIds: string[]; usernames: string[] }>();
  for (const r of msgReactions) {
    const existing = emojiMap.get(r.emoji);
    const username = reactorMap.get(r.userId) ?? "Unknown";
    if (existing) {
      existing.userIds.push(r.userId);
      existing.usernames.push(username);
    } else {
      emojiMap.set(r.emoji, { userIds: [r.userId], usernames: [username] });
    }
  }
  const reactions = Array.from(emojiMap.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.userIds.length,
    userIds: data.userIds,
    usernames: data.usernames,
  }));

  return {
    ...m,  // spread existing message fields (_id, text, _creationTime, user)
    reactions,
  };
});
```

### 4. Create Emoji Picker Component (`src/components/EmojiPicker.tsx`)

A simple emoji picker that shows a grid of commonly-used emojis:

```typescript
"use client";

// A compact, fast emoji picker — NOT a full emoji database, just the most popular ones
// arranged in a small grid popup.

// EMOJI_LIST: a curated list of ~40 popular reaction emojis, organized by rough category:
// Smileys: 😀 😂 🥹 😍 🤩 🥲 😅 😭 🤔 😬 🙄 😤
// Gestures: 👍 👎 👏 🙌 🤝 ✌️ 🤞 💪
// Hearts: ❤️ 🧡 💛 💚 💙 💜 🖤
// Objects: 🔥 ⭐ 💯 🎉 🚀 💡 👀 🫡
// Misc: ✅ ❌ ➕ 🏆 💎

// Props: { onSelect: (emoji: string) => void, onClose: () => void }
// UI:
// - Absolutely positioned popup (appears above the reaction button)
// - 8 columns grid of emoji buttons
// - Each emoji is a button that calls onSelect(emoji) and closes the picker
// - Click outside or press Escape to close
// - Dark background: bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl
// - Each emoji button: p-1.5 text-lg hover:bg-zinc-700 rounded cursor-pointer
// - Size: compact, roughly 280px wide
```

### 5. Add Reaction Button to MessageItem (`src/components/MessageItem.tsx`)

Modify `MessageItem` to show:
1. A reaction button that appears on hover
2. Existing reactions displayed below the message text

```typescript
// Update the MessageItemProps interface to include reactions:
interface MessageItemProps {
  message: {
    _id: Id<"messages">;
    text: string;
    _creationTime: number;
    user: {
      _id: Id<"users">;
      username: string;
      avatarColor: string;
    };
    reactions: Array<{
      emoji: string;
      count: number;
      userIds: string[];
      usernames: string[];
    }>;
  };
  isGrouped: boolean;
  currentUserId: Id<"users"> | undefined;
}

// Hover action bar:
// - When hovering a message, show a small floating toolbar at the top-right of the message
// - Contains a smiley face icon button (😀 or a smiley SVG icon)
// - Clicking it opens the EmojiPicker positioned near the button
// - Use opacity-0 group-hover:opacity-100 transition-opacity for smooth show/hide
// - Position: absolute, top-0 right-2, -translate-y-1/2 (floats above message)
// - Styling: bg-zinc-800 border border-zinc-700 rounded-md shadow-lg px-1 py-0.5

// Reaction display (below message text):
// - If message has reactions, show them in a flex-wrap row below the text
// - Each reaction is a pill/chip:
//   - Format: "emoji count" e.g. "🔥 3"
//   - Styling: inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
//   - Default state: bg-zinc-800 border border-zinc-700 text-zinc-300
//   - If current user has reacted with this emoji: bg-indigo-500/20 border-indigo-500/50 text-indigo-300
//   - Hover: hover:bg-zinc-700 cursor-pointer
//   - Clicking a reaction chip toggles it (same as selecting from picker)
//   - Tooltip on hover showing usernames: "alice, bob, carol" (use title attribute for simplicity)
// - At the end of the reaction row, show a small "+" button to add more reactions
//   - Same styling as reaction chip but with just a "+" icon
//   - Clicking opens the EmojiPicker

// Important: The reaction toggle should call the toggleReaction mutation
```

### 6. Wire Up MessageList to Pass Current User

Modify `src/components/MessageList.tsx` to pass `currentUserId` to each `MessageItem`:

```typescript
// In the message rendering loop:
<MessageItem
  key={message._id}
  message={message}
  isGrouped={isGrouped}
  currentUserId={user?._id}
/>
```

### 7. Run Codegen and Type Check

After all changes:

```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any TypeScript errors.

## Files to Create

- `convex/reactions.ts` — New file with `toggleReaction` mutation
- `src/components/EmojiPicker.tsx` — New emoji picker component

## Files to Modify

- `convex/schema.ts` — Add `reactions` table (do NOT change existing tables)
- `convex/messages.ts` — Update `getMessages` to include reactions per message
- `src/components/MessageItem.tsx` — Add hover reaction button, reaction display, emoji picker integration
- `src/components/MessageList.tsx` — Pass `currentUserId` prop to `MessageItem`

## Important Notes

- Remember `db.get`, `db.patch`, and `db.delete` take two arguments: table name and document ID (per CLAUDE.md)
- Use `Promise.all` for parallel operations (per CLAUDE.md)
- Use `@/` import paths for long relative imports (per CLAUDE.md)
- Don't modify `convex/_generated/` — run codegen instead
- The EmojiPicker should be simple and fast — do NOT install a third-party emoji picker library. A curated list of ~40 popular emojis is sufficient.
- Reactions use Convex's real-time reactivity: when someone reacts, the `getMessages` query automatically re-runs for all subscribers, updating every client's UI instantly
- The hover reaction toolbar should use `position: relative` on the message container and `position: absolute` on the toolbar to avoid layout shifts
- Be careful with z-index for the emoji picker popup — it needs to float above other messages
- The `currentUserReacted` check happens on the frontend by checking if the current user's ID is in the reaction's `userIds` array
- Keep emoji strings as native Unicode characters (not shortcodes) — they render everywhere

## Validation Checklist

- [ ] `reactions` table added to schema
- [ ] `pnpm -s convex codegen` succeeds
- [ ] Hovering a message shows the reaction button
- [ ] Clicking the reaction button opens the emoji picker
- [ ] Selecting an emoji adds a reaction (visible immediately)
- [ ] Clicking the same emoji reaction again removes it (toggle)
- [ ] Reaction counts update correctly
- [ ] Current user's reactions are highlighted differently
- [ ] Hovering a reaction chip shows usernames who reacted
- [ ] Reactions appear in real-time for other users
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- [ ] Test in browser: full flow of adding, toggling, and viewing reactions works
- [ ] Reactions work on both grouped and non-grouped messages

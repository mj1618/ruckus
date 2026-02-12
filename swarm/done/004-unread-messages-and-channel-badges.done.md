# Task: Unread Message Counts & Channel Badges

## Overview

Add unread message tracking so users can see which channels have new activity. This is a critical Phase 2 feature — without it, users have no way to know where new messages have appeared. The sidebar should show bold channel names and unread count badges for channels with unread messages.

**Design approach:** Track the last time each user viewed each channel. Compare that timestamp against message `_creationTime` to compute unread counts. This is efficient and works naturally with Convex's real-time subscriptions.

**Depends on:** Tasks 001-003 (all complete — schema, backend, and chat UI exist)

## Current State

- Channels display in the sidebar as plain `# channel-name` text (see `src/components/ChannelSidebar.tsx`)
- No unread tracking exists in the schema or backend
- `ChatLayout.tsx` tracks `activeChannelId` state but doesn't record when a user views a channel
- Messages are fetched with `getMessages` query which returns the last 100 messages per channel

## Requirements

### 1. Add `channelReads` Table to Schema (`convex/schema.ts`)

Add a new table to track when each user last read each channel:

```typescript
// Add this table to the existing schema (keep all existing tables unchanged):
channelReads: defineTable({
  userId: v.id("users"),
  channelId: v.id("channels"),
  lastReadTime: v.number(), // timestamp of when user last viewed this channel
})
  .index("by_user_channel", ["userId", "channelId"])
  .index("by_user", ["userId"]),
```

This goes inside the `defineSchema({...})` call alongside the existing `users`, `channels`, `messages`, and `typingIndicators` tables. Do NOT modify any existing table definitions.

### 2. Create Read Tracking Backend (`convex/channelReads.ts`)

Create a new file with these functions:

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// mutation: markChannelRead
// - Args: { userId: Id<"users">, channelId: Id<"channels"> }
// - Upsert: find existing channelReads doc for this user+channel
//   - Query channelReads with index "by_user_channel" using .eq("userId", userId).eq("channelId", channelId)
//   - If exists: patch it with lastReadTime = Date.now()
//   - If not: insert new doc with { userId, channelId, lastReadTime: Date.now() }

// query: getUnreadCounts
// - Args: { userId: Id<"users"> }
// - Returns: Array of { channelId: Id<"channels">, unreadCount: number }
// - Implementation:
//   1. Fetch all channels (ctx.db.query("channels").collect())
//   2. Fetch all channelReads for this user (use index "by_user" with .eq("userId", userId), then .collect())
//   3. Build a Map from channelId -> lastReadTime from the channelReads
//   4. For each channel, count messages where _creationTime > lastReadTime
//      - Use the "by_channelId" index on messages: query messages with .eq("channelId", channelId)
//      - Then filter with .filter(q => q.gt(q.field("_creationTime"), lastReadTime))
//      - Use .collect() and get the .length (Convex doesn't have a count() for filtered queries)
//      - If no lastReadTime exists for a channel (user never opened it), count ALL messages
//      - BUT: if the user has never opened a channel, cap the unread count display at 99
//        (still return the real count, the frontend will handle display capping)
//   5. Only return entries where unreadCount > 0 (skip channels with 0 unread)
//   6. Use Promise.all to fetch message counts for all channels in parallel
```

**Important performance note:** The `getMessages` query already fetches the last 100 messages per channel. The `getUnreadCounts` query needs to count messages across ALL channels, so it should be efficient. Since Convex indexes include `_creationTime` implicitly after explicit fields, we can use range queries on `_creationTime` after filtering by `channelId`. The query approach:

```typescript
// For each channel, to count unreads efficiently:
const msgs = await ctx.db
  .query("messages")
  .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
  .filter((q) => q.gt(q.field("_creationTime"), lastReadTime))
  .collect();
const unreadCount = msgs.length;
```

### 3. Call `markChannelRead` When User Views a Channel

Modify `src/components/ChatLayout.tsx`:

- Import and use the `markChannelRead` mutation
- Get the current user from `useUser()` context
- When `activeChannelId` changes (and is not null), call `markChannelRead({ userId: user._id, channelId: activeChannelId })`
- Use a `useEffect` that depends on `activeChannelId` and `user._id`
- Also call it on initial load once the default channel (#general) is set
- Debounce is not needed here since channel switches are infrequent

The relevant code change in `ChatLayout.tsx`:

```typescript
// Add these imports:
import { useMutation } from "convex/react";
import { useUser } from "@/components/UserContext";

// Inside the ChatLayout component:
const { user } = useUser();
const markRead = useMutation(api.channelReads.markChannelRead);

// Add this useEffect (after the existing useEffect that sets default channel):
useEffect(() => {
  if (activeChannelId && user) {
    markRead({ userId: user._id, channelId: activeChannelId });
  }
}, [activeChannelId, user]);
```

### 4. Also Mark as Read When New Messages Arrive in Active Channel

To prevent the active channel from showing unread badges for messages the user is currently watching, also call `markChannelRead` when new messages arrive in the currently-viewed channel.

Modify `src/components/MessageList.tsx`:

- Import `useMutation` and `useUser`
- Get markChannelRead mutation
- In the existing auto-scroll logic (which already detects new messages via `messages?.length`), also call `markChannelRead` when messages arrive and the user is at the bottom of the scroll
- This ensures that messages received while actively viewing a channel are marked as read

```typescript
// In MessageList, add:
const { user } = useUser();
const markRead = useMutation(api.channelReads.markChannelRead);

// In the existing useEffect that handles auto-scroll when messages change:
// After scrolling to bottom, also mark as read:
useEffect(() => {
  if (messages && messages.length > 0 && user) {
    // Only mark read if user is near the bottom (same check as auto-scroll)
    const container = scrollContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        markRead({ userId: user._id, channelId });
      }
    }
  }
}, [messages?.length]);
```

### 5. Display Unread Badges in Channel Sidebar

Modify `src/components/ChannelSidebar.tsx`:

- Add a `useQuery` call to `channelReads.getUnreadCounts` with the current user's ID
- Build a Map from channelId -> unreadCount for quick lookup
- For each channel in the list:
  - If unreadCount > 0: show the channel name in **bold white text** (font-semibold text-zinc-100) instead of the default zinc-400
  - Show a badge with the unread count on the right side of the channel button
  - Badge styling: `bg-indigo-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center`
  - If count > 99, display "99+"
  - Active channel should NOT show unread badge (it's currently being viewed)

The channel button should change from:

```tsx
<button className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${
  channel._id === activeChannelId
    ? "bg-zinc-700/50 text-white"
    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
}`}>
  # {channel.name}
</button>
```

To something like:

```tsx
<button className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors flex items-center justify-between ${
  channel._id === activeChannelId
    ? "bg-zinc-700/50 text-white"
    : unreadCount > 0
      ? "text-zinc-100 font-semibold hover:bg-zinc-800"
      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
}`}>
  <span># {channel.name}</span>
  {unreadCount > 0 && channel._id !== activeChannelId && (
    <span className="bg-indigo-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  )}
</button>
```

### 6. Run Codegen and Type Check

After all changes:

```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any TypeScript errors.

## Files to Create

- `convex/channelReads.ts` — New file with `markChannelRead` mutation and `getUnreadCounts` query

## Files to Modify

- `convex/schema.ts` — Add `channelReads` table (do NOT change existing tables)
- `src/components/ChatLayout.tsx` — Call `markChannelRead` on channel switch
- `src/components/MessageList.tsx` — Call `markChannelRead` when new messages arrive at bottom
- `src/components/ChannelSidebar.tsx` — Display unread counts and bold channel names

## Important Notes

- Remember `db.get`, `db.patch`, and `db.delete` take two arguments: table name and document ID (per CLAUDE.md)
- Use `Promise.all` for parallel operations (per CLAUDE.md)
- Use `@/` import paths for long relative imports (per CLAUDE.md)
- Don't modify `convex/_generated/` — run codegen instead
- The `channelReads` upsert in `markChannelRead` must query first then decide to insert or patch — Convex doesn't have a native upsert
- The `getUnreadCounts` query will re-run automatically via Convex reactivity whenever messages are added or channelReads are updated, keeping badges live

## Validation Checklist

- [ ] `channelReads` table added to schema
- [ ] `pnpm -s convex codegen` succeeds
- [ ] `markChannelRead` mutation works (upserts correctly)
- [ ] `getUnreadCounts` query returns correct counts
- [ ] Switching to a channel marks it as read (badge disappears)
- [ ] Sending a message in another channel causes a badge to appear in the sidebar
- [ ] Active channel doesn't show an unread badge
- [ ] Channels with unread messages show bold text
- [ ] Badge displays "99+" for counts over 99
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- [ ] Test in browser: open two tabs, send message in one, see badge in the other

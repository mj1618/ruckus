# Task: Threaded Replies

## Overview

Add threaded replies so users can reply to a specific message and continue the conversation in a side panel. This is the core Phase 4 feature — it transforms flat chat into organized conversations. A "Reply in thread" button appears on message hover, clicking it opens a thread panel on the right side (replacing the online users panel), and thread replies appear in their own scrollable message list with their own input.

Parent messages in the main channel show a "N replies" indicator with an avatar stack of thread participants, clickable to open the thread.

**Demo moment:** Reply to someone's message in a thread, watch the "2 replies" indicator appear on the parent message for everyone. Open the thread panel and see the full conversation context.

**Depends on:** Tasks 001-007 (all complete — schema, backend, chat UI, unread badges, emoji reactions, edit/delete, @mentions)

## Current State

- Messages render in `MessageList.tsx` → `MessageItem.tsx` with avatar, username, timestamp, text, reactions, edit/delete
- Messages have a hover toolbar with emoji reaction, edit, and delete buttons
- `ChatLayout.tsx` has a three-panel layout: sidebar (channels) | main chat | online users
- `MessageInput.tsx` handles sending messages with mention autocomplete
- The `messages` table has: `channelId`, `userId`, `text`, `editedAt` (optional)
- All messages are flat — no parent/child relationship exists yet
- The online users panel is 224px wide (`w-56`) on the right side
- On mobile, panels toggle between sidebar/chat/users views

## Requirements

### 1. Add `threadParentId` Field to Messages Schema (`convex/schema.ts`)

Add an optional `threadParentId` field to the `messages` table so thread replies reference their parent:

```typescript
messages: defineTable({
  channelId: v.id("channels"),
  userId: v.id("users"),
  text: v.string(),
  editedAt: v.optional(v.number()),
  threadParentId: v.optional(v.id("messages")), // if set, this message is a thread reply
}).index("by_channelId", ["channelId"])
  .index("by_threadParentId", ["threadParentId"]),
```

Key points:
- `threadParentId` is optional — top-level messages don't have it
- Add a new index `by_threadParentId` so we can efficiently query all replies to a parent message
- Thread replies still have a `channelId` (same channel as the parent) so they don't break existing channel queries
- **Do NOT remove** the existing `by_channelId` index

### 2. Add Thread Backend Functions (`convex/messages.ts`)

Add these new functions to `convex/messages.ts`:

#### 2a. `sendThreadReply` mutation

```typescript
// mutation: sendThreadReply
// Args: { threadParentId: Id<"messages">, userId: Id<"users">, text: string }
// - Fetch the parent message to get its channelId
// - Verify parent exists and is NOT itself a thread reply (no nested threads - parent.threadParentId must be undefined)
// - Validate text: trim, non-empty, max 4000 chars (same rules as sendMessage)
// - Insert new message with channelId (from parent), userId, text, and threadParentId set
// - Clear any typing indicator for this user in the parent's channel
```

#### 2b. `getThreadMessages` query

```typescript
// query: getThreadMessages
// Args: { threadParentId: Id<"messages"> }
// - Fetch the parent message itself (for display at top of thread panel)
// - Fetch all messages with this threadParentId using the by_threadParentId index, ordered ascending (oldest first)
// - Take up to 100 replies
// - Enrich with user info and reactions (same pattern as getMessages)
// - Return: { parent: enrichedParentMessage, replies: enrichedReplyMessages[] }
```

#### 2c. `getThreadSummaries` query

```typescript
// query: getThreadSummaries
// Args: { messageIds: v.array(v.id("messages")) }
// - For each messageId, query messages with by_threadParentId index to get reply count and unique replier user IDs
// - For performance: only fetch the first 3 unique user IDs for avatar display
// - Return: Map<messageId, { replyCount: number, participants: Array<{ _id, username, avatarColor }>, latestReplyTime: number }>
// - Only return entries where replyCount > 0
// - Use Promise.all for parallel queries across all messageIds
```

#### 2d. Update `getMessages` to exclude thread replies

Update the existing `getMessages` query to filter OUT thread replies from the main channel view. Thread replies should only appear in the thread panel, not in the main message list:

```typescript
// In getMessages handler, after fetching messages, filter:
// Only include messages where threadParentId is undefined (top-level messages)
// This is done AFTER the .take(100) so we may get fewer than 100 visible messages,
// but for simplicity this is acceptable
```

**Important:** Since we can't filter by `threadParentId` in the index query (it's not part of `by_channelId`), do a post-fetch filter. This means we query more than needed but filter down. For a chat app with moderate traffic this is fine.

### 3. Add "Reply in thread" Button to MessageItem Hover Toolbar (`src/components/MessageItem.tsx`)

Add a reply button to the hover toolbar in `MessageItem`. This button should appear for ALL messages (not just own messages, unlike edit/delete). Add it between the emoji button and the edit button:

```tsx
{/* Reply in thread button */}
<button
  type="button"
  className="px-1.5 py-0.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
  onClick={() => onReplyInThread?.(message._id)}
  title="Reply in thread"
>
  💬
</button>
```

Update `MessageItemProps` to accept an optional callback:

```typescript
interface MessageItemProps {
  // ... existing props
  onReplyInThread?: (messageId: Id<"messages">) => void;
}
```

**Important:** Only show the reply-in-thread button on top-level messages (messages without `threadParentId`). Thread replies displayed inside the thread panel should NOT have a "Reply in thread" button — they're already in a thread.

Add `threadParentId` to the message interface:
```typescript
message: {
  // ... existing fields
  threadParentId?: Id<"messages">; // ADD THIS
}
```

### 4. Add Thread Reply Indicator Below Messages (`src/components/MessageItem.tsx`)

When a message has thread replies, show a clickable indicator below the message (above the reaction bar):

```tsx
// Thread reply indicator - shown when message has thread replies
{threadSummary && threadSummary.replyCount > 0 && (
  <button
    type="button"
    className="mt-1 flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
    onClick={() => onReplyInThread?.(message._id)}
  >
    {/* Avatar stack - show up to 3 participant avatars */}
    <div className="flex -space-x-1.5">
      {threadSummary.participants.slice(0, 3).map((p) => (
        <div
          key={p._id}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-900 text-[10px] font-bold text-white"
          style={{ backgroundColor: p.avatarColor }}
        >
          {p.username[0].toUpperCase()}
        </div>
      ))}
    </div>
    <span>
      {threadSummary.replyCount} {threadSummary.replyCount === 1 ? "reply" : "replies"}
    </span>
  </button>
)}
```

Add `threadSummary` to `MessageItemProps`:
```typescript
interface MessageItemProps {
  // ... existing props
  threadSummary?: {
    replyCount: number;
    participants: Array<{ _id: string; username: string; avatarColor: string }>;
    latestReplyTime: number;
  };
  onReplyInThread?: (messageId: Id<"messages">) => void;
}
```

### 5. Create ThreadPanel Component (`src/components/ThreadPanel.tsx`)

Create a new component that displays the thread conversation in a side panel:

```typescript
"use client";

interface ThreadPanelProps {
  threadParentId: Id<"messages">;
  onClose: () => void;
}
```

The ThreadPanel component should:

- **Header:** Shows "Thread" title with an X close button. Dark background matching the app theme.
- **Parent message:** Renders the parent message at the top (non-interactive — no hover toolbar, just the message content with avatar/username/timestamp/text). Separated from replies by a subtle divider.
- **Reply list:** Scrollable list of thread replies below the parent, using the same `MessageItem` component (but with `onReplyInThread` NOT passed, so no nested thread button). Auto-scrolls to bottom on new replies.
- **Reply input:** A `MessageInput`-like textarea at the bottom for sending thread replies. Should support @mentions. Can reuse or adapt `MessageInput` by adding an optional `threadParentId` prop.
- **Typing indicator:** Show typing indicators (reuse existing `TypingIndicator` if feasible, or skip for simplicity).

The panel layout:
```
┌─────────────────────────┐
│ Thread              [X] │ ← header
├─────────────────────────┤
│ [Parent message]        │ ← the original message
│─────────────────────────│ ← divider
│                         │
│ [Reply 1]               │
│ [Reply 2]               │ ← scrollable reply list
│ [Reply 3]               │
│                         │
├─────────────────────────┤
│ [Reply input]           │ ← textarea for new replies
└─────────────────────────┘
```

Width: same as the online users panel (`w-56` on desktop, or slightly wider at `w-72` / `w-80` for better readability). On mobile, it should take the full screen (replacing the chat view).

Use `useQuery(api.messages.getThreadMessages, { threadParentId })` to fetch thread data.

For sending replies, use the `sendThreadReply` mutation.

### 6. Update MessageList to Fetch Thread Summaries (`src/components/MessageList.tsx`)

Update `MessageList` to fetch thread summary data for all visible messages so it can pass `threadSummary` to each `MessageItem`:

```typescript
// After fetching messages, extract all message IDs
const messageIds = messages?.map((m) => m._id) ?? [];

// Fetch thread summaries for all visible messages
const threadSummaries = useQuery(
  api.messages.getThreadSummaries,
  messageIds.length > 0 ? { messageIds } : "skip"
);
```

Pass the relevant summary and the `onReplyInThread` callback to each `MessageItem`:

```tsx
<MessageItem
  key={message._id}
  message={message}
  isGrouped={isGrouped}
  currentUserId={user?._id}
  threadSummary={threadSummaries?.get(message._id)}
  onReplyInThread={onOpenThread}
/>
```

Add `onOpenThread` prop to `MessageList`:
```typescript
interface MessageListProps {
  channelId: Id<"channels">;
  onOpenThread: (messageId: Id<"messages">) => void;
}
```

**Important note on `getThreadSummaries` return type:** Convex queries can't return `Map` objects. Return an array of `{ messageId, replyCount, participants, latestReplyTime }` and convert to a Map on the client side, or just use the array and `.find()` for lookup.

### 7. Update ChatLayout to Manage Thread Panel State (`src/components/ChatLayout.tsx`)

Add thread panel state to `ChatLayout` and conditionally render the `ThreadPanel` instead of (or alongside) the `OnlineUsers` panel:

```typescript
const [activeThreadId, setActiveThreadId] = useState<Id<"messages"> | null>(null);

// Close thread when switching channels
useEffect(() => {
  setActiveThreadId(null);
}, [activeChannelId]);
```

In the layout JSX, conditionally show either the thread panel or the online users panel on the right side:

```tsx
{/* Right panel - Thread or Online Users */}
{activeThreadId ? (
  <ThreadPanel
    threadParentId={activeThreadId}
    onClose={() => setActiveThreadId(null)}
  />
) : (
  <OnlineUsers />
)}
```

Pass `setActiveThreadId` down through `MessageList` → `MessageItem`:

```tsx
<MessageList
  channelId={activeChannel._id}
  onOpenThread={(messageId) => setActiveThreadId(messageId)}
/>
```

On mobile, opening a thread should switch the view to show the thread panel (similar to how the users panel works).

### 8. Update MessageInput to Support Thread Replies (`src/components/MessageInput.tsx`)

Add an optional `threadParentId` prop to `MessageInput` so the thread panel can reuse it:

```typescript
interface MessageInputProps {
  channelId: Id<"channels">;
  channelName: string;
  threadParentId?: Id<"messages">; // if set, sends as thread reply
}
```

In `handleSend`, branch based on whether `threadParentId` is provided:

```typescript
if (threadParentId) {
  await sendThreadReply({ threadParentId, userId: user._id, text: trimmed });
} else {
  await sendMessage({ channelId, userId: user._id, text: trimmed });
}
```

Update the placeholder text when in thread mode:
```typescript
placeholder={threadParentId ? "Reply..." : `Message #${channelName}`}
```

Import `sendThreadReply` mutation:
```typescript
const sendThreadReply = useMutation(api.messages.sendThreadReply);
```

### 9. Run Codegen and Type Check

After all changes:

```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any TypeScript errors.

### 10. Test in Browser

- Open the app, send a message, hover to see "Reply in thread" button
- Click it, see the thread panel open on the right
- Type a reply and send it
- See "1 reply" indicator appear on the parent message in the main channel
- Send more replies, see the count update
- Click the reply indicator on the parent message to open the thread
- Close the thread panel with X, see the online users panel return
- Test on mobile: thread panel should be full-screen
- Verify that thread replies do NOT appear in the main channel message list
- Verify that you can still edit/delete your own messages within a thread
- Verify @mentions work in thread replies

## Files to Create

- `src/components/ThreadPanel.tsx` — Thread side panel with parent message, reply list, and reply input

## Files to Modify

- `convex/schema.ts` — Add optional `threadParentId` field and `by_threadParentId` index to messages table
- `convex/messages.ts` — Add `sendThreadReply` mutation, `getThreadMessages` query, `getThreadSummaries` query; update `getMessages` to filter out thread replies
- `src/components/MessageItem.tsx` — Add "Reply in thread" button, thread reply indicator, accept new props
- `src/components/MessageList.tsx` — Fetch thread summaries, pass to MessageItem, accept `onOpenThread` prop
- `src/components/MessageInput.tsx` — Accept optional `threadParentId`, use `sendThreadReply` when set
- `src/components/ChatLayout.tsx` — Manage `activeThreadId` state, conditionally render ThreadPanel vs OnlineUsers

## Important Notes

- Remember `db.get`, `db.patch`, and `db.delete` take two arguments: table name and document ID (per CLAUDE.md)
- Use `Promise.all` for parallel operations (per CLAUDE.md)
- Use `@/` import paths for long relative imports (per CLAUDE.md)
- Don't modify `convex/_generated/` — run codegen instead
- Thread replies have the same `channelId` as their parent for consistency
- No nested threads — `threadParentId` must reference a top-level message (one that doesn't have its own `threadParentId`)
- The `getMessages` query needs post-fetch filtering since we can't add `threadParentId` to the existing `by_channelId` index without breaking existing behavior
- Thread summaries use a separate query to avoid N+1 issues — fetch all summaries for visible messages in one batch
- The thread panel replaces the online users panel on desktop to avoid making the layout too wide
- On mobile, the thread panel should behave like a full-screen overlay
- Convex reactivity ensures thread replies and reply counts update in real time for all users
- The parent message in the thread panel should be rendered read-only (no hover toolbar) to keep focus on replies
- Thread replies appear chronologically (oldest first) just like main channel messages
- `getThreadSummaries` should be efficient — only fetch reply counts and first 3 unique participants
- When a message with thread replies is deleted, its replies become orphaned. For simplicity, don't cascade-delete thread replies — they just won't be visible anywhere (since the parent is gone and thread queries won't find them). This can be improved later.

## Validation Checklist

- [ ] `threadParentId` optional field and `by_threadParentId` index added to messages table
- [ ] `pnpm -s convex codegen` succeeds
- [ ] Thread replies do not appear in the main channel message list
- [ ] "Reply in thread" (💬) button appears in hover toolbar for all top-level messages
- [ ] "Reply in thread" button does NOT appear on thread reply messages inside the thread panel
- [ ] Clicking "Reply in thread" opens the thread panel on the right
- [ ] Thread panel shows the parent message at the top
- [ ] Thread panel shows all replies below the parent
- [ ] Sending a reply in the thread panel creates a new message with `threadParentId` set
- [ ] Reply count indicator ("N replies") appears on parent messages that have replies
- [ ] Reply count updates in real time when new replies are added
- [ ] Avatar stack shows up to 3 unique participants
- [ ] Clicking the reply count indicator opens the thread panel
- [ ] Closing the thread panel (X button) shows the online users panel again
- [ ] Thread panel closes when switching channels
- [ ] @mentions work in thread replies
- [ ] Edit/delete work on messages within a thread
- [ ] Sending a thread reply does NOT attempt to nest (no "Reply in thread" on replies)
- [ ] Thread panel auto-scrolls to newest reply
- [ ] Mobile: thread panel works as a full-screen view
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- [ ] Test in browser: full thread flow works end-to-end

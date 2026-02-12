# Task: Edit and Delete Your Own Messages

## Overview

Add the ability for users to edit and delete their own messages. This is a critical Phase 3 feature — being able to fix a typo or remove a message is expected in any modern chat app. An "edited" label appears on edited messages, and deleted messages are removed entirely.

**Demo moment:** Someone sends a message with a typo, edits it, everyone sees the "(edited)" label appear in real time. Someone deletes a message, it disappears for everyone.

**Depends on:** Tasks 001-005 (all complete — schema, backend, chat UI, unread badges, emoji reactions)

## Current State

- Messages render via `MessageItem.tsx` with avatar, username, timestamp, text, and emoji reactions
- Messages have a hover toolbar that currently only has the emoji reaction button (😀)
- The `messages` table schema has: `channelId`, `userId`, `text` (no `editedAt` field)
- The `sendMessage` mutation creates messages; `getMessages` query fetches them with user info and reactions
- The `MessageItem` component receives `currentUserId` so it can determine ownership
- Messages are plain text rendered with `whitespace-pre-wrap`

## Requirements

### 1. Add `editedAt` Field to Messages Schema (`convex/schema.ts`)

Update the `messages` table to support an optional `editedAt` timestamp:

```typescript
messages: defineTable({
  channelId: v.id("channels"),
  userId: v.id("users"),
  text: v.string(),
  editedAt: v.optional(v.number()), // timestamp when message was last edited
}).index("by_channelId", ["channelId"]),
```

Only add the `editedAt` field — do NOT change the index or any other tables.

### 2. Add Edit and Delete Mutations (`convex/messages.ts`)

Add two new mutations to the existing `convex/messages.ts` file:

```typescript
// mutation: editMessage
// - Args: { messageId: Id<"messages">, userId: Id<"users">, text: string }
// - Fetch the message with ctx.db.get("messages", messageId)
// - Verify the message exists and message.userId === userId (only own messages)
// - Validate text: trim, must be non-empty, max 4000 chars (same rules as sendMessage)
// - Patch: ctx.db.patch("messages", messageId, { text: trimmedText, editedAt: Date.now() })

// mutation: deleteMessage
// - Args: { messageId: Id<"messages">, userId: Id<"users"> }
// - Fetch the message with ctx.db.get("messages", messageId)
// - Verify the message exists and message.userId === userId (only own messages)
// - Delete all reactions for this message first:
//   - Query reactions with index "by_messageId" for this messageId, collect all
//   - Delete each reaction with ctx.db.delete("reactions", reaction._id)
//   - Use Promise.all for parallel deletes
// - Then delete the message: ctx.db.delete("messages", messageId)
```

### 3. Update `getMessages` Query to Include `editedAt`

In the `getMessages` query return value, include the `editedAt` field. In the `messages.map()` at the end of the handler, add `editedAt` to the returned object:

```typescript
return {
  _id: m._id,
  text: m.text,
  _creationTime: m._creationTime,
  editedAt: m.editedAt, // ADD THIS LINE
  user: userMap.get(m.userId) ?? {
    _id: m.userId,
    username: "Unknown",
    avatarColor: "#6b7280",
  },
  reactions,
};
```

### 4. Update MessageItem Interface and Props (`src/components/MessageItem.tsx`)

Update the `MessageItemProps` interface to include `editedAt`:

```typescript
interface MessageItemProps {
  message: {
    _id: Id<"messages">;
    text: string;
    _creationTime: number;
    editedAt?: number; // ADD THIS
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
```

### 5. Add Edit/Delete Buttons to Hover Toolbar (`src/components/MessageItem.tsx`)

Extend the existing hover toolbar (the `hoverToolbar` variable in `MessageItem`) to show edit and delete buttons when the message belongs to the current user. Currently it looks like:

```tsx
const hoverToolbar = (
  <div className="absolute -top-3 right-2 z-10 flex opacity-0 transition-opacity group-hover:opacity-100">
    <div className="relative">
      <button ...>😀</button>
      {showPicker && <EmojiPicker ... />}
    </div>
  </div>
);
```

Extend it to:

```tsx
const isOwnMessage = currentUserId === message.user._id;

const hoverToolbar = (
  <div className="absolute -top-3 right-2 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
    <div className="flex rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
      {/* Emoji reaction button */}
      <div className="relative">
        <button
          type="button"
          className="rounded-l-md px-1.5 py-0.5 text-sm hover:bg-zinc-700"
          onClick={() => setShowPicker((v) => !v)}
        >
          😀
        </button>
        {showPicker && (
          <EmojiPicker
            onSelect={handleSelectEmoji}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
      {/* Edit button - only for own messages */}
      {isOwnMessage && (
        <button
          type="button"
          className="px-1.5 py-0.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          onClick={() => setIsEditing(true)}
          title="Edit message"
        >
          ✏️
        </button>
      )}
      {/* Delete button - only for own messages */}
      {isOwnMessage && (
        <button
          type="button"
          className="rounded-r-md px-1.5 py-0.5 text-sm text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
          onClick={handleDelete}
          title="Delete message"
        >
          🗑️
        </button>
      )}
    </div>
  </div>
);
```

### 6. Add Editing State and Inline Edit UI (`src/components/MessageItem.tsx`)

Add editing state and an inline editor to `MessageItem`:

```typescript
// Add these state variables inside the MessageItem component:
const [isEditing, setIsEditing] = useState(false);
const [editText, setEditText] = useState(message.text);

// Add these mutations:
const editMessage = useMutation(api.messages.editMessage);
const deleteMessage = useMutation(api.messages.deleteMessage);

// Edit handler:
async function handleEditSave() {
  const trimmed = editText.trim();
  if (!trimmed || !currentUserId) return;
  await editMessage({ messageId: message._id, userId: currentUserId, text: trimmed });
  setIsEditing(false);
}

// Cancel handler:
function handleEditCancel() {
  setEditText(message.text);
  setIsEditing(false);
}

// Delete handler with confirmation:
function handleDelete() {
  if (!currentUserId) return;
  // Simple window.confirm is fine for now
  if (window.confirm("Delete this message? This cannot be undone.")) {
    deleteMessage({ messageId: message._id, userId: currentUserId });
  }
}

// Edit key handler:
function handleEditKeyDown(e: React.KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleEditSave();
  }
  if (e.key === "Escape") {
    handleEditCancel();
  }
}
```

Replace the message text rendering. Currently message text is rendered as:
```tsx
<p className="whitespace-pre-wrap text-sm text-zinc-300">{message.text}</p>
```

Change it to conditionally render either the edit form or the text with "(edited)" label:

```tsx
{isEditing ? (
  <div className="mt-1">
    <textarea
      value={editText}
      onChange={(e) => setEditText(e.target.value)}
      onKeyDown={handleEditKeyDown}
      className="w-full resize-none rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500"
      maxLength={4000}
      rows={1}
      autoFocus
      ref={(el) => {
        if (el) {
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 120) + "px";
        }
      }}
    />
    <div className="mt-1 flex gap-2 text-xs">
      <span className="text-zinc-500">
        escape to <button type="button" className="text-indigo-400 hover:underline" onClick={handleEditCancel}>cancel</button>
        {" · "}enter to <button type="button" className="text-indigo-400 hover:underline" onClick={handleEditSave}>save</button>
      </span>
    </div>
  </div>
) : (
  <p className="whitespace-pre-wrap text-sm text-zinc-300">
    {message.text}
    {message.editedAt && (
      <span className="ml-1 text-xs text-zinc-500">(edited)</span>
    )}
  </p>
)}
```

This pattern applies in BOTH the grouped and non-grouped message renderings. Extract the text/edit rendering into a local variable to avoid duplication:

```tsx
const messageContent = isEditing ? (
  // ... edit form above
) : (
  // ... text with (edited) label above
);
```

Then use `{messageContent}` in both the grouped and non-grouped return branches, replacing the existing `<p>` tag.

### 7. Hide Hover Toolbar While Editing

When `isEditing` is true, the hover toolbar should not be shown (it would be distracting and the edit/delete buttons are irrelevant). Wrap it:

```tsx
{!isEditing && hoverToolbar}
```

### 8. Run Codegen and Type Check

After all changes:

```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any TypeScript errors.

## Files to Modify

- `convex/schema.ts` — Add optional `editedAt` field to `messages` table
- `convex/messages.ts` — Add `editMessage` and `deleteMessage` mutations; update `getMessages` to include `editedAt`
- `src/components/MessageItem.tsx` — Add edit/delete buttons, inline edit UI, "(edited)" label, delete confirmation

## Important Notes

- Remember `db.get`, `db.patch`, and `db.delete` take two arguments: table name and document ID (per CLAUDE.md)
- Use `Promise.all` for parallel operations like bulk-deleting reactions (per CLAUDE.md)
- Use `@/` import paths for long relative imports (per CLAUDE.md)
- Don't modify `convex/_generated/` — run codegen instead
- The `editedAt` field is optional (`v.optional(v.number())`) so existing messages without it will work fine
- Both edit and delete check `message.userId === userId` server-side to prevent unauthorized modification
- The delete mutation must clean up reactions before deleting the message to avoid orphaned data
- When editing, the textarea should auto-focus and auto-resize just like the main message input
- The edit form should use Enter to save (matching the send behavior) and Escape to cancel
- Convex reactivity means edits and deletes propagate to all clients in real time automatically
- The "(edited)" label is inline with the text, not on a separate line — this matches Slack/Discord convention
- No need for a separate `editedAt` display format — the word "(edited)" is sufficient

## Validation Checklist

- [ ] `editedAt` optional field added to messages table in schema
- [ ] `pnpm -s convex codegen` succeeds
- [ ] `editMessage` mutation works: updates text and sets editedAt
- [ ] `editMessage` rejects editing other users' messages
- [ ] `deleteMessage` mutation works: removes message and its reactions
- [ ] `deleteMessage` rejects deleting other users' messages
- [ ] Hovering own message shows edit (✏️) and delete (🗑️) buttons
- [ ] Hovering other users' messages only shows emoji reaction button
- [ ] Clicking edit enters inline edit mode with existing text
- [ ] Enter saves the edit, Escape cancels
- [ ] Edited messages show "(edited)" label
- [ ] Deleting a message shows confirmation dialog
- [ ] Confirmed delete removes message for all users
- [ ] Reactions on a deleted message are also cleaned up
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- [ ] Test in browser: full edit and delete flow works
- [ ] Edit and delete work on both grouped and non-grouped messages

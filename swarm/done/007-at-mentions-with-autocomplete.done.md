# Task: @Mentions with Autocomplete

## Overview

Add @mention support so users can mention other users in messages. Typing `@` in the message input triggers an autocomplete dropdown showing matching usernames. Selecting a user inserts `@username` into the message. When rendered, @mentions are highlighted in a distinctive color so they stand out in the message text. This is a key Phase 4 feature that makes multi-user chat significantly more interactive.

**Demo moment:** Type `@` in the message box, see a dropdown of users appear, select one, and the mention renders highlighted for everyone.

**Depends on:** Tasks 001-005 (all complete — schema, backend, chat UI, unread badges, emoji reactions). Does NOT depend on task 006 (edit/delete).

## Current State

- `MessageInput.tsx` is a controlled textarea with text state, send on Enter, typing indicators
- `MessageItem.tsx` renders message text as plain text with `whitespace-pre-wrap` in a `<p>` tag
- `getOnlineUsers` query returns all online users with `_id`, `username`, `avatarColor`
- The online users query is already available via `api.users.getOnlineUsers`
- Messages are stored as plain text strings in the `messages` table
- No schema changes are needed — mentions are just `@username` text patterns stored inline in message text

## Requirements

### 1. Create MentionAutocomplete Component (`src/components/MentionAutocomplete.tsx`)

Create a new component that shows a dropdown list of matching users when the user types `@`:

```typescript
"use client";

import { Id } from "../../convex/_generated/dataModel";

interface MentionUser {
  _id: Id<"users">;
  username: string;
  avatarColor: string;
}

interface MentionAutocompleteProps {
  query: string; // The text after "@" that the user has typed so far (e.g., "jo" for "@jo")
  users: MentionUser[]; // All online users to filter from
  selectedIndex: number; // Currently highlighted item index (for keyboard nav)
  onSelect: (username: string) => void; // Called when a user is selected
  position: { bottom: number; left: number }; // Position relative to textarea
}

// UI:
// - Absolutely positioned dropdown that appears ABOVE the textarea (bottom positioning)
// - Max height 200px, scrollable if more items
// - Dark background: bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl
// - Each item: flex row with avatar circle + username
//   - Avatar: 24x24 circle with user's avatarColor and first letter of username
//   - Username: text-sm text-zinc-200
//   - Selected item: bg-zinc-700 (highlighted via selectedIndex)
//   - Hover: hover:bg-zinc-700
// - Each item is a button that calls onSelect(username) on click
// - Width: min-w-[200px] max-w-[280px]
// - If no matching users: show "No matching users" in text-zinc-500 text-sm italic, padded

// Filtering logic:
// - Filter users whose username starts with `query` (case-insensitive)
// - If query is empty string (user just typed "@"), show all users
// - Sort results alphabetically by username
// - Limit to 8 results max to keep the dropdown compact

export function MentionAutocomplete({ query, users, selectedIndex, onSelect, position }: MentionAutocompleteProps) {
  const filtered = users
    .filter((u) => u.username.toLowerCase().startsWith(query.toLowerCase()))
    .sort((a, b) => a.username.localeCompare(b.username))
    .slice(0, 8);

  if (filtered.length === 0) {
    return (
      <div
        className="absolute z-50 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-800 p-2 shadow-xl"
        style={{ bottom: position.bottom, left: position.left }}
      >
        <p className="text-sm italic text-zinc-500">No matching users</p>
      </div>
    );
  }

  return (
    <div
      className="absolute z-50 max-h-[200px] min-w-[200px] max-w-[280px] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
      style={{ bottom: position.bottom, left: position.left }}
    >
      {filtered.map((user, i) => (
        <button
          key={user._id}
          type="button"
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
            i === selectedIndex ? "bg-zinc-700" : "hover:bg-zinc-700"
          }`}
          onMouseDown={(e) => {
            // Use onMouseDown instead of onClick to fire before textarea onBlur
            e.preventDefault();
            onSelect(user.username);
          }}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: user.avatarColor }}
          >
            {user.username[0].toUpperCase()}
          </div>
          <span className="truncate text-sm text-zinc-200">{user.username}</span>
        </button>
      ))}
    </div>
  );
}
```

### 2. Update MessageInput to Support @Mention Autocomplete (`src/components/MessageInput.tsx`)

Add mention autocomplete logic to the existing `MessageInput` component:

```typescript
// Add imports:
import { useQuery } from "convex/react";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";

// Inside the MessageInput component, add:

// Fetch online users for mention autocomplete
const onlineUsers = useQuery(api.users.getOnlineUsers);

// Mention autocomplete state
const [mentionState, setMentionState] = useState<{
  active: boolean;
  query: string;
  startPos: number; // cursor position where "@" was typed
  selectedIndex: number;
} | null>(null);

// Detect "@" trigger in handleChange:
// After updating the text state and auto-resize, add mention detection logic:
function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
  const value = e.target.value;
  setText(value);

  // Auto-resize (existing code)
  const el = textareaRef.current;
  if (el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // Mention detection:
  const cursorPos = e.target.selectionStart;
  detectMention(value, cursorPos);

  // Typing indicator (existing code) ...
}

// Mention detection function:
function detectMention(text: string, cursorPos: number) {
  // Look backwards from cursor to find "@"
  // The "@" must be at position 0 or preceded by a space/newline
  const textBeforeCursor = text.slice(0, cursorPos);
  const atIndex = textBeforeCursor.lastIndexOf("@");

  if (atIndex === -1) {
    setMentionState(null);
    return;
  }

  // "@" must be at start or preceded by whitespace
  if (atIndex > 0 && !/\s/.test(text[atIndex - 1])) {
    setMentionState(null);
    return;
  }

  // Extract the query (text between "@" and cursor)
  const query = textBeforeCursor.slice(atIndex + 1);

  // Query must not contain spaces (mentions are single words)
  if (query.includes(" ") || query.includes("\n")) {
    setMentionState(null);
    return;
  }

  setMentionState({
    active: true,
    query,
    startPos: atIndex,
    selectedIndex: 0,
  });
}

// Handle mention selection:
function handleMentionSelect(username: string) {
  if (!mentionState) return;
  const before = text.slice(0, mentionState.startPos);
  const after = text.slice(mentionState.startPos + 1 + mentionState.query.length);
  const newText = before + "@" + username + " " + after;
  setText(newText);
  setMentionState(null);

  // Focus and set cursor position after the inserted mention
  const textarea = textareaRef.current;
  if (textarea) {
    textarea.focus();
    const newCursorPos = mentionState.startPos + username.length + 2; // +2 for "@" and " "
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }
}

// Update handleKeyDown to support keyboard navigation in the autocomplete:
function handleKeyDown(e: React.KeyboardEvent) {
  if (mentionState) {
    const filtered = (onlineUsers ?? [])
      .filter((u) => u.username.toLowerCase().startsWith(mentionState.query.toLowerCase()))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 8);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionState({
        ...mentionState,
        selectedIndex: Math.min(mentionState.selectedIndex + 1, filtered.length - 1),
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionState({
        ...mentionState,
        selectedIndex: Math.max(mentionState.selectedIndex - 1, 0),
      });
      return;
    }
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      handleMentionSelect(filtered[mentionState.selectedIndex].username);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMentionState(null);
      return;
    }
    // Tab also selects the current item
    if (e.key === "Tab" && filtered.length > 0) {
      e.preventDefault();
      handleMentionSelect(filtered[mentionState.selectedIndex].username);
      return;
    }
  }

  // Existing Enter-to-send logic:
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

// Clear mention state when sending:
// In handleSend, after setText(""), add:
setMentionState(null);
```

Update the JSX to render the autocomplete dropdown. The dropdown should appear above the input area. Wrap the existing input div in a `relative` container:

```tsx
<div className="relative">
  {mentionState && onlineUsers && (
    <MentionAutocomplete
      query={mentionState.query}
      users={onlineUsers}
      selectedIndex={mentionState.selectedIndex}
      onSelect={handleMentionSelect}
      position={{ bottom: 48, left: 0 }}
    />
  )}
  <div className="flex items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
    {/* existing textarea and buttons */}
  </div>
</div>
```

### 3. Create MessageText Component for Rendering Mentions (`src/components/MessageText.tsx`)

Create a component that renders message text with highlighted @mentions:

```typescript
"use client";

// Renders message text with @mentions highlighted.
// Parses the text for @username patterns and wraps them in styled spans.

interface MessageTextProps {
  text: string;
}

// The @mention pattern:
// - Starts with "@"
// - Preceded by start-of-string or whitespace
// - Followed by one or more non-whitespace characters (the username)
// - Username chars: alphanumeric, underscores, hyphens, spaces are NOT included in mentions
// Pattern: /(^|\s)(@[\w-]+)/g

export function MessageText({ text }: MessageTextProps) {
  // Split text into segments: plain text and @mentions
  // Use a regex to find all @mentions
  const mentionRegex = /(?:^|\s)(@[\w-]+)/g;
  const segments: Array<{ type: "text" | "mention"; content: string }> = [];
  let lastIndex = 0;

  // Use matchAll to find all mentions
  const matches = [...text.matchAll(mentionRegex)];

  for (const match of matches) {
    const fullMatch = match[0];
    const mention = match[1]; // The @username part
    const matchStart = match.index!;

    // The actual mention starts after any leading whitespace in the full match
    const leadingSpace = fullMatch.length - mention.length;
    const mentionStart = matchStart + leadingSpace;

    // Add any text before this mention
    if (mentionStart > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, mentionStart) });
    }

    segments.push({ type: "mention", content: mention });
    lastIndex = mentionStart + mention.length;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  // If no mentions found, render plain text
  if (segments.length === 0) {
    return <span>{text}</span>;
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "mention" ? (
          <span
            key={i}
            className="rounded bg-indigo-500/20 px-0.5 text-indigo-300"
          >
            {seg.content}
          </span>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </>
  );
}
```

### 4. Update MessageItem to Use MessageText (`src/components/MessageItem.tsx`)

Replace the plain text rendering with the `MessageText` component. In both the grouped and non-grouped message renderings, change:

```tsx
// FROM:
<p className="whitespace-pre-wrap text-sm text-zinc-300">{message.text}</p>

// TO:
<p className="whitespace-pre-wrap text-sm text-zinc-300">
  <MessageText text={message.text} />
</p>
```

Add the import at the top:
```typescript
import { MessageText } from "@/components/MessageText";
```

This applies to BOTH instances of the `<p>` tag (in grouped and non-grouped renders). If task 006 (edit/delete) has already been completed and the text rendering has been refactored into a `messageContent` variable, update that variable instead.

### 5. Run Codegen and Type Check

After all changes:

```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any TypeScript errors.

## Files to Create

- `src/components/MentionAutocomplete.tsx` — Autocomplete dropdown for @mentions
- `src/components/MessageText.tsx` — Text renderer that highlights @mentions

## Files to Modify

- `src/components/MessageInput.tsx` — Add mention detection, autocomplete state, keyboard navigation, mention insertion
- `src/components/MessageItem.tsx` — Replace plain text with `MessageText` component

## Important Notes

- No schema changes needed — mentions are just `@username` text stored in the message
- No backend changes needed — mention highlighting is purely a frontend rendering concern
- The `getOnlineUsers` query is already available and returns the data needed for autocomplete
- Use `@/` import paths for long relative imports (per CLAUDE.md)
- Don't modify `convex/_generated/` — run codegen instead
- The mention autocomplete uses `onMouseDown` instead of `onClick` on dropdown items to prevent the textarea from losing focus before the selection registers
- Keyboard navigation: ArrowUp/ArrowDown to navigate, Enter/Tab to select, Escape to dismiss
- When the mention autocomplete is open, Enter should select the highlighted user, NOT send the message
- The `@username` pattern in MessageText must handle edge cases: start of message, after whitespace, but NOT in the middle of a word (e.g., `email@example` should NOT be treated as a mention)
- Usernames in this app can contain alphanumeric chars, underscores, and hyphens (validated in JoinScreen.tsx)
- The autocomplete dropdown position is `bottom: 48px` to appear above the input area — this is approximate and should be adjusted if the input area height changes
- Convex reactivity: the `onlineUsers` query auto-updates, so if a new user joins while you're typing `@`, they'll appear in the dropdown
- The `MessageText` component should be lightweight — it's rendered for every message in the list
- The mention highlight style (indigo background) matches the reaction highlight style for visual consistency

## Validation Checklist

- [ ] Typing `@` in the message input shows the autocomplete dropdown
- [ ] Dropdown shows all online users when query is empty (just `@`)
- [ ] Typing after `@` filters users by prefix match
- [ ] ArrowUp/ArrowDown navigates the dropdown, highlighted item is visually distinct
- [ ] Enter/Tab selects the highlighted user and inserts `@username ` into the text
- [ ] Escape closes the dropdown without inserting anything
- [ ] Clicking a user in the dropdown inserts the mention
- [ ] After insertion, cursor is positioned after the mention + space
- [ ] Mentions in sent messages render with indigo highlight
- [ ] `@username` at start of message is highlighted
- [ ] `@username` after a space in the middle of text is highlighted
- [ ] `email@domain` is NOT highlighted as a mention
- [ ] The dropdown appears above the input, not below it
- [ ] Dropdown does not appear when typing in the middle of a word (e.g., `foo@bar`)
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- [ ] Test on mobile: dropdown works on small screens
- [ ] Mention autocomplete does not break the existing Enter-to-send and typing indicator functionality

# Slash Commands & Inline Polls

## Summary
Implement slash commands (`/poll`, `/me`, `/shrug`, `/nick`) and the inline poll system from Phase 5 of PLAN.md. The `/poll` command is the featured demo moment: "Run a live poll on stream — 'what should I build next?' — and watch the votes flood in with animated bars."

## Context

### Current State
- Messages are stored in `convex/messages.ts` with `sendMessage` mutation
- MessageInput at `src/components/MessageInput.tsx` handles text input and send
- MessageItem at `src/components/MessageItem.tsx` renders individual messages
- MessageText at `src/components/MessageText.tsx` handles markdown rendering
- Schema at `convex/schema.ts` defines the data model

### What Needs to Change

The feature has two parts:
1. **Simple slash commands** (`/me`, `/shrug`, `/nick`) — processed client-side or in the sendMessage mutation
2. **Poll system** (`/poll`) — requires a new `polls` table, backend mutations, and a rich poll UI component

## Implementation Plan

### 1. Schema Changes (`convex/schema.ts`)

Add a `polls` table:
```typescript
polls: defineTable({
  channelId: v.id("channels"),
  messageId: v.id("messages"),
  question: v.string(),
  options: v.array(v.object({
    text: v.string(),
    votes: v.number(),
  })),
  createdBy: v.id("users"),
})
  .index("by_messageId", ["messageId"])
  .index("by_channelId", ["channelId"]),

pollVotes: defineTable({
  pollId: v.id("polls"),
  userId: v.id("users"),
  optionIndex: v.number(),
})
  .index("by_pollId", ["pollId"])
  .index("by_pollId_userId", ["pollId", "userId"]),
```

Also add an optional `type` field to the `messages` table to distinguish system/action messages from regular ones:
```typescript
messages: defineTable({
  // ...existing fields...
  type: v.optional(v.union(v.literal("action"), v.literal("poll"), v.literal("system"))),
})
```

After modifying the schema, run `pnpm -s convex codegen`.

### 2. Backend — Poll Functions (`convex/polls.ts`)

Create new file `convex/polls.ts` with:

**`createPoll` (mutation)**:
- Args: `channelId`, `userId`, `question` (string), `options` (array of strings)
- Validates: at least 2 options, max 10 options, question not empty
- Creates a message with `type: "poll"` and `text` set to the question
- Creates the poll document linked to the message
- Returns the poll ID

**`vote` (mutation)**:
- Args: `pollId`, `userId`, `optionIndex`
- Checks if user already voted on this poll
- If already voted on same option, removes the vote (toggle)
- If already voted on different option, changes their vote
- If not voted, adds the vote
- Updates the vote counts on the poll options

**`getPoll` (query)**:
- Args: `messageId`
- Returns the poll with vote counts and the current user's vote (via pollVotes lookup)
- Used by the PollMessage component

### 3. Backend — Slash Command Processing (`convex/messages.ts`)

Modify the `sendMessage` mutation to detect and handle slash commands:

```typescript
// In the sendMessage handler, before inserting the message:
if (text.startsWith("/")) {
  const parts = text.split(" ");
  const command = parts[0].toLowerCase();

  // /me action — store as type: "action"
  if (command === "/me") {
    const actionText = text.slice(4).trim();
    if (!actionText) throw new Error("/me requires an action text");
    await ctx.db.insert("messages", {
      channelId,
      userId: args.userId,
      text: actionText,
      type: "action",
    });
    // clear typing, return early
    return;
  }

  // /shrug — append ¯\_(ツ)_/¯ to any text after /shrug
  if (command === "/shrug") {
    const prefix = text.slice(6).trim();
    const shrugText = prefix ? `${prefix} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯";
    // Fall through to normal message insert with shrugText
    // (replace text variable)
  }

  // /poll — delegate to poll creation (handled on the client by calling createPoll directly)
  // The client-side code intercepts /poll and calls the createPoll mutation instead.
}
```

Actually, for cleaner separation, handle `/poll` on the client side (in MessageInput) by parsing the command and calling `createPoll` mutation directly. Handle `/me` and `/shrug` in the backend's `sendMessage` mutation so they go through the normal message flow.

For `/nick`, handle on the client by calling a new `changeUsername` mutation on `convex/users.ts`.

### 4. Backend — Change Username (`convex/users.ts`)

Add a `changeUsername` mutation:
```typescript
export const changeUsername = mutation({
  args: {
    userId: v.id("users"),
    newUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const username = args.newUsername.trim();
    if (!username || username.length > 30) throw new Error("Invalid username");
    // Check uniqueness
    const existing = await ctx.db.query("users").withIndex("by_username", q => q.eq("username", username)).unique();
    if (existing && existing._id !== args.userId) throw new Error("Username already taken");
    await ctx.db.patch("users", args.userId, { username });
  },
});
```

### 5. Frontend — Slash Command Handling in MessageInput (`src/components/MessageInput.tsx`)

Modify the `handleSend` function:

1. If text starts with `/poll `, parse the format: `/poll Question? | Option A | Option B | Option C`
   - Split by `|`, first part is the question, rest are options
   - Call `createPoll` mutation instead of `sendMessage`
   - Show inline error if format is invalid (less than 2 options)

2. If text starts with `/nick `, call `changeUsername` mutation with the new name
   - Show a brief confirmation (or the mutation will cause the user's display to update reactively)

3. For `/me` and `/shrug`, just call `sendMessage` normally — the backend handles the transformation

4. Add a **slash command autocomplete** dropdown (similar to mention autocomplete) that appears when user types `/` at the start of the input. Show available commands:
   - `/poll Question | Option 1 | Option 2` — Create a poll
   - `/me action` — Express an action
   - `/shrug [text]` — Append ¯\_(ツ)_/¯
   - `/nick newname` — Change your display name

### 6. Frontend — SlashCommandHint Component (`src/components/SlashCommandHint.tsx`)

Create a small dropdown component that appears above the input when user types `/` at the start:
- Shows list of available commands with descriptions
- Keyboard navigable (up/down arrows, Enter to select)
- Auto-filters as user types (e.g., `/p` shows only `/poll`)
- When selected, inserts the command template into the input

### 7. Frontend — PollMessage Component (`src/components/PollMessage.tsx`)

Create a new component for rendering poll messages inline in the message list:

```
┌─────────────────────────────────────────┐
│  📊 What should I build next?           │
│                                         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  Real-time DB   │
│  45% (12 votes)                         │
│                                         │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░  Chat app       │
│  30% (8 votes)                          │
│                                         │
│  ▓▓▓▓▓░░░░░░░░░░░░░░░  Dashboard      │
│  25% (7 votes)                          │
│                                         │
│  27 votes · Created by matt             │
└─────────────────────────────────────────┘
```

Features:
- Click an option to vote (highlights your vote in indigo)
- Click again to remove your vote
- Animated vote bars that smoothly resize when votes change (using CSS transitions)
- Real-time updates as votes come in (Convex reactive query)
- Shows total vote count and percentage per option
- Shows "You voted" indicator on the selected option
- Uses `useQuery(api.polls.getPoll, { messageId })` for reactive data

### 8. Frontend — Action Message Rendering (`src/components/MessageItem.tsx`)

For messages with `type: "action"`, render them differently:
- Instead of the normal message format, show: `* username does something *` in italic
- No avatar, no timestamp (compact format)
- Still show reactions below

### 9. Frontend — MessageList Integration (`src/components/MessageList.tsx`)

Update MessageList to pass `message.type` through to MessageItem, so it can decide how to render action messages vs. poll messages vs. regular messages.

For poll messages, render the `PollMessage` component instead of the normal text.

### 10. Run Codegen and Type Check

After all changes:
```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any TypeScript errors.

### 11. Test in Browser

Use playwright-cli to verify:
1. Type `/` in message input → slash command hint appears
2. Type `/shrug` and send → message appears with `¯\_(ツ)_/¯`
3. Type `/me is testing` and send → action message appears as `* username is testing *`
4. Type `/poll Best color? | Red | Blue | Green` and send → poll appears with vote bars
5. Click a poll option → vote registers, bar animates
6. Click same option again → vote removed
7. Type `/nick newname` → username changes
8. Test on mobile viewport as well

## Files to Create
- `convex/polls.ts` — Poll backend functions
- `src/components/PollMessage.tsx` — Poll rendering component
- `src/components/SlashCommandHint.tsx` — Slash command autocomplete dropdown

## Files to Modify
- `convex/schema.ts` — Add polls, pollVotes tables; add type field to messages
- `convex/messages.ts` — Handle /me and /shrug in sendMessage
- `convex/users.ts` — Add changeUsername mutation
- `src/components/MessageInput.tsx` — Detect slash commands, route /poll and /nick to appropriate mutations, show slash command hints
- `src/components/MessageItem.tsx` — Render action messages differently, render polls
- `src/components/MessageList.tsx` — Pass message type to MessageItem

## Key Design Decisions
- `/poll` is parsed client-side and calls `createPoll` directly (cleaner separation)
- `/me` and `/shrug` are handled server-side in sendMessage (simpler, atomic)
- `/nick` is handled client-side calling changeUsername (immediate feedback)
- Poll votes are stored in a separate `pollVotes` table for proper tracking (who voted for what)
- Poll vote counts are computed from pollVotes in the query (not stored denormalized) to avoid race conditions
- CSS transitions on vote bars for smooth animation
- The poll component uses a Convex reactive query so votes update in real-time across all clients

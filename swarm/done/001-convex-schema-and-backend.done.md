# Task: Convex Schema & Backend Functions for Phase 1

## Overview

Define the Convex database schema and implement all backend queries/mutations needed for Phase 1 of Ruckus — a real-time collaborative chat app. This task creates the data layer: tables for users, channels, messages, presence, and typing indicators, plus all the Convex functions to power them.

**Design philosophy:** Everything is public, no private channels, no DMs. Users pick a username and they're in. No passwords, no email — friction is the enemy.

**IMPORTANT:** The current codebase has `@convex-dev/auth` set up with no providers. Since Ruckus uses a simple "pick a username" model (no real authentication), we will NOT use Convex Auth for user identity. Instead, we'll use a lightweight session-based approach: the frontend generates a random session ID (stored in localStorage), sends it to the backend, and the backend associates it with a user record. This avoids the complexity of auth providers entirely.

## Current State

- `convex/schema.ts` — Only has `...authTables` placeholder, no app tables
- `convex/auth.ts` — Has convexAuth with empty providers array
- `convex/http.ts` — Only auth HTTP routes
- No queries, mutations, or actions for chat functionality exist

## Requirements

### 1. Define Schema (`convex/schema.ts`)

Keep the existing `...authTables` (don't break anything) but add these tables:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,

  // Users who have joined (identified by sessionId from localStorage)
  users: defineTable({
    username: v.string(),
    sessionId: v.string(),        // random ID generated client-side
    avatarColor: v.string(),      // hex color derived from username hash
    lastSeen: v.number(),         // timestamp for online presence
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_username", ["username"]),

  // Chat channels
  channels: defineTable({
    name: v.string(),             // e.g. "general", "random"
    topic: v.optional(v.string()), // channel topic/description
    createdBy: v.id("users"),
  })
    .index("by_name", ["name"]),

  // Messages in channels
  messages: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    text: v.string(),
  })
    .index("by_channelId", ["channelId"]),  // _creationTime is implicit

  // Typing indicators
  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),        // timestamp when typing expires
  })
    .index("by_channelId", ["channelId"]),
});

export default schema;
```

### 2. Create User Functions (`convex/users.ts`)

```typescript
// mutation: joinOrReturn
// - Takes { sessionId: string, username: string }
// - If a user with this sessionId already exists, update their username and lastSeen, return user ID
// - If not, create a new user with a generated avatarColor (derive from username hash)
// - Return the user's _id
// - avatarColor generation: hash the username and pick from a preset list of pleasant colors

// mutation: heartbeat
// - Takes { sessionId: string }
// - Updates the user's lastSeen to Date.now()
// - Called periodically by the frontend to maintain presence

// query: getOnlineUsers
// - Takes { channelId?: Id<"channels"> } (optional, for future filtering)
// - Returns all users whose lastSeen is within the last 60 seconds
// - Returns { _id, username, avatarColor, lastSeen }

// query: getCurrentUser
// - Takes { sessionId: string }
// - Returns the user record for the given sessionId, or null
```

### 3. Create Channel Functions (`convex/channels.ts`)

```typescript
// mutation: createChannel
// - Takes { name: string, userId: Id<"users"> }
// - Name must be lowercase, alphanumeric + hyphens, 1-50 chars
// - Check if channel with this name already exists; if so, throw error
// - Create channel and return its _id

// mutation: updateTopic
// - Takes { channelId: Id<"channels">, topic: string }
// - Updates the channel topic (anyone can do this)

// query: listChannels
// - Takes no args
// - Returns all channels, sorted by name
// - Include member count (count of unique userId values in messages for that channel — or just return all channels for now, member count can be approximate)

// mutation: seedDefaultChannels
// - Takes { userId: Id<"users"> }
// - Creates #general, #random, #introductions if they don't exist
// - This is called once when the first user joins
```

### 4. Create Message Functions (`convex/messages.ts`)

```typescript
// mutation: sendMessage
// - Takes { channelId: Id<"channels">, userId: Id<"users">, text: string }
// - Validate text is non-empty and <= 4000 chars
// - Insert the message
// - Also clear any typing indicator for this user in this channel

// query: getMessages
// - Takes { channelId: Id<"channels"> }
// - Returns the latest 100 messages for the channel, ordered by _creationTime ascending
// - Each message should include the user's username and avatarColor (join with users table)
// - Return shape: { _id, text, _creationTime, user: { _id, username, avatarColor } }
```

### 5. Create Typing Indicator Functions (`convex/typing.ts`)

```typescript
// mutation: setTyping
// - Takes { channelId: Id<"channels">, userId: Id<"users"> }
// - Upsert a typing indicator with expiresAt = Date.now() + 3000 (3 seconds)
// - If one already exists for this user+channel, update expiresAt

// mutation: clearTyping
// - Takes { channelId: Id<"channels">, userId: Id<"users"> }
// - Delete the typing indicator for this user+channel

// query: getTypingUsers
// - Takes { channelId: Id<"channels"> }
// - Returns users who are currently typing (expiresAt > Date.now())
// - Return { _id, username } for each
// - Filter out expired entries
```

### 6. Run Codegen

After creating the schema and all function files, run:
```bash
pnpm -s convex codegen
```

Make sure there are no TypeScript errors:
```bash
pnpm -s tsc -p tsconfig.json --noEmit
```

## Important Notes

- Use `v.id("tableName")` for ID references per Convex conventions
- Remember `db.get`, `db.patch`, and `db.delete` take two arguments: table name and document ID (per CLAUDE.md)
- Use `Promise.all` when doing multiple independent awaits (per CLAUDE.md)
- Don't modify `convex/_generated/` — it's auto-generated
- The typing indicator `expiresAt` approach avoids needing a scheduled cleanup; the query simply filters by current time
- Keep the avatarColor generation simple: hash the username string to a number, use modulo to pick from a list of 12-16 predefined pleasant colors (not too dark, not too light — they'll be used as backgrounds on dark theme)

## Validation Checklist

- [ ] Schema compiles without errors
- [ ] `pnpm -s convex codegen` succeeds
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no errors in convex/ files
- [ ] All functions use correct 2-arg form for db.get/db.patch/db.delete

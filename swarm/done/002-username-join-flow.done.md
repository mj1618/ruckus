# Task: Username Join Flow & Session Management

## Overview

Build the "pick a username and you're in" join flow for Ruckus. When a visitor hits the app, they see a clean username picker. Once they enter a name, they're immediately dropped into the chat. Identity is session-based (random ID stored in localStorage) — no passwords, no email, no signup form.

**Depends on:** Task 001 (Convex schema & backend functions must exist first)

## Current State

- `src/app/page.tsx` — Basic placeholder page with Authenticated/Unauthenticated wrappers (these won't be used since we're not using Convex Auth for identity)
- `src/app/ConvexClientProvider.tsx` — Convex client provider (keep this, it provides the Convex connection)
- No user context, no session management, no join flow

## Requirements

### 1. Session ID Utility (`src/lib/sessionId.ts`)

Create a simple utility for managing the session ID:

```typescript
// getOrCreateSessionId(): string
// - Check localStorage for "ruckus-session-id"
// - If it exists, return it
// - If not, generate a random UUID (crypto.randomUUID()), store it, and return it
// - This is the user's identity for the session
```

### 2. User Context Provider (`src/components/UserContext.tsx`)

Create a React context that manages user state across the app:

```typescript
"use client";

// UserContext provides:
// - user: the current user record from Convex (or null if not joined)
// - sessionId: the localStorage session ID
// - join(username: string): calls the joinOrReturn mutation, sets user state
// - isLoading: true while checking if user exists

// Implementation:
// 1. On mount, get sessionId from localStorage utility
// 2. Use useQuery to call users.getCurrentUser with { sessionId }
// 3. If user exists, they're already joined — set user state
// 4. If user is null, show join flow
// 5. join() calls users.joinOrReturn mutation, which creates/updates the user
// 6. Also set up a heartbeat interval (every 30 seconds) calling users.heartbeat

// Also call channels.seedDefaultChannels after joining (to ensure #general etc. exist)
```

The context shape:
```typescript
interface UserContextType {
  user: {
    _id: Id<"users">;
    username: string;
    avatarColor: string;
  } | null;
  sessionId: string;
  join: (username: string) => Promise<void>;
  isLoading: boolean;
}
```

### 3. Join Screen Component (`src/components/JoinScreen.tsx`)

A full-screen centered join form:

```
"use client";

// Visual design:
// - Centered on screen, dark background
// - Large "Ruckus" heading at top (text-5xl font-bold)
// - Subtitle: "Jump in. Pick a name. Start talking." (text-zinc-400)
// - Username input field:
//   - Placeholder: "Enter your name..."
//   - Max length 30 characters
//   - Alphanumeric, spaces, underscores, hyphens allowed
//   - Show validation error inline if invalid
// - "Join" button (primary color, e.g. indigo-500)
// - The form auto-focuses the input on mount
// - Submit on Enter key
// - Show a preview of the avatar (colored circle with first letter of username)
//   that updates as they type, using the same color derivation as the backend

// On submit:
// - Call userContext.join(username)
// - Show brief loading state on button
// - On success, the UserContext will update and the app will render the chat
```

### 4. Update Main Page (`src/app/page.tsx`)

Replace the current placeholder with:

```typescript
"use client";

// If user is loading: show loading skeleton/spinner
// If user is null (not joined): show <JoinScreen />
// If user exists: show <ChatLayout /> (this will be built in task 003)
//   For now, show a placeholder: "Welcome, {username}! Chat coming soon..."
//   with a temporary "Leave" button that clears localStorage and reloads

// Wrap everything in <UserProvider>
```

### 5. Update Layout (`src/app/layout.tsx`)

The layout should include the UserProvider wrapping:

```typescript
// Keep existing ConvexAuthNextjsServerProvider and ConvexClientProvider
// The UserProvider should be nested inside ConvexClientProvider
// (It needs Convex hooks to work)
```

Actually — since UserProvider uses Convex hooks (useQuery/useMutation), it must be inside ConvexClientProvider. And since page.tsx is "use client", the UserProvider can be placed there or in a wrapper. Simplest approach: put UserProvider directly in page.tsx wrapping the content.

### 6. Avatar Color Utility (`src/lib/avatarColor.ts`)

A shared utility (used by both JoinScreen preview and message display later):

```typescript
// AVATAR_COLORS: string[] — 16 pleasant, distinct colors that work well on dark backgrounds
// Examples: "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", etc.
// (Use Tailwind's color palette values at the 500 level)

// getAvatarColor(username: string): string
// - Simple hash: sum char codes, modulo AVATAR_COLORS.length
// - Return the color
// Must match the backend implementation in users.ts
```

## Important Notes

- This does NOT use Convex Auth for user identity — it's purely session-based with localStorage
- The `ConvexAuthNextjsServerProvider` and related auth infrastructure can stay in place (it doesn't hurt to have it), but our user identity is separate
- The heartbeat should run via `setInterval` in the UserContext useEffect, calling the `heartbeat` mutation every 30 seconds
- When the tab is hidden (document.visibilityState), consider pausing heartbeats to save resources (optional optimization)
- Keep the UI dark-themed to match the existing globals.css dark mode

## File Structure

```
src/
  lib/
    sessionId.ts
    avatarColor.ts
  components/
    UserContext.tsx
    JoinScreen.tsx
  app/
    page.tsx  (modified)
    layout.tsx (may need minor modification)
```

## Validation Checklist

- [ ] Visiting the app shows the join screen
- [ ] Entering a username and clicking "Join" transitions to the chat view
- [ ] Refreshing the page after joining shows the chat view (session persisted)
- [ ] Avatar color preview matches what will be stored in the database
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors

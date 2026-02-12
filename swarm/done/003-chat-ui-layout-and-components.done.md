# Task: Chat UI Layout & Core Components

## Overview

Build the main chat interface for Ruckus — the channel sidebar, message list, message input, online users panel, and typing indicator. This is the core visual experience: a Slack/Discord-like layout with real-time messaging.

**Depends on:** Task 001 (Convex backend) and Task 002 (user join flow & context)

## Current State

After tasks 001 and 002:
- Convex schema with users, channels, messages, typingIndicators tables
- Backend queries/mutations for all CRUD operations
- User session management with UserContext
- Join flow that drops users into the chat
- `page.tsx` shows `<JoinScreen />` or a placeholder for chat

This task replaces the placeholder with the full chat UI.

## Requirements

### 1. Chat Layout Component (`src/components/ChatLayout.tsx`)

The main layout container — a full-screen flex layout:

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────┐ ┌────────────┐ │
│ │          │ │  Channel Header        │ │            │ │
│ │ Channel  │ ├────────────────────────┤ │  Online    │ │
│ │ Sidebar  │ │                        │ │  Users     │ │
│ │          │ │  Message List          │ │            │ │
│ │ #general │ │                        │ │  @alice    │ │
│ │ #random  │ │                        │ │  @bob      │ │
│ │ #intros  │ │                        │ │  @carol    │ │
│ │          │ │                        │ │            │ │
│ │ + Create │ ├────────────────────────┤ │            │ │
│ │          │ │  Typing Indicator      │ │            │ │
│ │          │ │  Message Input         │ │            │ │
│ └──────────┘ └────────────────────────┘ └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

```typescript
"use client";

// State:
// - activeChannelId: Id<"channels"> | null — the currently selected channel
// - On mount, default to #general (find it from the channel list)
// - mobileView: "sidebar" | "chat" | "users" — for mobile responsive layout

// Layout:
// - Full viewport height (h-screen)
// - Three-column flex layout on desktop:
//   - Left: ChannelSidebar (w-64, fixed width)
//   - Center: flex-1, contains ChannelHeader + MessageList + TypingIndicator + MessageInput
//   - Right: OnlineUsers (w-56, fixed width)
// - On mobile (< 768px):
//   - Show one panel at a time based on mobileView state
//   - Hamburger button in header to toggle sidebar
//   - Users panel accessible via button in header
```

### 2. Channel Sidebar (`src/components/ChannelSidebar.tsx`)

```typescript
"use client";

// Header:
// - "Ruckus" logo/text at top (text-xl font-bold, with a subtle brand color)
// - Horizontal divider

// Channel List:
// - Use useQuery to call channels.listChannels
// - Each channel shown as: "# channel-name"
// - Active channel highlighted with bg-zinc-700/50 and white text
// - Inactive channels in zinc-400 text
// - Click to switch channel (calls setActiveChannelId in parent)
// - Channels sorted alphabetically

// Create Channel:
// - "+" button or "Create Channel" link at bottom of channel list
// - Clicking opens an inline input field (not a modal)
// - Type channel name, press Enter to create
// - Validate: lowercase, alphanumeric + hyphens, 1-50 chars
// - On success, auto-switch to the new channel
// - On error (duplicate name), show inline error

// Footer:
// - Current user info: avatar circle + username
// - Small text showing "Online" with green dot

// Styling:
// - Dark background: bg-zinc-900
// - Border right: border-r border-zinc-800
```

### 3. Channel Header (`src/components/ChannelHeader.tsx`)

```typescript
"use client";

// Shows:
// - "# channel-name" in bold
// - Channel topic in smaller text below (zinc-400), or "No topic set" placeholder
// - Click on topic to edit (inline text input, saves via channels.updateTopic)
// - On mobile: hamburger menu button (left) and users button (right)

// Styling:
// - h-14, flex items-center
// - Border bottom: border-b border-zinc-800
// - bg-zinc-900/50 backdrop-blur (subtle glass effect)
```

### 4. Message List (`src/components/MessageList.tsx`)

```typescript
"use client";

// Props: { channelId: Id<"channels"> }

// Data:
// - Use useQuery to call messages.getMessages with { channelId }
// - Messages come back with user info attached

// Rendering:
// - Scroll container that fills available space (flex-1 overflow-y-auto)
// - Each message rendered as <MessageItem />
// - Auto-scroll to bottom on new messages:
//   - Use a ref on a div at the bottom of the list
//   - Scroll into view when messages array length changes
//   - BUT only auto-scroll if user was already at bottom (within 100px)
//   - If user scrolled up to read history, don't yank them down

// Empty state:
// - If no messages: "No messages yet. Be the first to say something!"
// - Centered, zinc-500 text

// Loading state:
// - If query is loading: show 3-5 skeleton message placeholders
//   (gray rounded rectangles mimicking message shape)
```

### 5. Message Item (`src/components/MessageItem.tsx`)

```typescript
"use client";

// Props: { message: { _id, text, _creationTime, user: { _id, username, avatarColor } } }

// Layout (horizontal):
// ┌──────┐
// │ AVA  │  Username    12:34 PM
// │ TAR  │  Message text here...
// └──────┘

// Avatar:
// - 40x40 circle with the user's avatarColor as background
// - First letter of username centered in white, bold
// - If same user sent consecutive messages within 5 minutes,
//   collapse: hide avatar/name/time, show only the text with left indent
//   (grouped messages, like Slack)

// Username:
// - Bold, white text
// - Followed by timestamp in zinc-500, smaller text
// - Timestamp format: "12:34 PM" for today, "Mon 12:34 PM" for this week,
//   "Jan 5, 12:34 PM" for older

// Message text:
// - zinc-300 text, normal weight
// - Preserve newlines (whitespace-pre-wrap)
// - For now, plain text only (rich formatting comes in Phase 3)

// Hover state:
// - Subtle background highlight on hover (bg-zinc-800/30)
```

### 6. Message Input (`src/components/MessageInput.tsx`)

```typescript
"use client";

// Props: { channelId: Id<"channels"> }

// UI:
// - Textarea (auto-growing, 1-5 rows) with placeholder "Message #channel-name"
// - Send button (arrow icon or "Send" text) on the right, visible when text is non-empty
// - Border: border border-zinc-700, rounded-lg
// - bg-zinc-800

// Behavior:
// - Enter sends the message (calls messages.sendMessage mutation)
// - Shift+Enter inserts a newline
// - After sending, clear the input and refocus
// - While typing, call typing.setTyping mutation (debounced, max once per 2 seconds)
// - When input is cleared or message is sent, call typing.clearTyping
// - Disable send button while mutation is in flight (prevent double-send)
// - Max length: 4000 chars (show character count near limit, e.g. when > 3800)
```

### 7. Typing Indicator (`src/components/TypingIndicator.tsx`)

```typescript
"use client";

// Props: { channelId: Id<"channels"> }

// Data:
// - Use useQuery to call typing.getTypingUsers with { channelId }
// - Filter out the current user (don't show "you are typing")

// Display:
// - Height: fixed h-6 (so it doesn't cause layout shift)
// - If no one typing: empty (invisible but space preserved)
// - If 1 person: "alice is typing..."
// - If 2 people: "alice and bob are typing..."
// - If 3+: "alice, bob, and 2 others are typing..."
// - Animated dots (CSS animation, three dots fading in sequence)
// - zinc-400 text, text-sm, italic
```

### 8. Online Users Panel (`src/components/OnlineUsers.tsx`)

```typescript
"use client";

// Data:
// - Use useQuery to call users.getOnlineUsers

// Header:
// - "Online — N" where N is the count

// User List:
// - Each user: avatar circle (24x24) + username
// - Green dot indicator next to avatar
// - Sorted alphabetically

// Styling:
// - bg-zinc-900, border-l border-zinc-800
// - Overflow-y-auto for long lists
```

### 9. Update `page.tsx`

Wire everything together:

```typescript
"use client";

import { UserProvider, useUser } from "@/components/UserContext";
import { JoinScreen } from "@/components/JoinScreen";
import { ChatLayout } from "@/components/ChatLayout";

function AppContent() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return /* loading skeleton */;
  }

  if (!user) {
    return <JoinScreen />;
  }

  return <ChatLayout />;
}

export default function Home() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
```

### 10. Update Global Styles (`src/app/globals.css`)

Add any needed global styles:

```css
/* Customize scrollbar for dark theme */
/* Smooth scrolling for message list */
/* Animation for typing indicator dots */
```

Keep it minimal — prefer Tailwind utilities over custom CSS. Only add custom CSS for things Tailwind can't handle (like scrollbar styling and keyframe animations for the typing dots).

## Mobile Responsiveness

- Below 768px (md breakpoint):
  - Hide the channel sidebar and online users panel by default
  - Show a hamburger icon (top-left) to slide in the sidebar as an overlay
  - Show a users icon (top-right) to slide in the users panel as an overlay
  - Message list and input take full width
  - Clicking a channel in the sidebar closes the sidebar overlay
- Above 768px:
  - Three-column layout as described above
  - All panels visible simultaneously

## Styling Guidelines

- Dark theme: bg-zinc-950 for main background, bg-zinc-900 for panels
- Text: zinc-100 for primary, zinc-400 for secondary, zinc-500 for tertiary
- Borders: zinc-800
- Interactive elements: hover states with bg-zinc-800 or bg-zinc-700
- Focus rings: ring-indigo-500 or similar brand accent
- Transitions: transition-colors for hover states (keep it snappy, 150ms)
- Font: use the Geist font already set up (font-sans)

## Validation Checklist

- [ ] Three-column layout renders correctly on desktop
- [ ] Channel sidebar shows #general, #random, #introductions
- [ ] Clicking a channel loads its messages
- [ ] Sending a message appears instantly in the message list
- [ ] Messages auto-scroll to bottom on new messages
- [ ] Typing indicator shows when another user is typing
- [ ] Online users panel shows connected users
- [ ] Creating a new channel works from the sidebar
- [ ] Mobile layout works (single panel with navigation)
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- [ ] Test in browser: full flow from join to chatting works

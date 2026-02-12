# Ruckus — Build Plan

A real-time collaborative chat app built live to demonstrate what AI can build in a few hours.

**Design philosophy:** Everything is public, everything is open. No private channels, no invite-only rooms, no DMs. You pick a name and you're in — every channel is visible, every channel is joinable, anyone can create one. This is a demo built for a live audience, and friction is the enemy.

**Tech stack:** Next.js, TypeScript, Tailwind CSS, Convex.dev (real-time backend).

---

## Phase 1 — The Foundation
**Goal:** A working chat room that people can join and talk in. The "it works!" moment.

- Next.js app with TypeScript and Tailwind CSS
- Convex backend: real-time database handles all the WebSocket sync automatically — no manual socket management
- Single chat room, no channels yet
- Join flow: visitor hits the URL, picks a username, gets a random avatar color (generated from username hash) — no signup, no passwords, no email, you're just in
- Immediately dropped into #general, full channel list visible in the sidebar
- Real-time messaging: type, send, see everyone's messages instantly
- Message format: avatar, username, timestamp, text
- "X is typing..." indicator
- Online users sidebar with presence dots
- Auto-scroll to newest message
- Mobile-responsive layout
- Basic visual design: dark theme, clean typography, Ruckus branding/logo in the sidebar

**Demo moment:** Open it on two devices, send a message, watch it appear instantly on both.

---

## Phase 2 — Channels
**Goal:** It stops being a toy and starts feeling like Slack.

- Channel sidebar showing ALL channels — everything is public, everything is visible
- Default channels on launch: #general, #random, #introductions
- Anyone can create a new channel (just type a name, it appears for everyone instantly)
- Anyone can join any channel — just click it in the sidebar, you're in
- Channel switching with message history preserved per channel
- Unread message counts per channel (bold + badge)
- "New messages" divider line when you switch back to a channel
- Channel topic/description shown at the top (anyone can edit it)
- Member count shown per channel so you can see where the crowd is
- Keyboard shortcut: Ctrl/Cmd+K opens a quick channel switcher

**Demo moment:** Tell the audience "someone make a channel" — watch channels start appearing in everyone's sidebar in real time. Chaos.

---

## Phase 3 — Rich Messaging
**Goal:** Messages stop being plain text and start feeling expressive.

- Markdown rendering (bold, italic, code, links, blockquotes)
- Inline code blocks with syntax highlighting
- Emoji picker button + emoji shortcodes (:fire: → 🔥)
- Emoji reactions on messages — click to react, see reaction counts, see who reacted on hover
- Edit your own messages (shows "edited" label)
- Delete your own messages
- Link previews / URL unfurling with title and description
- Image/file sharing via drag-and-drop or paste, with inline image preview
- Message formatting toolbar for non-markdown users

**Demo moment:** Someone drops an image in chat, someone else reacts with 🔥, a code block renders beautifully — it all just works.

---

## Phase 4 — Threads & Organization
**Goal:** Chat gets structure. This is where it feels genuinely useful.

- Threaded replies: click "Reply in thread" → opens a side panel with the thread
- Thread indicator on the parent message ("3 replies" with avatar stack)
- @mentions with autocomplete dropdown as you type
- Mentions inbox: a panel that collects all messages where you were @mentioned
- Pinned messages per channel (host or anyone can pin, pinned messages viewable in a list)
- Bookmarked/saved messages (personal, cross-channel)
- Full-text search across all channels with highlighted matching terms (everything's public, so search sees everything)
- Jump to search result in context

**Demo moment:** @mention someone in the audience, show them their mentions inbox lighting up. Pin a message and show the pinned list.

---

## Phase 5 — Personality & Expression
**Goal:** Make it fun. This is where the audience gets hooked.

- Custom status messages with emoji ("🍕 grabbing lunch", "👀 lurking")
- Slash commands:
  - `/poll Question? | Option A | Option B | Option C` — creates an inline poll with live-updating vote bars
  - `/me does something` — action message in italic
  - `/shrug` — appends ¯\\\_(ツ)\_/¯
  - `/nick newname` — change your display name
  - `/giphy search term` — posts a random GIF (via Tenor/Giphy API)
- GIF picker UI (search and preview before sending)
- Voice messages: hold-to-record button, sends a playable audio clip inline
- Message sounds (toggleable): subtle pop on new message, different sound for mentions
- Desktop/browser notifications for mentions (with permission prompt)

**Demo moment:** Run a live poll on stream — "what should I build next?" — and watch the votes flood in with animated bars.

---

## Phase 6 — Stream & Host Features
**Goal:** The "control room" that makes this perfect for a live audience.

- **Live user count** displayed prominently (fun to watch climb)
- **Message velocity sparkline** — real-time graph of messages per second
- **Live word cloud** — built from recent messages, updates every few seconds
- **Spotlight/announcement** — host pins a message to the top of everyone's screen with a highlight animation
- **Slow mode** — host can set a cooldown (e.g., one message per 10 seconds per user)
- **Moderation tools:**
  - Mute a user (they can read but not send)
  - Delete any message
  - Lock a channel (read-only, still visible to everyone)
  - Ban a user from the session
- **Host dashboard panel** — shows active users, message rate, top chatters, flag queue
- **QR code generator** — displays a QR code with the join URL, perfect for showing on stream

**Demo moment:** Show the dashboard with 100+ users, trigger slow mode during chaos, spotlight a funny message.

---

## Phase 7 — Special Channels
**Goal:** Channels that aren't just text — this is the "wait, it does THAT?" moment.

- **#draw** — a shared mini whiteboard (freehand draw, colors, clear) embedded in the channel area instead of a message list. Chat messages appear as an overlay. Visible in every user's sidebar from the start.
- **#anonymous** — all messages show as "Anonymous" with a generic avatar. Same person gets the same anonymous ID within a session for continuity. Anyone can pop in.
- **#vote** — every message automatically becomes a poll. Just type a question and it gets upvote/downvote buttons. No setup needed.
- **#music** — shared listening: paste a YouTube URL, it queues up, everyone sees the now-playing embed. Upvote to bump in the queue. Open to all.

**Demo moment:** Tell the audience "go to #draw and draw something" — watch the whiteboard explode with doodles live on stream.

---

## Phase 8 — Polish & Delight
**Goal:** Make it feel like a real product, not a hackathon project.

- Smooth message animations (slide in on arrival, fade on delete)
- Loading skeletons instead of spinners
- Toast notifications ("You were mentioned in #random")
- Dark mode / light mode toggle with system preference detection
- Drag-to-reorder channels in the sidebar
- Compact mode toggle (smaller avatars, tighter spacing for power users)
- Keyboard shortcuts panel (? to open)
- Connection status indicator (green dot → yellow "reconnecting..." → red "disconnected")
- Timelapse replay: log all message events with timestamps, let the host replay the session's activity as a fast-forward visualization
- Export chat history as text/JSON

**Demo moment:** Toggle between dark and light mode. Show the timelapse of the entire session compressed into 30 seconds.

---

## Technical Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js + TypeScript + Tailwind) │
│  - Convex React hooks (useQuery, useMutation│
│    for automatic real-time subscriptions)   │
│  - HTML Canvas (whiteboard, word cloud)     │
│  - Web Audio API (voice messages)           │
│  - Notification API (browser notifications) │
└──────────────────┬──────────────────────────┘
                   │ Convex WebSocket (automatic)
┌──────────────────▼──────────────────────────┐
│  Backend (Convex.dev)                       │
│  - Tables: users, channels, messages,       │
│    reactions, threads, polls, presence      │
│  - Queries: real-time subscriptions that    │
│    auto-update the UI (no manual sockets)   │
│  - Mutations: message send, channel create, │
│    react, vote, moderate, etc.              │
│  - Actions: external API calls (Giphy,      │
│    link unfurling, etc.)                    │
│  - Server-side validation & rate limiting   │
│  - Built-in persistence (no DB setup)       │
└─────────────────────────────────────────────┘
```

**Why this stack:**
- **Convex** eliminates all the WebSocket plumbing — queries auto-subscribe to changes, so when someone sends a message, every connected client sees it instantly with zero manual broadcasting code
- **Next.js + TypeScript** gives you type safety end-to-end (Convex generates types from your schema)
- **Tailwind** means fast, consistent styling without context-switching to CSS files
- The entire real-time sync layer that would normally take hours to build (Socket.io rooms, reconnection handling, delta broadcasting, state reconciliation) is just... handled

## Estimated Build Time Per Phase

| Phase | Description | Estimated Time |
|-------|-------------|---------------|
| 1 | Foundation | 45–60 min |
| 2 | Channels | 30–45 min |
| 3 | Rich Messaging | 45–60 min |
| 4 | Threads & Organization | 45–60 min |
| 5 | Personality & Expression | 30–45 min |
| 6 | Stream & Host Features | 30–45 min |
| 7 | Special Channels | 45–60 min |
| 8 | Polish & Delight | 30–45 min |
| **Total** | | **~5–7 hours** |

## The Narrative Arc

The build tells a story on stream:

1. **"Can it even chat?"** → Phase 1 proves the basics
2. **"OK but it's just one room"** → Phase 2 adds structure
3. **"Messages are boring"** → Phase 3 makes them rich
4. **"It's getting messy"** → Phase 4 adds organization
5. **"Make it fun"** → Phase 5 adds personality
6. **"Let me control this chaos"** → Phase 6 adds host power
7. **"Wait, what?"** → Phase 7 blows expectations with special channels
8. **"This feels... real"** → Phase 8 polishes it into something you'd actually use

Each phase has a clear demo moment where you pause, show the audience, and let them play with the new features. The stream is the demo.
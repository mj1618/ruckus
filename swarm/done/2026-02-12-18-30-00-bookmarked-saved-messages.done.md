# Bookmarked / Saved Messages

## Overview

Add personal bookmarked/saved messages so users can save messages they want to come back to later. Bookmarks are personal (only visible to the user who saved them) and work across all channels. This is a Phase 4 feature from the build plan: "Bookmarked/saved messages (personal, cross-channel)."

## Design

- A 🔖 bookmark button on the message hover toolbar (next to pin/edit/delete)
- Bookmarked messages show a subtle 🔖 indicator
- A "Saved Messages" panel accessible from the channel header (🔖 toggle button)
- The panel shows all bookmarked messages across all channels, newest first, with channel name labels
- Users can remove bookmarks from the panel or from the message hover toolbar

## Schema Changes

### File: `convex/schema.ts`

Add a new `bookmarks` table:

```typescript
bookmarks: defineTable({
  userId: v.id("users"),
  messageId: v.id("messages"),
  channelId: v.id("channels"),
  savedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_messageId", ["userId", "messageId"]),
```

## Backend Changes

### New File: `convex/bookmarks.ts`

Create a new backend file with 4 functions:

1. **`toggleBookmark` (mutation)** — Args: `userId`, `messageId`. If bookmark exists for this user+message, remove it. Otherwise, look up the message to get channelId and create a new bookmark with `savedAt: Date.now()`. Throw if message not found.

2. **`getBookmarks` (query)** — Args: `userId`. Query all bookmarks for the user using the `by_userId` index, ordered desc (newest first), take 100. For each bookmark, fetch the message (skip if deleted), the message's user info, and the channel name. Return array of `{ bookmark, message: { _id, text, _creationTime, user: { username, avatarColor }, channelId, channelName } }`.

3. **`getBookmarkedMessageIds` (query)** — Args: `userId`, `channelId`. Query bookmarks by userId index, filter to the given channelId, return just the messageId array. This is used by MessageList to mark which messages are bookmarked (similar to how pinnedMessageIds works).

4. **`removeBookmark` (mutation)** — Args: `userId`, `messageId`. Find the bookmark by userId+messageId index and delete it. No-op if not found.

## Frontend Changes

### New File: `src/components/BookmarkedMessages.tsx`

Create a panel component modeled closely on `PinnedMessages.tsx` (same layout pattern):

- Props: `onClose: () => void`
- Uses `useQuery(api.bookmarks.getBookmarks, { userId })`
- Header: "🔖 Saved Messages" with ✕ close button
- Empty state: "No saved messages yet"
- Loading state: "Loading..."
- Each bookmarked message shows:
  - User avatar (small, 8x8), username, timestamp
  - Message text via `<MessageText>`
  - Channel name label: "in #channel-name"
  - "Remove" button to unbookmark
- Clicking the channel name label could optionally navigate to that channel (call a prop `onNavigateToChannel`)

### Modify: `src/components/MessageItem.tsx`

Add bookmark support to the hover toolbar:

1. Add new prop: `isBookmarked?: boolean`
2. Add `toggleBookmark` mutation import
3. Add a 🔖 bookmark button to the hover toolbar (between the pin button and edit button):
   ```
   <button onClick={handleToggleBookmark} title={isBookmarked ? "Remove bookmark" : "Bookmark message"}>
     🔖
   </button>
   ```
   - When bookmarked: `text-indigo-400` color
   - When not bookmarked: `text-zinc-400 hover:text-zinc-200`
4. Add a bookmark indicator (similar to pinIndicator) shown when `isBookmarked` is true:
   ```
   {isBookmarked && <div className="text-xs text-indigo-500/70">🔖 Saved</div>}
   ```

### Modify: `src/components/MessageList.tsx`

1. Add a query for bookmarked message IDs: `useQuery(api.bookmarks.getBookmarkedMessageIds, { userId, channelId })`
2. Create a `Set` of bookmarked IDs for O(1) lookup
3. Pass `isBookmarked={bookmarkedIds.has(msg._id)}` to each `<MessageItem>`

### Modify: `src/components/ChannelHeader.tsx`

1. Add new props: `onToggleBookmarks: () => void`, `showBookmarks?: boolean`
2. Add a 🔖 toggle button between the search and pin buttons:
   ```
   <button onClick={onToggleBookmarks} className={showBookmarks ? "text-indigo-400" : "text-zinc-400 hover:text-zinc-200"} title="Saved messages">
     🔖
   </button>
   ```

### Modify: `src/components/ChatLayout.tsx`

1. Add state: `const [showBookmarks, setShowBookmarks] = useState(false);`
2. Add `"bookmarks"` to the `mobileView` union type
3. Wire up `onToggleBookmarks` and `showBookmarks` props to `ChannelHeader`
4. Close bookmarks panel on channel switch (add to existing `useEffect`)
5. Add `BookmarkedMessages` panel in the right panel rendering chain (between search and online users):
   ```
   ) : showBookmarks ? (
     <BookmarkedMessages
       onClose={() => { setShowBookmarks(false); if (mobileView === "bookmarks") setMobileView("chat"); }}
       onNavigateToChannel={(channelId) => { setActiveChannelId(channelId); setShowBookmarks(false); setMobileView("chat"); }}
     />
   ```
6. Update the right panel width logic to include `showBookmarks` in the wide panel condition
7. Update mobile view conditions for the right panel overlay to include `"bookmarks"`

## Files to Create
1. `convex/bookmarks.ts`
2. `src/components/BookmarkedMessages.tsx`

## Files to Modify
1. `convex/schema.ts` — Add `bookmarks` table
2. `src/components/MessageItem.tsx` — Add bookmark button to hover toolbar and bookmark indicator
3. `src/components/MessageList.tsx` — Query bookmarked IDs and pass to MessageItem
4. `src/components/ChannelHeader.tsx` — Add bookmarks toggle button
5. `src/components/ChatLayout.tsx` — Add bookmarks panel state and rendering

## Validation Checklist

1. `pnpm -s convex codegen` passes after schema change
2. `pnpm -s tsc -p tsconfig.json --noEmit` passes with zero errors
3. Clicking 🔖 on a message bookmarks it (visual indicator appears)
4. Clicking 🔖 again on a bookmarked message removes the bookmark
5. Bookmarks panel shows all saved messages across channels
6. Channel name shown next to each bookmarked message
7. "Remove" button in panel successfully removes bookmark
8. Bookmarks are personal — different users see different bookmarks
9. Deleted messages don't appear in bookmarks panel (gracefully skipped)
10. Mobile layout works correctly (bookmarks panel as overlay)
11. Bookmarks panel closes when switching channels
12. Right panel width is correct (w-80) when bookmarks panel is open
13. No TypeScript errors

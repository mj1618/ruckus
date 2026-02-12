# Browser Notifications for @Mentions and New Messages

## Status: DONE

## Summary

Added browser/desktop notification support so users get notified when they're @mentioned while the tab is not focused.

## Changes Made

### New Files

1. **`src/hooks/useNotifications.ts`** - Custom hook that:
   - Subscribes to `getRecentMentions` Convex query to detect cross-channel @mentions in real-time
   - Fires browser `Notification` for new mentions when tab is not focused
   - Tracks shown notification IDs to prevent duplicates
   - Manages notification permission state and dismissal (persisted in localStorage)
   - Returns `{ permissionState, requestPermission, dismissed, dismiss }` for UI

2. **`src/components/NotificationPermission.tsx`** - Permission prompt banner:
   - Shows "Get notified when you're @mentioned" with Enable/No thanks buttons
   - Only renders when `Notification.permission === "default"` and not dismissed
   - Styled with zinc theme, indigo Enable button
   - Non-intrusive, sits between ChannelHeader and MessageList

### Modified Files

3. **`convex/messages.ts`** - Added `getRecentMentions` query:
   - Takes `userId` and `since` timestamp
   - Uses the existing `search_text` search index to find messages containing `@username`
   - Filters to messages after `since` timestamp and not by the current user
   - Resolves channel names and returns them alongside mention data

4. **`src/components/ChatLayout.tsx`** - Integration:
   - Imported and wired up `useNotifications` hook
   - Rendered `NotificationPermission` banner between header and message list

## Validation

- `pnpm -s convex codegen` - passed
- `pnpm -s tsc -p tsconfig.json --noEmit` - passed, zero errors

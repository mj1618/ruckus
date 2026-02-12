# Threaded Replies - DONE

## Summary

Implemented threaded reply support allowing users to reply to specific messages in a side panel. When a user clicks "Reply in thread" on a message, a thread panel slides open on the right side showing the parent message and its replies.

## Changes Made

### Schema (`convex/schema.ts`)
- Added `parentMessageId` (optional) field to messages table for thread parent reference
- Added `replyCount` (optional) denormalized count on parent messages
- Added `latestReplyTime` (optional) timestamp of most recent reply
- Added `by_parentMessageId` index for efficient reply fetching

### Backend (`convex/messages.ts`)
- Updated `sendMessage` to accept `parentMessageId`, validate parent exists, prevent nested threads, and increment parent's `replyCount`/`latestReplyTime`
- Updated `getMessages` to filter out thread replies from main channel view, include `replyCount`/`latestReplyTime` in return
- Updated `getThreadMessages` to use `parentMessageId` arg and `by_parentMessageId` index
- Updated `deleteMessage` to decrement parent's `replyCount` when deleting a reply, and cascade-delete all replies+reactions when deleting a parent message
- Removed `getThreadSummaries` (replaced by denormalized counts)

### Frontend Components
- **MessageInput**: Added `parentMessageId` and `placeholder` props for thread reply input
- **MessageItem**: Updated to use `parentMessageId`/`replyCount` fields, shows reply count indicator, "Reply in thread" button in hover toolbar
- **MessageList**: Updated prop from `onOpenThread` to `onReplyInThread`, passes to MessageItem
- **ThreadPanel**: Updated to use `parentMessageId` prop, shows parent message + replies + reply input
- **ChatLayout**: Manages `activeThreadId` state, renders ThreadPanel replacing OnlineUsers when thread is open, closes thread on channel switch, supports mobile "thread" view

## Validation
- `pnpm -s convex codegen` succeeds
- `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- No stale references to old `threadId` naming

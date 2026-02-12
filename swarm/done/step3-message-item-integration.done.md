# Step 3: MessageItem Integration

## Source Plan
2026-02-12-18-35-00-image-file-sharing.plan.md

## Dependencies
- Step 1: Schema & Backend
- Step 2: MessageAttachments Component

## Tasks

1. Edit `src/components/MessageItem.tsx`:
   - Add `attachments` to the message interface
   - Import `MessageAttachments`
   - Render `<MessageAttachments>` below message text when attachments exist
   - Apply to all message rendering paths (normal, grouped, action, poll)

Also update related components that display messages:
- `PinnedMessages.tsx`
- `SearchPanel.tsx`

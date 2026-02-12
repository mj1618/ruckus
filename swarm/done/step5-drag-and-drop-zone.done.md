# Step 5: Drag-and-Drop Zone

## Source Plan
2026-02-12-18-35-00-image-file-sharing.plan.md

## Dependencies
- Step 4: MessageInput File Upload (for the file handling callbacks)

## Tasks

1. Edit `src/components/ChatLayout.tsx`:
   - Add `isDragOver` state and `pendingDropFiles` state
   - Add `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop` handlers to the main chat area
   - Show a blue-tinted overlay with "Drop files to upload" when dragging over
   - On drop, pass files to MessageInput via a callback prop

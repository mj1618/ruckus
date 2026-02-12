# Step 4: MessageInput File Upload

## Source Plan
2026-02-12-18-35-00-image-file-sharing.plan.md

## Dependencies
- Step 1: Schema & Backend (for generateUploadUrl mutation and sendMessage attachments arg)

## Tasks

1. Edit `src/components/MessageInput.tsx`:
   - Add `pendingFiles` state and file validation helpers
   - Add `handleFileSelect` function for the upload button
   - Add clipboard paste handler to detect images (`onPaste`)
   - Add upload button (📎) to the input bar
   - Add file preview thumbnails area above the input when files are pending (with remove button per file)
   - Modify `handleSend`: upload all pending files first, collect storageIds, then send message with attachments
   - Show uploading state with a simple indicator

### Validation
- File size <= 10MB per file
- Max 5 files per message
- Allowed types: images (jpg, png, gif, webp, svg), documents (pdf, txt, md), archives (zip)

# Step 6: Thread Panel Support

## Source Plan
2026-02-12-18-35-00-image-file-sharing.plan.md

## Dependencies
- Step 2: MessageAttachments Component
- Step 3: MessageItem Integration
- Step 4: MessageInput File Upload

## Tasks

1. Edit `src/components/ThreadPanel.tsx`:
   - Ensure the ThreadPanel's MessageItem renders attachments
   - Ensure the thread's MessageInput supports file uploads (it already uses the same component)

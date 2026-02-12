# Step 2: MessageAttachments Component

## Source Plan
2026-02-12-18-35-00-image-file-sharing.plan.md

## Dependencies
- Step 1: Schema & Backend (for type definitions)

## Tasks

1. Create `src/components/MessageAttachments.tsx`
   - Accept an array of attachment objects (with url, filename, contentType, size)
   - Render images inline with max dimensions, rounded corners, clickable to open full-size
   - Render non-image files as download cards with filename, formatted size, and download icon
   - Utility function to format bytes to human-readable string

## Interface

```typescript
interface MessageAttachmentsProps {
  attachments: Array<{
    storageId: string;
    filename: string;
    contentType: string;
    size: number;
    url: string | null;
  }>;
}
```

- For image types (`contentType.startsWith("image/")`): render an `<img>` tag with the URL, with a max-width of ~400px and rounded corners. Clicking opens the full image in a new tab.
- For non-image types: render a file card with the filename, size (human-readable like "2.3 MB"), and a download link.

# Step 1: Schema & Backend

## Source Plan
2026-02-12-18-35-00-image-file-sharing.plan.md

## Dependencies
None

## Tasks

1. Edit `convex/schema.ts`: Add `attachments` optional field to `messages` table
2. Edit `convex/messages.ts`:
   - Add `generateUploadUrl` mutation
   - Update `sendMessage` to accept and store `attachments` arg (allow empty text when attachments present)
   - Update `getMessages` to resolve storage URLs for attachments
   - Update `getThreadMessages` to resolve storage URLs for attachments
3. Run `pnpm -s convex codegen` to regenerate types

## Schema Changes

Add an `attachments` field to the `messages` table:

```typescript
attachments: v.optional(v.array(v.object({
  storageId: v.id("_storage"),
  filename: v.string(),
  contentType: v.string(),
  size: v.number(),
}))),
```

## Backend Changes

### generateUploadUrl mutation:
```typescript
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
```

### sendMessage modifications:
- Add optional `attachments` argument
- Allow empty text if there are attachments
- Validate attachments array length <= 5
- Include attachments in the insert

### getMessages / getThreadMessages modifications:
- For messages with attachments, resolve storage URLs using `ctx.storage.getUrl(storageId)`
- Include the URL in the response alongside other attachment metadata

# GIF Picker & /giphy Slash Command

## Summary

Add a GIF search and picker to Ruckus chat, allowing users to search for and send GIFs inline. This includes:
1. A `/giphy <search term>` slash command that posts a random GIF matching the search
2. A GIF picker button in the message input area that opens a search panel to browse and preview GIFs before sending
3. GIF messages render inline as animated images in the message list

Uses the Tenor API v2 (free tier, key-based, no OAuth required). A Convex `action` handles the API call server-side to keep the API key secure.

## Why This Feature

- From Phase 5 of PLAN.md: `/giphy search term` and GIF picker UI are explicitly called out
- High fun factor — GIFs are a crowd-pleaser in any chat app
- Well-scoped — touches a few files, no schema changes needed
- GIF messages are just regular messages containing a special markdown image, so they work with existing reactions, threads, pins, etc.

---

## Design Decisions

### Message Format for GIFs
GIF messages will be stored as regular messages with the text set to a markdown image: `![GIF](https://media.tenor.com/...)`. The existing `MessageText` component already renders markdown including images via `react-markdown`. We just need to make sure the `img` component in the markdown renderer renders images nicely (max width, rounded corners, loading state).

### API Choice: Tenor v2
Tenor (owned by Google) offers a free API with generous rate limits. We'll use a hardcoded API key for the demo (Tenor's free tier allows this). The search endpoint returns GIF URLs directly.

### Architecture
- **Convex action** (`convex/giphy.ts`): Calls Tenor API server-side, returns an array of GIF results (url, preview url, dimensions). This keeps the API key on the server.
- **Frontend GIF picker** (`src/components/GifPicker.tsx`): A popover/modal with a search input and a grid of GIF thumbnails. Click a GIF to send it.
- **`/giphy` command handling**: In `MessageInput.tsx`, detect `/giphy <query>`, call the Convex action to get a random GIF, and send it as a message.

---

## Tasks

### 1. Create Convex action for Tenor GIF search

**File: `convex/giphy.ts`** (NEW)

Create a Convex `action` that calls the Tenor API:

```typescript
import { v } from "convex/values";
import { action } from "./_generated/server";

export const searchGifs = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const apiKey = "AIzaSyA..."; // Tenor API key (free tier)
    const limit = args.limit ?? 20;
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(args.query)}&key=${apiKey}&client_key=ruckus_chat&media_filter=gif,tinygif&limit=${limit}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to search GIFs");
    }
    const data = await response.json();

    return (data.results ?? []).map((result: any) => ({
      id: result.id,
      title: result.title || "",
      url: result.media_formats?.gif?.url ?? "",
      previewUrl: result.media_formats?.tinygif?.url ?? "",
      width: result.media_formats?.gif?.dims?.[0] ?? 300,
      height: result.media_formats?.gif?.dims?.[1] ?? 200,
    }));
  },
});
```

**Important notes:**
- Use a free Tenor API key. Get one from the Google Cloud Console for Tenor API, or use the well-known test key `AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ` (this is a commonly used free/demo key — if it doesn't work, use any valid Tenor API key or set it as an environment variable via `TENOR_API_KEY` using `process.env.TENOR_API_KEY`).
- The `media_filter=gif,tinygif` ensures we get both the full-size GIF and a small preview.
- Return a clean array of objects with id, url, previewUrl, and dimensions.

### 2. Add `/giphy` slash command to MessageInput

**File: `src/components/SlashCommandHint.tsx`** (MODIFY)

Add the `/giphy` command to the `SLASH_COMMANDS` array:
```typescript
{ command: "/giphy", args: "search term", description: "Send a random GIF" },
```

**File: `src/components/MessageInput.tsx`** (MODIFY)

In the `handleSend` function, add a new branch before the default `sendMessage` call:

```typescript
} else if (trimmed.toLowerCase().startsWith("/giphy ")) {
  const query = trimmed.slice(7).trim();
  if (!query) throw new Error("/giphy requires a search term");

  // Fetch a random GIF from Tenor
  const results = await searchGifsAction({ query, limit: 8 });
  if (results.length === 0) throw new Error("No GIFs found for: " + query);

  // Pick a random one
  const gif = results[Math.floor(Math.random() * results.length)];

  // Send as a message with an image markdown
  await sendMessage({
    channelId,
    userId: user._id,
    text: `![GIF](${gif.url})`,
    ...(parentMessageId ? { parentMessageId } : {}),
  });
}
```

Import the action:
```typescript
import { useAction } from "convex/react";
// ...
const searchGifsAction = useAction(api.giphy.searchGifs);
```

### 3. Create GIF Picker component

**File: `src/components/GifPicker.tsx`** (NEW)

A floating popover component that:
- Has a search input at the top
- Shows a masonry-style grid of GIF thumbnails (using `previewUrl` for fast loading)
- Debounces search input (300ms)
- On click, calls `onSelect(gifUrl)` callback with the full-size GIF URL
- Shows a loading spinner while searching
- Shows "Type to search for GIFs" when empty, "No results" when search returns empty
- Has a "Powered by Tenor" attribution (required by Tenor TOS)
- Closes on click-outside or Escape key
- Positioned above the message input (like the emoji picker)

```tsx
interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}
```

Component structure:
```tsx
<div className="absolute bottom-full right-0 z-50 mb-2 w-[340px] h-[400px] flex flex-col rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
  {/* Search input */}
  <div className="p-2 border-b border-zinc-700">
    <input
      type="text"
      placeholder="Search GIFs..."
      className="w-full rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500"
      autoFocus
    />
  </div>

  {/* GIF grid - scrollable */}
  <div className="flex-1 overflow-y-auto p-2">
    {/* Grid of GIF thumbnails, 2 columns */}
    <div className="grid grid-cols-2 gap-1">
      {results.map(gif => (
        <button key={gif.id} onClick={() => onSelect(gif.url)} className="overflow-hidden rounded hover:ring-2 hover:ring-indigo-500">
          <img src={gif.previewUrl} alt={gif.title} className="w-full object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  </div>

  {/* Tenor attribution */}
  <div className="border-t border-zinc-700 px-2 py-1 text-center text-xs text-zinc-500">
    Powered by Tenor
  </div>
</div>
```

Use `useAction(api.giphy.searchGifs)` to fetch GIFs. Debounce the search input with a `useRef` + `setTimeout` pattern (300ms).

Handle click-outside with a `useEffect` that adds a `mousedown` event listener (same pattern as `EmojiPicker.tsx`).

### 4. Add GIF picker button to MessageInput

**File: `src/components/MessageInput.tsx`** (MODIFY)

Add a GIF button next to the Send button in the input area:

```tsx
import { GifPicker } from "@/components/GifPicker";
// ...
const [showGifPicker, setShowGifPicker] = useState(false);

// In the handleGifSelect function:
async function handleGifSelect(gifUrl: string) {
  if (!user) return;
  setShowGifPicker(false);
  await sendMessage({
    channelId,
    userId: user._id,
    text: `![GIF](${gifUrl})`,
    ...(parentMessageId ? { parentMessageId } : {}),
  });
}
```

In the JSX, add the GIF picker trigger and popover:
```tsx
{/* Before the Send button, inside the flex items-center gap-2 div */}
<div className="relative">
  <button
    type="button"
    className="text-zinc-400 hover:text-zinc-200 text-sm px-1"
    onClick={() => setShowGifPicker(v => !v)}
    title="Send a GIF"
  >
    GIF
  </button>
  {showGifPicker && (
    <GifPicker
      onSelect={handleGifSelect}
      onClose={() => setShowGifPicker(false)}
    />
  )}
</div>
```

### 5. Ensure GIF images render nicely in MessageText

**File: `src/components/MessageText.tsx`** (MODIFY)

Add a custom `img` component to the `markdownComponents` object so that GIF images (and any markdown images) render with a max width, rounded corners, and proper sizing:

```typescript
img: ({ src, alt }) => (
  <img
    src={src}
    alt={alt ?? ""}
    className="my-1 max-w-[300px] rounded-lg"
    loading="lazy"
  />
),
```

This will make GIF messages (which are `![GIF](url)` markdown) render as nice inline images. The existing markdown pipeline handles the rest.

---

## Validation Steps

1. Run `pnpm -s convex codegen` to generate types for the new `giphy.ts` action
2. Run `pnpm -s tsc -p tsconfig.json --noEmit` to verify no TypeScript errors
3. Test visually:
   - Type `/giphy cats` and verify a random cat GIF is posted as a message
   - Click the GIF button, search for "hello", click a result, verify it posts
   - Verify GIF images render inline with proper sizing
   - Verify GIFs work in threads
   - Verify reactions, pins, etc. work on GIF messages
   - Test on mobile to ensure the GIF picker is usable

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `convex/giphy.ts` | NEW | Tenor API search action |
| `src/components/GifPicker.tsx` | NEW | GIF search and picker popover |
| `src/components/MessageText.tsx` | MODIFY | Add `img` markdown component for inline images |
| `src/components/MessageInput.tsx` | MODIFY | Add `/giphy` command handling and GIF picker button |
| `src/components/SlashCommandHint.tsx` | MODIFY | Add `/giphy` to slash commands list |

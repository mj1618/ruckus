import { v } from "convex/values";
import { action } from "./_generated/server";

export const searchGifs = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const apiKey =
      process.env.TENOR_API_KEY ?? "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ";
    const limit = args.limit ?? 20;
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(args.query)}&key=${apiKey}&client_key=ruckus_chat&media_filter=gif,tinygif&limit=${limit}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to search GIFs");
    }
    const data = await response.json();

    return ((data.results as Array<Record<string, unknown>>) ?? []).map(
      (result) => ({
        id: result.id as string,
        title: (result.title as string) || "",
        url:
          (
            (result.media_formats as Record<string, Record<string, unknown>>)
              ?.gif?.url as string
          ) ?? "",
        previewUrl:
          (
            (result.media_formats as Record<string, Record<string, unknown>>)
              ?.tinygif?.url as string
          ) ?? "",
        width:
          (
            (result.media_formats as Record<string, Record<string, unknown>>)
              ?.gif?.dims as number[]
          )?.[0] ?? 300,
        height:
          (
            (result.media_formats as Record<string, Record<string, unknown>>)
              ?.gif?.dims as number[]
          )?.[1] ?? 200,
      })
    );
  },
});

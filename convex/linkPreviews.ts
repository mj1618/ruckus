import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const fetchLinkPreview = internalAction({
  args: {
    messageId: v.id("messages"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(args.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)",
          Accept: "text/html",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return;
      }

      // Limit to first 50KB
      const reader = response.body?.getReader();
      if (!reader) return;

      let html = "";
      const decoder = new TextDecoder();
      let totalBytes = 0;
      const maxBytes = 50 * 1024;

      while (totalBytes < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel();

      // Parse Open Graph and meta tags using regex
      function getMetaContent(property: string): string | undefined {
        // og: properties
        const ogMatch = html.match(
          new RegExp(
            `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
            "i"
          )
        );
        if (ogMatch) return ogMatch[1];

        // Reversed attribute order
        const reverseMatch = html.match(
          new RegExp(
            `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
            "i"
          )
        );
        if (reverseMatch) return reverseMatch[1];

        return undefined;
      }

      const title =
        getMetaContent("og:title") ||
        html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
      const description =
        getMetaContent("og:description") ||
        getMetaContent("description");
      const imageUrl = getMetaContent("og:image");
      const siteName = getMetaContent("og:site_name");
      const domain = new URL(args.url).hostname;

      // Only save if we got at least a title
      if (!title && !description) return;

      await ctx.runMutation(internal.linkPreviews.saveLinkPreview, {
        messageId: args.messageId,
        url: args.url,
        title: title || undefined,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        siteName: siteName || undefined,
        domain,
      });
    } catch {
      // Silently fail — no preview is fine
    }
  },
});

export const saveLinkPreview = internalMutation({
  args: {
    messageId: v.id("messages"),
    url: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    siteName: v.optional(v.string()),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for existing preview for this messageId + url
    const existing = await ctx.db
      .query("linkPreviews")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .filter((q) => q.eq(q.field("url"), args.url))
      .first();

    if (existing) return;

    await ctx.db.insert("linkPreviews", {
      messageId: args.messageId,
      url: args.url,
      title: args.title,
      description: args.description,
      imageUrl: args.imageUrl,
      siteName: args.siteName,
      domain: args.domain,
      fetchedAt: Date.now(),
    });
  },
});

export const getLinkPreviews = query({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const allPreviews = await Promise.all(
      args.messageIds.map((messageId) =>
        ctx.db
          .query("linkPreviews")
          .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
          .collect()
      )
    );

    return allPreviews.flat().map((p) => ({
      messageId: p.messageId,
      url: p.url,
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      siteName: p.siteName,
      domain: p.domain,
    }));
  },
});

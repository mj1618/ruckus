import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const toggleBookmark = mutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_messageId", (q) =>
        q.eq("userId", args.userId).eq("messageId", args.messageId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete("bookmarks", existing._id);
      return;
    }

    const message = await ctx.db.get("messages", args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    await ctx.db.insert("bookmarks", {
      userId: args.userId,
      messageId: args.messageId,
      channelId: message.channelId,
      savedAt: Date.now(),
    });
  },
});

export const getBookmarks = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100);

    const results = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const message = await ctx.db.get("messages", bookmark.messageId);
        if (!message) return null;

        const [user, channel] = await Promise.all([
          ctx.db.get("users", message.userId),
          ctx.db.get("channels", bookmark.channelId),
        ]);

        return {
          bookmark: { _id: bookmark._id, savedAt: bookmark.savedAt },
          message: {
            _id: message._id,
            text: message.text,
            _creationTime: message._creationTime,
            user: user
              ? {
                  username: user.username,
                  avatarColor: user.avatarColor,
                }
              : {
                  username: "Unknown",
                  avatarColor: "#6b7280",
                },
            channelId: bookmark.channelId,
            channelName: channel?.name ?? "unknown",
          },
        };
      })
    );

    return results.filter((r) => r !== null);
  },
});

export const getBookmarkedMessageIds = query({
  args: {
    userId: v.id("users"),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return bookmarks
      .filter((b) => b.channelId === args.channelId)
      .map((b) => b.messageId);
  },
});

export const removeBookmark = mutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId_messageId", (q) =>
        q.eq("userId", args.userId).eq("messageId", args.messageId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete("bookmarks", existing._id);
    }
  },
});

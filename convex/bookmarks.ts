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
      ...(message.channelId ? { channelId: message.channelId } : {}),
      ...(message.conversationId ? { conversationId: message.conversationId } : {}),
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

        const user = await ctx.db.get("users", message.userId);

        // Get channel or conversation info
        let channelName: string | undefined;
        let conversationUser: { _id: string; username: string } | undefined;

        if (bookmark.channelId) {
          const channel = await ctx.db.get("channels", bookmark.channelId);
          channelName = channel?.name;
        } else if (bookmark.conversationId) {
          const conversation = await ctx.db.get("conversations", bookmark.conversationId);
          if (conversation) {
            // Get the other participant
            const otherUserId = conversation.participant1 === args.userId
              ? conversation.participant2
              : conversation.participant1;
            const otherUser = await ctx.db.get("users", otherUserId);
            if (otherUser) {
              conversationUser = { _id: otherUser._id, username: otherUser.username };
            }
          }
        }

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
                avatarUrl: user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null,
              }
              : {
                username: "Unknown",
                avatarColor: "#6b7280",
                avatarUrl: null,
              },
            channelId: bookmark.channelId,
            channelName,
            conversationId: bookmark.conversationId,
            conversationUser,
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
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    if (args.channelId) {
      return bookmarks
        .filter((b) => b.channelId === args.channelId)
        .map((b) => b.messageId);
    } else if (args.conversationId) {
      return bookmarks
        .filter((b) => b.conversationId === args.conversationId)
        .map((b) => b.messageId);
    }

    return bookmarks.map((b) => b.messageId);
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

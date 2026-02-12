import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const setTyping = mutation({
  args: {
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate that exactly one of channelId or conversationId is provided
    if (!args.channelId && !args.conversationId) {
      throw new Error("Either channelId or conversationId must be provided");
    }
    if (args.channelId && args.conversationId) {
      throw new Error("Cannot specify both channelId and conversationId");
    }

    if (args.channelId) {
      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .unique();

      if (existing) {
        await ctx.db.patch("typingIndicators", existing._id, {
          expiresAt: Date.now() + 3000,
        });
      } else {
        await ctx.db.insert("typingIndicators", {
          channelId: args.channelId,
          userId: args.userId,
          expiresAt: Date.now() + 3000,
        });
      }
    } else {
      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .unique();

      if (existing) {
        await ctx.db.patch("typingIndicators", existing._id, {
          expiresAt: Date.now() + 3000,
        });
      } else {
        await ctx.db.insert("typingIndicators", {
          conversationId: args.conversationId,
          userId: args.userId,
          expiresAt: Date.now() + 3000,
        });
      }
    }
  },
});

export const clearTyping = mutation({
  args: {
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate that exactly one of channelId or conversationId is provided
    if (!args.channelId && !args.conversationId) {
      throw new Error("Either channelId or conversationId must be provided");
    }
    if (args.channelId && args.conversationId) {
      throw new Error("Cannot specify both channelId and conversationId");
    }

    if (args.channelId) {
      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .unique();

      if (existing) {
        await ctx.db.delete("typingIndicators", existing._id);
      }
    } else {
      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .unique();

      if (existing) {
        await ctx.db.delete("typingIndicators", existing._id);
      }
    }
  },
});

export const getTypingUsers = query({
  args: {
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    // Validate that exactly one of channelId or conversationId is provided
    if (!args.channelId && !args.conversationId) {
      throw new Error("Either channelId or conversationId must be provided");
    }
    if (args.channelId && args.conversationId) {
      throw new Error("Cannot specify both channelId and conversationId");
    }

    const now = Date.now();
    let indicators;

    if (args.channelId) {
      indicators = await ctx.db
        .query("typingIndicators")
        .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
        .filter((q) => q.gt(q.field("expiresAt"), now))
        .collect();
    } else {
      indicators = await ctx.db
        .query("typingIndicators")
        .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
        .filter((q) => q.gt(q.field("expiresAt"), now))
        .collect();
    }

    const users = await Promise.all(
      indicators.map((ind) => ctx.db.get("users", ind.userId))
    );

    return users
      .filter((u) => u !== null)
      .map((u) => ({
        _id: u._id,
        username: u.username,
      }));
  },
});

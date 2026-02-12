import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const emoji = args.emoji.trim();
    if (emoji.length === 0 || emoji.length > 10) {
      throw new Error("Invalid emoji");
    }

    // Check if this user already reacted with this emoji
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_messageId_emoji", (q) =>
        q.eq("messageId", args.messageId).eq("emoji", emoji)
      )
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .unique();

    if (existing) {
      await ctx.db.delete("reactions", existing._id);
    } else {
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        userId: args.userId,
        emoji,
      });
    }
  },
});

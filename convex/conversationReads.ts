import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const markConversationRead = mutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { userId, conversationId }) => {
    const existing = await ctx.db
      .query("conversationReads")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", conversationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch("conversationReads", existing._id, {
        lastReadTime: Date.now(),
      });
    } else {
      await ctx.db.insert("conversationReads", {
        userId,
        conversationId,
        lastReadTime: Date.now(),
      });
    }
  },
});

export const getUnreadCounts = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Find all conversations where the user is a participant
    const [asParticipant1, asParticipant2] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_participant1", (q) => q.eq("participant1", userId))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_participant2", (q) => q.eq("participant2", userId))
        .collect(),
    ]);

    const allConversations = [...asParticipant1, ...asParticipant2];

    // Get all read records for this user
    const reads = await ctx.db
      .query("conversationReads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const readMap = new Map(
      reads.map((r) => [r.conversationId, r.lastReadTime])
    );

    const counts = await Promise.all(
      allConversations.map(async (conversation) => {
        const lastReadTime = readMap.get(conversation._id);
        let msgs;
        if (lastReadTime !== undefined) {
          msgs = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) =>
              q.eq("conversationId", conversation._id)
            )
            .filter((q) => q.gt(q.field("_creationTime"), lastReadTime))
            .collect();
        } else {
          msgs = await ctx.db
            .query("messages")
            .withIndex("by_conversationId", (q) =>
              q.eq("conversationId", conversation._id)
            )
            .collect();
        }
        return { conversationId: conversation._id, unreadCount: msgs.length };
      })
    );

    return counts.filter((c) => c.unreadCount > 0);
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const markChannelRead = mutation({
  args: {
    userId: v.id("users"),
    channelId: v.id("channels"),
  },
  handler: async (ctx, { userId, channelId }) => {
    const existing = await ctx.db
      .query("channelReads")
      .withIndex("by_user_channel", (q) =>
        q.eq("userId", userId).eq("channelId", channelId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch("channelReads", existing._id, {
        lastReadTime: Date.now(),
      });
    } else {
      await ctx.db.insert("channelReads", {
        userId,
        channelId,
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
    const [channels, reads] = await Promise.all([
      ctx.db.query("channels").collect(),
      ctx.db
        .query("channelReads")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const readMap = new Map(
      reads.map((r) => [r.channelId, r.lastReadTime])
    );

    const counts = await Promise.all(
      channels.map(async (channel) => {
        const lastReadTime = readMap.get(channel._id);
        let msgs;
        if (lastReadTime !== undefined) {
          msgs = await ctx.db
            .query("messages")
            .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
            .filter((q) => q.gt(q.field("_creationTime"), lastReadTime))
            .collect();
        } else {
          msgs = await ctx.db
            .query("messages")
            .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
            .collect();
        }
        return { channelId: channel._id, unreadCount: msgs.length };
      })
    );

    return counts.filter((c) => c.unreadCount > 0);
  },
});

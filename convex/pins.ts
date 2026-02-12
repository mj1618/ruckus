import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const pinMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if already pinned
    const existing = await ctx.db
      .query("pinnedMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (existing) {
      throw new Error("Message is already pinned");
    }

    await ctx.db.insert("pinnedMessages", {
      messageId: args.messageId,
      channelId: message.channelId,
      pinnedBy: args.userId,
      pinnedAt: Date.now(),
    });
  },
});

export const unpinMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const pin = await ctx.db
      .query("pinnedMessages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!pin) return;

    await ctx.db.delete("pinnedMessages", pin._id);
  },
});

export const getPinnedMessages = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const pins = await ctx.db
      .query("pinnedMessages")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Fetch messages, users, and reactions in parallel
    const results = await Promise.all(
      pins.map(async (pin) => {
        const message = await ctx.db.get("messages", pin.messageId);
        if (!message) return null;

        const [user, pinnedByUser, reactions] = await Promise.all([
          ctx.db.get("users", message.userId),
          ctx.db.get("users", pin.pinnedBy),
          ctx.db
            .query("reactions")
            .withIndex("by_messageId", (q) => q.eq("messageId", message._id))
            .collect(),
        ]);

        // Build reaction summary
        const emojiMap = new Map<
          string,
          { userIds: string[]; usernames: string[] }
        >();
        // Collect unique reactor user IDs
        const reactorUserIds = [
          ...new Set(reactions.map((r) => r.userId)),
        ];
        const reactorUsers = await Promise.all(
          reactorUserIds.map((id) => ctx.db.get("users", id))
        );
        const reactorMap = new Map(
          reactorUsers
            .filter((u) => u !== null)
            .map((u) => [u._id, u.username])
        );

        for (const r of reactions) {
          const username = reactorMap.get(r.userId) ?? "Unknown";
          const existing = emojiMap.get(r.emoji);
          if (existing) {
            existing.userIds.push(r.userId);
            existing.usernames.push(username);
          } else {
            emojiMap.set(r.emoji, {
              userIds: [r.userId],
              usernames: [username],
            });
          }
        }

        return {
          pin: {
            _id: pin._id,
            pinnedAt: pin.pinnedAt,
            pinnedByUsername: pinnedByUser?.username ?? "Unknown",
          },
          message: {
            _id: message._id,
            text: message.text,
            _creationTime: message._creationTime,
            editedAt: message.editedAt,
            replyCount: message.replyCount,
            latestReplyTime: message.latestReplyTime,
            user: user
              ? {
                  _id: user._id,
                  username: user.username,
                  avatarColor: user.avatarColor,
                }
              : {
                  _id: message.userId,
                  username: "Unknown",
                  avatarColor: "#6b7280",
                },
            reactions: Array.from(emojiMap.entries()).map(([emoji, data]) => ({
              emoji,
              count: data.userIds.length,
              userIds: data.userIds,
              usernames: data.usernames,
            })),
          },
        };
      })
    );

    // Filter nulls (deleted messages) and sort by pinnedAt descending
    return results
      .filter((r) => r !== null)
      .sort((a, b) => b.pin.pinnedAt - a.pin.pinnedAt);
  },
});

export const getPinnedMessageIds = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const pins = await ctx.db
      .query("pinnedMessages")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();

    return pins.map((p) => p.messageId);
  },
});

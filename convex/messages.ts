import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const sendMessage = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    await ctx.db.insert("messages", {
      channelId: args.channelId,
      userId: args.userId,
      text,
    });

    // Clear typing indicator for this user in this channel
    const typingIndicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .unique();

    if (typingIndicator) {
      await ctx.db.delete("typingIndicators", typingIndicator._id);
    }
  },
});

export const getMessages = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(100);

    // Reverse to get ascending order
    messages.reverse();

    // Fetch user info for each message
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get("users", id))
    );
    const userMap = new Map(
      users
        .filter((u) => u !== null)
        .map((u) => [u._id, { _id: u._id, username: u.username, avatarColor: u.avatarColor }])
    );

    // Fetch reactions for all messages in parallel
    const allReactions = await Promise.all(
      messages.map((m) =>
        ctx.db
          .query("reactions")
          .withIndex("by_messageId", (q) => q.eq("messageId", m._id))
          .collect()
      )
    );

    // Fetch unique reactor user info (reuse from userMap if already present)
    const reactorUserIds = [
      ...new Set(allReactions.flat().map((r) => r.userId)),
    ];
    const missingReactorIds = reactorUserIds.filter((id) => !userMap.has(id));
    if (missingReactorIds.length > 0) {
      const reactorUsers = await Promise.all(
        missingReactorIds.map((id) => ctx.db.get("users", id))
      );
      for (const u of reactorUsers) {
        if (u) {
          userMap.set(u._id, { _id: u._id, username: u.username, avatarColor: u.avatarColor });
        }
      }
    }

    return messages.map((m, i) => {
      const msgReactions = allReactions[i];
      const emojiMap = new Map<string, { userIds: string[]; usernames: string[] }>();
      for (const r of msgReactions) {
        const username = userMap.get(r.userId)?.username ?? "Unknown";
        const existing = emojiMap.get(r.emoji);
        if (existing) {
          existing.userIds.push(r.userId);
          existing.usernames.push(username);
        } else {
          emojiMap.set(r.emoji, { userIds: [r.userId], usernames: [username] });
        }
      }
      const reactions = Array.from(emojiMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.userIds.length,
        userIds: data.userIds,
        usernames: data.usernames,
      }));

      return {
        _id: m._id,
        text: m.text,
        _creationTime: m._creationTime,
        user: userMap.get(m.userId) ?? {
          _id: m.userId,
          username: "Unknown",
          avatarColor: "#6b7280",
        },
        reactions,
      };
    });
  },
});

import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const searchMessages = query({
  args: {
    query: v.string(),
    channelId: v.optional(v.id("channels")),
    conversationId: v.optional(v.id("conversations")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (args.query.trim().length === 0) return [];

    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_text", (q) => {
        const search = q.search("text", args.query);
        if (args.channelId) {
          return search.eq("channelId", args.channelId);
        }
        if (args.conversationId) {
          return search.eq("conversationId", args.conversationId);
        }
        return search;
      })
      .take(30);

    const userIds = [...new Set(results.map((m) => m.userId))];
    const channelIds = [...new Set(results.map((m) => m.channelId).filter((id): id is Id<"channels"> => id !== undefined))];
    const conversationIds = [...new Set(results.map((m) => m.conversationId).filter((id): id is Id<"conversations"> => id !== undefined))];

    const [users, channels, conversations] = await Promise.all([
      Promise.all(userIds.map((id) => ctx.db.get("users", id))),
      Promise.all(channelIds.map((id) => ctx.db.get("channels", id))),
      Promise.all(conversationIds.map((id) => ctx.db.get("conversations", id))),
    ]);

    const channelMap = new Map(
      channels.filter(Boolean).map((c) => [c!._id, { name: c!.name }])
    );

    const conversationMap = new Map(
      conversations.filter(Boolean).map((c) => [c!._id, c!])
    );

    // Filter results to only show accessible messages
    // For conversations, only show if the user is a participant
    const accessibleResults = args.userId
      ? results.filter((m) => {
        if (m.conversationId) {
          const conv = conversationMap.get(m.conversationId);
          if (!conv) return false;
          return conv.participant1 === args.userId || conv.participant2 === args.userId;
        }
        return true; // Channel messages are accessible
      })
      : results.filter((m) => !m.conversationId); // Without userId, only show channel messages

    const userMap = new Map(
      await Promise.all(
        users.filter(Boolean).map(async (u) => [
          u!._id,
          {
            username: u!.username,
            avatarColor: u!.avatarColor,
            avatarUrl: u!.avatarStorageId ? await ctx.storage.getUrl(u!.avatarStorageId) : null,
          }
        ] as const)
      )
    );

    // Get other user info for DM results
    const dmUserPromises = accessibleResults
      .filter((m) => m.conversationId)
      .map(async (m) => {
        const conv = conversationMap.get(m.conversationId!);
        if (!conv || !args.userId) return null;
        const otherUserId = conv.participant1 === args.userId ? conv.participant2 : conv.participant1;
        const otherUser = await ctx.db.get("users", otherUserId);
        return otherUser ? { conversationId: m.conversationId!, otherUsername: otherUser.username } : null;
      });

    const dmUsers = (await Promise.all(dmUserPromises)).filter(Boolean);
    const dmUserMap = new Map(dmUsers.map((d) => [d!.conversationId, d!.otherUsername]));

    return accessibleResults.map((m) => ({
      _id: m._id,
      text: m.text,
      channelId: m.channelId,
      conversationId: m.conversationId,
      channelName: m.channelId ? (channelMap.get(m.channelId)?.name ?? "unknown") : undefined,
      dmUsername: m.conversationId ? dmUserMap.get(m.conversationId) : undefined,
      username: userMap.get(m.userId)?.username ?? "Unknown",
      avatarColor: userMap.get(m.userId)?.avatarColor ?? "#6b7280",
      avatarUrl: userMap.get(m.userId)?.avatarUrl ?? null,
      parentMessageId: m.parentMessageId,
      _creationTime: m._creationTime,
    }));
  },
});

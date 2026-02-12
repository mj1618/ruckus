import { v } from "convex/values";
import { query } from "./_generated/server";

export const searchMessages = query({
  args: {
    query: v.string(),
    channelId: v.optional(v.id("channels")),
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
        return search;
      })
      .take(30);

    const userIds = [...new Set(results.map((m) => m.userId))];
    const channelIds = [...new Set(results.map((m) => m.channelId))];

    const [users, channels] = await Promise.all([
      Promise.all(userIds.map((id) => ctx.db.get("users", id))),
      Promise.all(channelIds.map((id) => ctx.db.get("channels", id))),
    ]);

    const userMap = new Map(
      users.filter(Boolean).map((u) => [u!._id, { username: u!.username, avatarColor: u!.avatarColor }])
    );
    const channelMap = new Map(
      channels.filter(Boolean).map((c) => [c!._id, { name: c!.name }])
    );

    return results.map((m) => ({
      _id: m._id,
      text: m.text,
      channelId: m.channelId,
      channelName: channelMap.get(m.channelId)?.name ?? "unknown",
      username: userMap.get(m.userId)?.username ?? "Unknown",
      avatarColor: userMap.get(m.userId)?.avatarColor ?? "#6b7280",
      parentMessageId: m.parentMessageId,
      _creationTime: m._creationTime,
    }));
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const sendMessage = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    text: v.string(),
    parentMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    // Handle slash commands
    let messageText = text;
    let messageType: "action" | undefined = undefined;

    if (text.startsWith("/")) {
      const spaceIndex = text.indexOf(" ");
      const command = (spaceIndex === -1 ? text : text.slice(0, spaceIndex)).toLowerCase();

      if (command === "/me") {
        const actionText = text.slice(4).trim();
        if (!actionText) throw new Error("/me requires action text");
        messageText = actionText;
        messageType = "action";
      } else if (command === "/shrug") {
        const prefix = text.slice(6).trim();
        messageText = prefix ? `${prefix} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯";
      }
    }

    let channelId = args.channelId;
    if (args.parentMessageId) {
      const parent = await ctx.db.get("messages", args.parentMessageId);
      if (!parent) throw new Error("Parent message not found");
      channelId = parent.channelId;
      if (parent.parentMessageId) {
        throw new Error(
          "Cannot reply to a thread reply — reply to the parent message instead"
        );
      }

      await ctx.db.patch("messages", args.parentMessageId, {
        replyCount: (parent.replyCount ?? 0) + 1,
        latestReplyTime: Date.now(),
      });
    }

    await ctx.db.insert("messages", {
      channelId,
      userId: args.userId,
      text: messageText,
      ...(messageType ? { type: messageType } : {}),
      ...(args.parentMessageId
        ? { parentMessageId: args.parentMessageId }
        : {}),
    });

    // Clear typing indicator for this user in this channel
    const typingIndicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
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
      .take(200);

    // Reverse to get ascending order
    messages.reverse();

    // Filter out thread replies — they should only appear in the thread panel
    const topLevelMessages = messages.filter((m) => !m.parentMessageId);

    // Fetch user info for each message
    const userIds = [...new Set(topLevelMessages.map((m) => m.userId))];
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get("users", id))
    );
    const userMap = new Map(
      users
        .filter((u) => u !== null)
        .map((u) => [
          u._id,
          { _id: u._id, username: u.username, avatarColor: u.avatarColor, statusEmoji: u.statusEmoji, statusText: u.statusText },
        ])
    );

    // Fetch reactions for all messages in parallel
    const allReactions = await Promise.all(
      topLevelMessages.map((m) =>
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
    const missingUserIds = reactorUserIds.filter((id) => !userMap.has(id));
    if (missingUserIds.length > 0) {
      const extraUsers = await Promise.all(
        missingUserIds.map((id) => ctx.db.get("users", id))
      );
      for (const u of extraUsers) {
        if (u) {
          userMap.set(u._id, {
            _id: u._id,
            username: u.username,
            avatarColor: u.avatarColor,
            statusEmoji: u.statusEmoji,
            statusText: u.statusText,
          });
        }
      }
    }

    return topLevelMessages.map((m, i) => {
      const msgReactions = allReactions[i];
      const emojiMap = new Map<
        string,
        { userIds: string[]; usernames: string[] }
      >();
      for (const r of msgReactions) {
        const username = userMap.get(r.userId)?.username ?? "Unknown";
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
        editedAt: m.editedAt,
        replyCount: m.replyCount,
        latestReplyTime: m.latestReplyTime,
        type: m.type,
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

export const getThreadMessages = query({
  args: {
    parentMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get("messages", args.parentMessageId);
    if (!parent) return null;

    const parentUser = await ctx.db.get("users", parent.userId);

    // Get all replies
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_parentMessageId", (q) =>
        q.eq("parentMessageId", args.parentMessageId)
      )
      .order("asc")
      .take(200);

    // Fetch user info for all replies
    const userIds = [...new Set(replies.map((m) => m.userId))];
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get("users", id))
    );
    const userMap = new Map(
      users
        .filter((u) => u !== null)
        .map((u) => [
          u._id,
          { _id: u._id, username: u.username, avatarColor: u.avatarColor, statusEmoji: u.statusEmoji, statusText: u.statusText },
        ])
    );

    if (parentUser) {
      userMap.set(parentUser._id, {
        _id: parentUser._id,
        username: parentUser.username,
        avatarColor: parentUser.avatarColor,
        statusEmoji: parentUser.statusEmoji,
        statusText: parentUser.statusText,
      });
    }

    // Fetch reactions for all messages (parent + replies)
    const allMessages = [parent, ...replies];
    const allReactions = await Promise.all(
      allMessages.map((m) =>
        ctx.db
          .query("reactions")
          .withIndex("by_messageId", (q) => q.eq("messageId", m._id))
          .collect()
      )
    );

    // Fetch reactor user info
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
          userMap.set(u._id, {
            _id: u._id,
            username: u.username,
            avatarColor: u.avatarColor,
            statusEmoji: u.statusEmoji,
            statusText: u.statusText,
          });
        }
      }
    }

    function formatMessage(
      m: typeof parent,
      reactions: (typeof allReactions)[0]
    ) {
      const emojiMap = new Map<
        string,
        { userIds: string[]; usernames: string[] }
      >();
      for (const r of reactions) {
        const username = userMap.get(r.userId)?.username ?? "Unknown";
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
        _id: m!._id,
        text: m!.text,
        _creationTime: m!._creationTime,
        editedAt: m!.editedAt,
        replyCount: m!.replyCount,
        parentMessageId: m!.parentMessageId,
        type: m!.type,
        user: userMap.get(m!.userId) ?? {
          _id: m!.userId,
          username: "Unknown",
          avatarColor: "#6b7280",
        },
        reactions: Array.from(emojiMap.entries()).map(([emoji, data]) => ({
          emoji,
          count: data.userIds.length,
          userIds: data.userIds,
          usernames: data.usernames,
        })),
      };
    }

    return {
      parent: formatMessage(parent, allReactions[0]),
      replies: replies.map((r, i) => formatMessage(r, allReactions[i + 1])),
    };
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    if (message.userId !== args.userId) {
      throw new Error("You can only edit your own messages");
    }

    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    await ctx.db.patch("messages", args.messageId, {
      text,
      editedAt: Date.now(),
    });
  },
});

export const getRecentMentions = query({
  args: {
    userId: v.id("users"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) return [];

    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_text", (q) =>
        q.search("text", `@${user.username}`)
      )
      .take(20);

    const filtered = results.filter(
      (m) => m._creationTime > args.since && m.userId !== args.userId
    );

    const channelIds = [...new Set(filtered.map((m) => m.channelId))];
    const channels = await Promise.all(
      channelIds.map((id) => ctx.db.get("channels", id))
    );
    const channelMap = new Map(
      channels
        .filter((c) => c !== null)
        .map((c) => [c._id, c.name])
    );

    return filtered.map((m) => ({
      _id: m._id,
      channelId: m.channelId,
      channelName: channelMap.get(m.channelId) ?? "unknown",
      text: m.text,
      _creationTime: m._creationTime,
    }));
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    if (message.userId !== args.userId) {
      throw new Error("You can only delete your own messages");
    }

    // If this is a thread reply, decrement the parent's replyCount
    if (message.parentMessageId) {
      const parent = await ctx.db.get("messages", message.parentMessageId);
      if (parent && (parent.replyCount ?? 0) > 0) {
        await ctx.db.patch("messages", message.parentMessageId, {
          replyCount: (parent.replyCount ?? 0) - 1,
        });
      }
    }

    // If this is a parent message with replies, delete all replies and their reactions
    if (message.replyCount && message.replyCount > 0) {
      const replies = await ctx.db
        .query("messages")
        .withIndex("by_parentMessageId", (q) =>
          q.eq("parentMessageId", args.messageId)
        )
        .collect();

      await Promise.all(
        replies.map(async (reply) => {
          const replyReactions = await ctx.db
            .query("reactions")
            .withIndex("by_messageId", (q) => q.eq("messageId", reply._id))
            .collect();
          await Promise.all(
            replyReactions.map((r) => ctx.db.delete("reactions", r._id))
          );
          await ctx.db.delete("messages", reply._id);
        })
      );
    }

    // Delete all reactions for this message
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .collect();

    await Promise.all(
      reactions.map((r) => ctx.db.delete("reactions", r._id))
    );

    await ctx.db.delete("messages", args.messageId);
  },
});

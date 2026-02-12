import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to order participant IDs consistently (lower ID first)
function orderParticipants(
  userId1: Id<"users">,
  userId2: Id<"users">
): [Id<"users">, Id<"users">] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}

export const getOrCreateConversation = mutation({
  args: {
    userId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { userId, otherUserId }) => {
    if (userId === otherUserId) {
      throw new Error("Cannot create a conversation with yourself");
    }

    const [participant1, participant2] = orderParticipants(userId, otherUserId);

    // Check if conversation already exists
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_participants", (q) =>
        q.eq("participant1", participant1).eq("participant2", participant2)
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      participant1,
      participant2,
      lastMessageTime: undefined,
    });

    return conversationId;
  },
});

export const listConversations = query({
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

    // Sort by lastMessageTime (most recent first), then by creation time
    allConversations.sort((a, b) => {
      const aTime = a.lastMessageTime ?? a._creationTime;
      const bTime = b.lastMessageTime ?? b._creationTime;
      return bTime - aTime;
    });

    // Get the other participant's info for each conversation
    const conversationsWithUsers = await Promise.all(
      allConversations.map(async (conv) => {
        const otherUserId =
          conv.participant1 === userId ? conv.participant2 : conv.participant1;
        const otherUser = await ctx.db.get("users", otherUserId);

        return {
          _id: conv._id,
          _creationTime: conv._creationTime,
          lastMessageTime: conv.lastMessageTime,
          otherUser: otherUser
            ? {
              _id: otherUser._id,
              username: otherUser.username,
              avatarColor: otherUser.avatarColor,
              avatarStorageId: otherUser.avatarStorageId,
              lastSeen: otherUser.lastSeen,
              statusEmoji: otherUser.statusEmoji,
              statusText: otherUser.statusText,
              isBot: otherUser.isBot,
            }
            : null,
        };
      })
    );

    // Filter out conversations where the other user no longer exists
    return conversationsWithUsers.filter((c) => c.otherUser !== null);
  },
});

export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const conversation = await ctx.db.get("conversations", conversationId);
    if (!conversation) {
      return null;
    }

    // Verify the user is a participant
    if (
      conversation.participant1 !== userId &&
      conversation.participant2 !== userId
    ) {
      throw new Error("You are not a participant in this conversation");
    }

    const otherUserId =
      conversation.participant1 === userId
        ? conversation.participant2
        : conversation.participant1;
    const otherUser = await ctx.db.get("users", otherUserId);

    return {
      _id: conversation._id,
      _creationTime: conversation._creationTime,
      lastMessageTime: conversation.lastMessageTime,
      otherUser: otherUser
        ? {
          _id: otherUser._id,
          username: otherUser.username,
          avatarColor: otherUser.avatarColor,
          avatarStorageId: otherUser.avatarStorageId,
          lastSeen: otherUser.lastSeen,
          statusEmoji: otherUser.statusEmoji,
          statusText: otherUser.statusText,
          isBot: otherUser.isBot,
        }
        : null,
    };
  },
});

// Internal helper to update lastMessageTime when a message is sent
export const updateLastMessageTime = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    await ctx.db.patch("conversations", conversationId, {
      lastMessageTime: Date.now(),
    });
  },
});

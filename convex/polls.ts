import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createPoll = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    question: v.string(),
    options: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const question = args.question.trim();
    if (!question) throw new Error("Poll question cannot be empty");
    if (args.options.length < 2) throw new Error("Poll needs at least 2 options");
    if (args.options.length > 10) throw new Error("Poll can have at most 10 options");

    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      userId: args.userId,
      text: question,
      type: "poll",
    });

    const pollId = await ctx.db.insert("polls", {
      channelId: args.channelId,
      messageId,
      question,
      options: args.options.map((text) => ({ text: text.trim(), votes: 0 })),
      createdBy: args.userId,
    });

    // Clear typing indicator
    const typingIndicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .unique();
    if (typingIndicator) {
      await ctx.db.delete("typingIndicators", typingIndicator._id);
    }

    return pollId;
  },
});

export const vote = mutation({
  args: {
    pollId: v.id("polls"),
    userId: v.id("users"),
    optionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const poll = await ctx.db.get("polls", args.pollId);
    if (!poll) throw new Error("Poll not found");
    if (args.optionIndex < 0 || args.optionIndex >= poll.options.length) {
      throw new Error("Invalid option index");
    }

    const existingVote = await ctx.db
      .query("pollVotes")
      .withIndex("by_pollId_userId", (q) =>
        q.eq("pollId", args.pollId).eq("userId", args.userId)
      )
      .unique();

    const newOptions = [...poll.options];

    if (existingVote) {
      // Remove old vote count
      newOptions[existingVote.optionIndex] = {
        ...newOptions[existingVote.optionIndex],
        votes: Math.max(0, newOptions[existingVote.optionIndex].votes - 1),
      };

      if (existingVote.optionIndex === args.optionIndex) {
        // Toggle off — remove vote
        await ctx.db.delete("pollVotes", existingVote._id);
      } else {
        // Change vote
        newOptions[args.optionIndex] = {
          ...newOptions[args.optionIndex],
          votes: newOptions[args.optionIndex].votes + 1,
        };
        await ctx.db.patch("pollVotes", existingVote._id, {
          optionIndex: args.optionIndex,
        });
      }
    } else {
      // New vote
      newOptions[args.optionIndex] = {
        ...newOptions[args.optionIndex],
        votes: newOptions[args.optionIndex].votes + 1,
      };
      await ctx.db.insert("pollVotes", {
        pollId: args.pollId,
        userId: args.userId,
        optionIndex: args.optionIndex,
      });
    }

    await ctx.db.patch("polls", args.pollId, { options: newOptions });
  },
});

export const getPoll = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const poll = await ctx.db
      .query("polls")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!poll) return null;

    const creator = await ctx.db.get("users", poll.createdBy);
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);

    return {
      _id: poll._id,
      question: poll.question,
      options: poll.options,
      totalVotes,
      createdBy: creator?.username ?? "Unknown",
    };
  },
});

export const getUserVote = query({
  args: {
    pollId: v.id("polls"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const vote = await ctx.db
      .query("pollVotes")
      .withIndex("by_pollId_userId", (q) =>
        q.eq("pollId", args.pollId).eq("userId", args.userId)
      )
      .unique();

    return vote?.optionIndex ?? null;
  },
});

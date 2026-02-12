import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to check if a user can access a private channel
export async function canAccessChannel(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">
): Promise<boolean> {
  const channel = await ctx.db.get("channels", channelId);
  if (!channel) return false;

  // Public channels are accessible to everyone
  if (!channel.isPrivate) return true;

  // Check if user is a member of the private channel
  const membership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId)
    )
    .unique();

  return membership !== null;
}

// Helper to check if user is an admin of a channel
export async function isChannelAdmin(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">
): Promise<boolean> {
  const membership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId)
    )
    .unique();

  return membership?.role === "admin";
}

export const createChannel = mutation({
  args: {
    name: v.string(),
    userId: v.id("users"),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const name = args.name.toLowerCase();
    if (!/^[a-z0-9-]{1,50}$/.test(name)) {
      throw new Error(
        "Channel name must be lowercase alphanumeric with hyphens, 1-50 characters"
      );
    }

    const existing = await ctx.db
      .query("channels")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();

    if (existing) {
      throw new Error(`Channel #${name} already exists`);
    }

    const channelId = await ctx.db.insert("channels", {
      name,
      createdBy: args.userId,
      isPrivate: args.isPrivate ?? false,
    });

    // If private, add creator as admin member
    if (args.isPrivate) {
      await ctx.db.insert("channelMembers", {
        channelId,
        userId: args.userId,
        role: "admin",
      });
    }

    return channelId;
  },
});

export const updateTopic = mutation({
  args: {
    channelId: v.id("channels"),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("channels", args.channelId, {
      topic: args.topic,
    });
  },
});

export const listChannels = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const channels = await ctx.db.query("channels").collect();

    // If no userId provided, return basic channel info (for backwards compatibility)
    if (!args.userId) {
      return channels
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({
          ...c,
          isMember: !c.isPrivate, // Non-members can't determine membership without userId
          isAdmin: false,
          accessRequestStatus: undefined as "pending" | "approved" | "denied" | undefined,
        }));
    }

    // Get all memberships for this user
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
      .collect();

    const membershipMap = new Map(
      memberships.map((m) => [m.channelId, m.role])
    );

    // Get all access requests for this user
    const accessRequests = await ctx.db
      .query("channelAccessRequests")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
      .collect();

    const requestMap = new Map(
      accessRequests.map((r) => [r.channelId, r.status])
    );

    return channels
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((channel) => {
        const role = membershipMap.get(channel._id);
        const isMember = !channel.isPrivate || role !== undefined;
        const isAdmin = role === "admin";
        const accessRequestStatus = channel.isPrivate && !isMember
          ? requestMap.get(channel._id)
          : undefined;

        return {
          ...channel,
          isMember,
          isAdmin,
          accessRequestStatus,
        };
      });
  },
});

export const seedDefaultChannels = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const defaults = ["general", "random", "introductions", "draw"];
    await Promise.all(
      defaults.map(async (name) => {
        const existing = await ctx.db
          .query("channels")
          .withIndex("by_name", (q) => q.eq("name", name))
          .unique();

        if (!existing) {
          await ctx.db.insert("channels", {
            name,
            createdBy: args.userId,
          });
        }
      })
    );
  },
});

// Request access to a private channel
export const requestAccess = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (!channel.isPrivate) {
      throw new Error("This channel is not private");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (existingMembership) {
      throw new Error("You are already a member of this channel");
    }

    // Check for existing pending request
    const existingRequest = await ctx.db
      .query("channelAccessRequests")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (existingRequest?.status === "pending") {
      throw new Error("You already have a pending request for this channel");
    }

    // Create or update the request
    if (existingRequest) {
      await ctx.db.patch("channelAccessRequests", existingRequest._id, {
        status: "pending",
        requestedAt: Date.now(),
        respondedAt: undefined,
        respondedBy: undefined,
      });
    } else {
      await ctx.db.insert("channelAccessRequests", {
        channelId: args.channelId,
        userId: args.userId,
        status: "pending",
        requestedAt: Date.now(),
      });
    }
  },
});

// Approve a pending access request (admin only)
export const approveRequest = mutation({
  args: {
    requestId: v.id("channelAccessRequests"),
    adminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get("channelAccessRequests", args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("This request has already been processed");
    }

    // Check if user is admin
    const isAdmin = await isChannelAdmin(ctx, request.channelId, args.adminUserId);
    if (!isAdmin) {
      throw new Error("Only channel admins can approve requests");
    }

    // Update request status
    await ctx.db.patch("channelAccessRequests", args.requestId, {
      status: "approved",
      respondedAt: Date.now(),
      respondedBy: args.adminUserId,
    });

    // Add user as member
    await ctx.db.insert("channelMembers", {
      channelId: request.channelId,
      userId: request.userId,
      role: "member",
    });
  },
});

// Deny a pending access request (admin only)
export const denyRequest = mutation({
  args: {
    requestId: v.id("channelAccessRequests"),
    adminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get("channelAccessRequests", args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("This request has already been processed");
    }

    // Check if user is admin
    const isAdmin = await isChannelAdmin(ctx, request.channelId, args.adminUserId);
    if (!isAdmin) {
      throw new Error("Only channel admins can deny requests");
    }

    // Update request status
    await ctx.db.patch("channelAccessRequests", args.requestId, {
      status: "denied",
      respondedAt: Date.now(),
      respondedBy: args.adminUserId,
    });
  },
});

// Add a member to a private channel (admin only)
export const addMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    adminUserId: v.id("users"),
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (!channel.isPrivate) {
      throw new Error("Cannot add members to a public channel");
    }

    // Check if user is admin
    const isAdmin = await isChannelAdmin(ctx, args.channelId, args.adminUserId);
    if (!isAdmin) {
      throw new Error("Only channel admins can add members");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (existingMembership) {
      throw new Error("User is already a member of this channel");
    }

    await ctx.db.insert("channelMembers", {
      channelId: args.channelId,
      userId: args.userId,
      role: args.role ?? "member",
    });

    // Remove any pending access request
    const pendingRequest = await ctx.db
      .query("channelAccessRequests")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (pendingRequest && pendingRequest.status === "pending") {
      await ctx.db.patch("channelAccessRequests", pendingRequest._id, {
        status: "approved",
        respondedAt: Date.now(),
        respondedBy: args.adminUserId,
      });
    }
  },
});

// Remove a member from a private channel (admin only, or self)
export const removeMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    if (!channel.isPrivate) {
      throw new Error("Cannot remove members from a public channel");
    }

    // Allow self-removal or admin removal
    const isSelf = args.userId === args.requestingUserId;
    const isAdmin = await isChannelAdmin(ctx, args.channelId, args.requestingUserId);

    if (!isSelf && !isAdmin) {
      throw new Error("Only channel admins can remove other members");
    }

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .unique();

    if (!membership) {
      throw new Error("User is not a member of this channel");
    }

    // Prevent removing the last admin
    if (membership.role === "admin") {
      const adminCount = await ctx.db
        .query("channelMembers")
        .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
        .filter((q) => q.eq(q.field("role"), "admin"))
        .collect();

      if (adminCount.length <= 1) {
        throw new Error("Cannot remove the last admin from a channel");
      }
    }

    await ctx.db.delete("channelMembers", membership._id);
  },
});

// Get all members of a channel
export const getChannelMembers = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get("users", m.userId);
        return {
          membershipId: m._id,
          userId: m.userId,
          role: m.role,
          username: user?.username ?? "Unknown",
          avatarColor: user?.avatarColor ?? "#6b7280",
          avatarStorageId: user?.avatarStorageId,
        };
      })
    );

    // Get avatar URLs
    const membersWithUrls = await Promise.all(
      members.map(async (m) => ({
        ...m,
        avatarUrl: m.avatarStorageId
          ? await ctx.storage.getUrl(m.avatarStorageId)
          : null,
      }))
    );

    return membersWithUrls;
  },
});

// Get pending access requests for a channel (admin only view)
export const getPendingRequests = query({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const isAdmin = await isChannelAdmin(ctx, args.channelId, args.userId);
    if (!isAdmin) {
      return [];
    }

    const requests = await ctx.db
      .query("channelAccessRequests")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const requestsWithUsers = await Promise.all(
      requests.map(async (r) => {
        const user = await ctx.db.get("users", r.userId);
        const avatarUrl = user?.avatarStorageId
          ? await ctx.storage.getUrl(user.avatarStorageId)
          : null;
        return {
          ...r,
          username: user?.username ?? "Unknown",
          avatarColor: user?.avatarColor ?? "#6b7280",
          avatarUrl,
        };
      })
    );

    return requestsWithUsers;
  },
});

// Get a single channel by ID (with membership info)
export const getChannel = query({
  args: {
    channelId: v.id("channels"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) return null;

    if (!args.userId) {
      return {
        ...channel,
        isMember: !channel.isPrivate,
        isAdmin: false,
        accessRequestStatus: undefined as "pending" | "approved" | "denied" | undefined,
      };
    }

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId!)
      )
      .unique();

    const isMember = !channel.isPrivate || membership !== null;
    const isAdmin = membership?.role === "admin";

    let accessRequestStatus: "pending" | "approved" | "denied" | undefined;
    if (channel.isPrivate && !isMember) {
      const request = await ctx.db
        .query("channelAccessRequests")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", args.userId!)
        )
        .unique();
      accessRequestStatus = request?.status;
    }

    return {
      ...channel,
      isMember,
      isAdmin,
      accessRequestStatus,
    };
  },
});

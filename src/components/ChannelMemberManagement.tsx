"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { Avatar } from "@/components/Avatar";

interface ChannelMemberManagementProps {
  channelId: Id<"channels">;
  channelName: string;
  onClose: () => void;
}

export function ChannelMemberManagement({ 
  channelId, 
  channelName,
  onClose 
}: ChannelMemberManagementProps) {
  const { user } = useUser();
  const members = useQuery(api.channels.getChannelMembers, { channelId });
  const pendingRequests = useQuery(
    api.channels.getPendingRequests,
    user ? { channelId, userId: user._id } : "skip"
  );
  
  const approveRequest = useMutation(api.channels.approveRequest);
  const denyRequest = useMutation(api.channels.denyRequest);
  const removeMember = useMutation(api.channels.removeMember);
  const addMember = useMutation(api.channels.addMember);
  
  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Find user by username for adding
  const userToAdd = useQuery(
    api.users.getUserByUsername,
    addUsername.trim() ? { username: addUsername.trim() } : "skip"
  );

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userToAdd) return;
    
    setIsAdding(true);
    setAddError("");
    
    try {
      await addMember({
        channelId,
        userId: userToAdd._id,
        adminUserId: user._id,
      });
      setAddUsername("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  };

  const handleApprove = async (requestId: Id<"channelAccessRequests">) => {
    if (!user) return;
    try {
      await approveRequest({ requestId, adminUserId: user._id });
    } catch (err) {
      console.error("Failed to approve request:", err);
    }
  };

  const handleDeny = async (requestId: Id<"channelAccessRequests">) => {
    if (!user) return;
    try {
      await denyRequest({ requestId, adminUserId: user._id });
    } catch (err) {
      console.error("Failed to deny request:", err);
    }
  };

  const handleRemove = async (memberId: Id<"users">) => {
    if (!user) return;
    try {
      await removeMember({
        channelId,
        userId: memberId,
        requestingUserId: user._id,
      });
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <h2 className="font-semibold text-text">
          <span className="text-text-muted">#</span> {channelName} Members
        </h2>
        <button
          onClick={onClose}
          className="rounded p-1 text-text-muted hover:bg-hover hover:text-text"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Pending Requests */}
        {pendingRequests && pendingRequests.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-2">
              <span className="bg-warning/20 text-warning text-xs px-1.5 py-0.5 rounded">
                {pendingRequests.length}
              </span>
              Pending Requests
            </h3>
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div
                  key={request._id}
                  className="flex items-center justify-between rounded-lg bg-overlay p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      username={request.username}
                      avatarColor={request.avatarColor}
                      avatarUrl={request.avatarUrl}
                      size="sm"
                    />
                    <div>
                      <div className="text-sm font-medium text-text">{request.username}</div>
                      <div className="text-xs text-text-muted">
                        Requested {new Date(request.requestedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request._id)}
                      className="rounded bg-success/20 px-2 py-1 text-xs font-medium text-success hover:bg-success/30"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeny(request._id)}
                      className="rounded bg-danger/20 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/30"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Member */}
        <div>
          <h3 className="text-sm font-medium text-text mb-3">Add Member</h3>
          <form onSubmit={handleAddMember} className="space-y-2">
            <input
              type="text"
              value={addUsername}
              onChange={(e) => {
                setAddUsername(e.target.value);
                setAddError("");
              }}
              placeholder="Enter username"
              className="w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text placeholder-text-muted outline-none focus:border-accent"
            />
            {userToAdd && addUsername.trim() && (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 p-2 text-sm text-success">
                <Avatar
                  username={userToAdd.username}
                  avatarColor={userToAdd.avatarColor}
                  avatarUrl={userToAdd.avatarUrl}
                  size="xs"
                />
                <span>Found: {userToAdd.username}</span>
              </div>
            )}
            {addUsername.trim() && userToAdd === null && (
              <div className="text-xs text-danger">User not found</div>
            )}
            {addError && <div className="text-xs text-danger">{addError}</div>}
            <button
              type="submit"
              disabled={!userToAdd || isAdding}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {isAdding ? "Adding..." : "Add Member"}
            </button>
          </form>
        </div>

        {/* Current Members */}
        <div>
          <h3 className="text-sm font-medium text-text mb-3">
            Members ({members?.length ?? 0})
          </h3>
          <div className="space-y-2">
            {members?.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between rounded-lg bg-overlay p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    username={member.username}
                    avatarColor={member.avatarColor}
                    avatarUrl={member.avatarUrl}
                    size="sm"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{member.username}</span>
                      {member.role === "admin" && (
                        <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {member.userId !== user?._id && (
                  <button
                    onClick={() => handleRemove(member.userId)}
                    className="rounded p-1 text-text-muted hover:bg-danger/20 hover:text-danger"
                    title="Remove member"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

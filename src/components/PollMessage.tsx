"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface PollMessageProps {
  messageId: Id<"messages">;
  currentUserId: Id<"users"> | undefined;
}

export function PollMessage({ messageId, currentUserId }: PollMessageProps) {
  const poll = useQuery(api.polls.getPoll, { messageId });
  const userVote = useQuery(
    api.polls.getUserVote,
    poll && currentUserId ? { pollId: poll._id, userId: currentUserId } : "skip"
  );
  const vote = useMutation(api.polls.vote);

  if (!poll) return null;

  const totalVotes = poll.totalVotes;

  function handleVote(optionIndex: number) {
    if (!currentUserId || !poll) return;
    vote({ pollId: poll._id, userId: currentUserId, optionIndex });
  }

  return (
    <div className="my-1 max-w-md rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <span>📊</span>
        <span>{poll.question}</span>
      </div>

      <div className="space-y-2">
        {poll.options.map((option, i) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isVoted = userVote === i;

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleVote(i)}
              className={`relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                isVoted
                  ? "border-indigo-500/50 bg-indigo-500/10"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-indigo-500/20 transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span className={isVoted ? "font-medium text-indigo-300" : "text-zinc-300"}>
                  {option.text}
                  {isVoted && <span className="ml-2 text-xs text-indigo-400">✓ You</span>}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  {pct}% ({option.votes})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"} · Created by {poll.createdBy}
      </div>
    </div>
  );
}

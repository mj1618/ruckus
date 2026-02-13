"use client";

import { Id } from "../../convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";

interface MentionUser {
  _id: Id<"users">;
  username: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

interface MentionAutocompleteProps {
  query: string;
  users: MentionUser[];
  selectedIndex: number;
  onSelect: (username: string) => void;
}

export function MentionAutocomplete({ query, users, selectedIndex, onSelect }: MentionAutocompleteProps) {
  const filtered = users
    .filter((u) => u.username.toLowerCase().startsWith(query.toLowerCase()))
    .sort((a, b) => a.username.localeCompare(b.username))
    .slice(0, 8);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[200px] rounded-lg border border-border bg-overlay p-2 shadow-xl">
        <p className="text-sm italic text-text-muted">No matching users</p>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 max-h-[200px] min-w-[200px] max-w-[280px] overflow-y-auto rounded-lg border border-border bg-overlay py-1 shadow-xl">
      {filtered.map((user, i) => (
        <button
          key={user._id}
          type="button"
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
            i === selectedIndex ? "bg-selected" : "hover:bg-hover"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(user.username);
          }}
        >
          <Avatar
            username={user.username}
            avatarColor={user.avatarColor}
            avatarUrl={user.avatarUrl}
            size="sm"
            className="shrink-0"
          />
          <span className="truncate text-sm text-text">{user.username}</span>
        </button>
      ))}
    </div>
  );
}

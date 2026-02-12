"use client";

import { Id } from "../../convex/_generated/dataModel";

interface MentionUser {
  _id: Id<"users">;
  username: string;
  avatarColor: string;
}

interface MentionAutocompleteProps {
  query: string;
  users: MentionUser[];
  selectedIndex: number;
  onSelect: (username: string) => void;
  position: { bottom: number; left: number };
}

export function MentionAutocomplete({ query, users, selectedIndex, onSelect, position }: MentionAutocompleteProps) {
  const filtered = users
    .filter((u) => u.username.toLowerCase().startsWith(query.toLowerCase()))
    .sort((a, b) => a.username.localeCompare(b.username))
    .slice(0, 8);

  if (filtered.length === 0) {
    return (
      <div
        className="absolute z-50 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-800 p-2 shadow-xl"
        style={{ bottom: position.bottom, left: position.left }}
      >
        <p className="text-sm italic text-zinc-500">No matching users</p>
      </div>
    );
  }

  return (
    <div
      className="absolute z-50 max-h-[200px] min-w-[200px] max-w-[280px] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
      style={{ bottom: position.bottom, left: position.left }}
    >
      {filtered.map((user, i) => (
        <button
          key={user._id}
          type="button"
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
            i === selectedIndex ? "bg-zinc-700" : "hover:bg-zinc-700"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(user.username);
          }}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: user.avatarColor }}
          >
            {user.username[0].toUpperCase()}
          </div>
          <span className="truncate text-sm text-zinc-200">{user.username}</span>
        </button>
      ))}
    </div>
  );
}

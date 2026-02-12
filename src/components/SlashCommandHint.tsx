"use client";

const SLASH_COMMANDS = [
  { command: "/poll", args: "Question | Option 1 | Option 2", description: "Create a poll" },
  { command: "/me", args: "action", description: "Express an action" },
  { command: "/shrug", args: "[text]", description: "Append ¯\\_(ツ)_/¯" },
  { command: "/nick", args: "newname", description: "Change your display name" },
  { command: "/status", args: "[emoji] [text]", description: "Set your status" },
];

interface SlashCommandHintProps {
  query: string;
  selectedIndex: number;
  onSelect: (command: string) => void;
}

export function SlashCommandHint({ query, selectedIndex, onSelect }: SlashCommandHintProps) {
  const filtered = SLASH_COMMANDS.filter((c) =>
    c.command.startsWith("/" + query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl">
      <div className="px-3 py-1 text-xs font-semibold uppercase text-zinc-500">Commands</div>
      {filtered.map((cmd, i) => (
        <button
          key={cmd.command}
          type="button"
          className={`flex w-full items-center gap-3 px-3 py-1.5 text-left ${
            i === selectedIndex ? "bg-zinc-700" : "hover:bg-zinc-700"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd.command);
          }}
        >
          <span className="font-mono text-sm font-semibold text-indigo-400">{cmd.command}</span>
          <span className="text-xs text-zinc-500">{cmd.args}</span>
          <span className="ml-auto text-xs text-zinc-400">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}

export { SLASH_COMMANDS };

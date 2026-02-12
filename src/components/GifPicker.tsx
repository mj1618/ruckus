"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const searchGifs = useAction(api.giphy.searchGifs);

  // Click outside / Escape to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const gifs = await searchGifs({ query: trimmed, limit: 20 });
        setResults(gifs as GifResult[]);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchGifs]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 z-50 mb-2 flex h-[400px] w-[340px] flex-col rounded-lg border border-border bg-overlay shadow-xl"
    >
      {/* Search input */}
      <div className="border-b border-border p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="w-full rounded bg-active px-3 py-1.5 text-sm text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
          autoFocus
        />
      </div>

      {/* GIF grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            Searching...
          </div>
        )}
        {!loading && !searched && (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            Type to search for GIFs
          </div>
        )}
        {!loading && searched && results.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            No GIFs found
          </div>
        )}
        {!loading && results.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif.url)}
                className="overflow-hidden rounded hover:ring-2 hover:ring-accent"
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tenor attribution */}
      <div className="border-t border-border px-2 py-1 text-center text-xs text-text-muted">
        Powered by Tenor
      </div>
    </div>
  );
}

"use client";

import { useWatchlist } from "@/lib/watchlist/use-watchlist";

type Props = {
  symbol: string;
  size?: "sm" | "md";
  showLabel?: boolean;
};

/**
 * A star toggle button to add/remove a pair from the user's watchlist.
 * Local-only for now; migrates to wallet-backed storage in M3.
 */
export function WatchlistStar({ symbol, size = "md", showLabel = false }: Props) {
  const { has, toggle } = useWatchlist();
  const isStarred = has(symbol);

  const iconSize = size === "sm" ? 14 : 18;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(symbol);
      }}
      aria-label={isStarred ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      title={isStarred ? "Remove from watchlist" : "Add to watchlist"}
      className={`group inline-flex items-center gap-2 transition-colors ${
        isStarred ? "text-signal" : "text-ink-faint hover:text-ink-mute"
      }`}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={isStarred ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      {showLabel && (
        <span className="font-mono text-[11px] uppercase tracking-widest">
          {isStarred ? "watching" : "watch"}
        </span>
      )}
    </button>
  );
}

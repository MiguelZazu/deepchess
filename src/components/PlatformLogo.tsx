import type { Platform } from '../lib/types';

/** Neutral platform marks (not the official logos). */
export function PlatformLogo({ platform, size = 16 }: { platform: Platform; size?: number }) {
  const color = platform === 'chesscom' ? '#7fa650' : '#c9c9c9';
  const letter = platform === 'chesscom' ? 'C' : 'L';
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ flex: 'none' }}>
      <rect width="16" height="16" rx="4" fill={color} />
      <text x="8" y="8.6" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="800" fill="#11151b" fontFamily="Inter, sans-serif">
        {letter}
      </text>
    </svg>
  );
}

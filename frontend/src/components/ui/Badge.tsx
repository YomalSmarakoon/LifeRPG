import { RANK_STYLES, RANK_ICONS } from '../../utils/xp-calculator';

interface RankBadgeProps {
  rank: string;
}

export function RankBadge({ rank }: RankBadgeProps) {
  const cls = RANK_STYLES[rank] ?? 'r-Bronze';
  const icon = RANK_ICONS[rank] ?? '🥉';
  return (
    <span className={`rank-badge ${cls}`}>
      {icon} {rank}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
}

export function Badge({ children, color }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: color ?? 'var(--surface2)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }}
    >
      {children}
    </span>
  );
}

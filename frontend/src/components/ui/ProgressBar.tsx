interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  small?: boolean;
  className?: string;
}

export function ProgressBar({ value, max = 100, color, small = false, className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`pbar ${small ? 'pbar-sm' : ''} ${className}`}>
      <div
        className="pbar-fill"
        style={{
          width: `${pct}%`,
          background: color ?? 'linear-gradient(90deg, var(--accent), var(--purple))',
        }}
      />
    </div>
  );
}

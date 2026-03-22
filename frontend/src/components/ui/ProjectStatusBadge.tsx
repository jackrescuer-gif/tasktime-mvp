/**
 * ProjectStatusBadge — Ф2.1 UI Kit 2.0 (TTUI-94)
 * Active / OnHold / Archived с цветным dot-индикатором
 */


export type ProjectStatus = 'active' | 'onhold' | 'archived' | 'empty';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; dot: string }> = {
  active:   { label: 'Active',    color: 'rgba(34,197,94,0.15)',  dot: '#22c55e' },
  onhold:   { label: 'On Hold',   color: 'rgba(245,158,11,0.15)', dot: '#f59e0b' },
  archived: { label: 'Archived',  color: 'rgba(107,114,128,0.15)', dot: '#6b7280' },
  empty:    { label: 'Empty',     color: 'rgba(107,114,128,0.12)', dot: '#6b7280' },
};

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'md';
}

export function ProjectStatusBadge({ status, size = 'md' }: ProjectStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.empty;
  const fs = size === 'sm' ? 11 : 12;
  const px = size === 'sm' ? '5px 8px' : '4px 10px';
  const dotSz = size === 'sm' ? 5 : 6;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: px,
        borderRadius: 99,
        background: cfg.color,
        fontSize: fs,
        fontWeight: 500,
        color: cfg.dot,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: dotSz,
          height: dotSz,
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

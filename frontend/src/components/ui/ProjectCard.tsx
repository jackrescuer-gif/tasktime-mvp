/**
 * ProjectCard — Ф2.6 UI Kit 2.0 (TTUI-99)
 * 3 варианта: Active (violet glow) / OnHold (amber glow) / Archived (no glow, dim)
 * Radial glow: position:absolute, right:-30px top:-30px, 100×100px
 */

import { ProjectOutlined } from '@ant-design/icons';
import type { AvatarUser } from './AvatarGroup';
import { AvatarGroup } from './AvatarGroup';
import { ProgressBar } from './ProgressBar';
import { ProjectStatusBadge, type ProjectStatus } from './ProjectStatusBadge';

export interface ProjectCardData {
  id: string;
  name: string;
  key: string;
  description?: string;
  status: ProjectStatus;
  openIssues?: number;
  currentSprint?: string | null;
  completionPct?: number;
  members?: AvatarUser[];
  updatedAt?: string;
}

interface ProjectCardProps {
  project: ProjectCardData;
  onClick?: () => void;
}

const GLOW_CONFIG: Record<ProjectStatus, string | null> = {
  active:   'rgba(99,102,241,0.22)',
  onhold:   'rgba(245,158,11,0.14)',
  archived: null,
  empty:    null,
};

const CARD_BG: Record<ProjectStatus, string> = {
  active:   'var(--bg-el)',
  onhold:   'var(--bg-el)',
  archived: '#0c1019',
  empty:    'var(--bg-el)',
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const glowColor = GLOW_CONFIG[project.status];
  const isArchived = project.status === 'archived';
  const completion = project.completionPct ?? 0;

  const updatedLabel = project.updatedAt
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(project.updatedAt))
    : null;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: CARD_BG[project.status],
        border: '1px solid var(--b)',
        borderRadius: 'var(--r)',
        padding: 24,
        width: 340,
        cursor: onClick ? 'pointer' : 'default',
        opacity: isArchived ? 0.7 : 1,
        transition: 'box-shadow 0.18s, border-color 0.18s',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!isArchived) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--b2)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--b)';
      }}
    >
      {/* Radial glow — signature UI Kit 2.0 element */}
      {glowColor && (
        <div
          style={{
            position: 'absolute',
            right: -30,
            top: -30,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: `radial-gradient(circle farthest-corner at 50% 50%, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--acc-bg)',
              color: 'var(--acc)',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            <ProjectOutlined />
          </span>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--t1)',
                lineHeight: 1.2,
              }}
            >
              {project.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
              {project.key}
            </div>
          </div>
        </div>
        <ProjectStatusBadge status={project.status} size="sm" />
      </div>

      {/* Description */}
      {project.description && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--t3)',
            lineHeight: 1.5,
            marginBottom: 16,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {project.description}
        </div>
      )}
      {!project.description && <div style={{ marginBottom: 16 }} />}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--t1)', lineHeight: 1 }}>
            {project.openIssues ?? 0}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>открытых задач</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--t1)', lineHeight: 1 }}>
            {project.currentSprint ?? '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>текущий спринт</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--acc)', lineHeight: 1 }}>
            {completion}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>выполнено</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <ProgressBar value={completion} height={3} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {project.members && project.members.length > 0 ? (
          <AvatarGroup users={project.members} max={4} size={22} />
        ) : (
          <span />
        )}
        {updatedLabel && (
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>
            Обновлено {updatedLabel}
          </span>
        )}
      </div>
    </div>
  );
}

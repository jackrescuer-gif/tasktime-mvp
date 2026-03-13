import type { Decimal } from '@prisma/client/runtime/library';

type DecimalLike = Decimal | number | string | null | undefined;

export interface UserTimeSummaryTotals {
  humanHours?: DecimalLike;
  agentHours?: DecimalLike;
  agentCost?: DecimalLike;
}

export interface UserTimeSummary {
  userId: string;
  humanHours: number;
  agentHours: number;
  totalHours: number;
  agentCost: number;
}

function toNumber(value: DecimalLike): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber();
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildUserTimeSummary(userId: string, totals: UserTimeSummaryTotals): UserTimeSummary {
  const humanHours = toNumber(totals.humanHours);
  const agentHours = toNumber(totals.agentHours);
  const agentCost = toNumber(totals.agentCost);

  return {
    userId,
    humanHours: round(humanHours, 2),
    agentHours: round(agentHours, 2),
    totalHours: round(humanHours + agentHours, 2),
    agentCost: round(agentCost, 4),
  };
}

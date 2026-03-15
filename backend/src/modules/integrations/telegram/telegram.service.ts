import { prisma } from '../../../prisma/client.js';
import { AppError } from '../../../shared/middleware/error-handler.js';

const BOT_API = 'https://api.telegram.org/bot';

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new AppError(503, 'TELEGRAM_BOT_TOKEN not configured');
  return t;
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const url = `${BOT_API}${token()}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new AppError(502, `Telegram API error: ${body}`);
  }
}

export async function subscribe(userId: string, chatId: string): Promise<void> {
  await prisma.telegramSubscription.upsert({
    where: { userId },
    create: { userId, chatId, active: true },
    update: { chatId, active: true },
  });
}

export async function unsubscribe(userId: string): Promise<void> {
  await prisma.telegramSubscription.update({
    where: { userId },
    data: { active: false },
  });
}

export async function getSubscription(userId: string) {
  return prisma.telegramSubscription.findUnique({ where: { userId } });
}

export async function notifyUser(userId: string, text: string): Promise<void> {
  const sub = await prisma.telegramSubscription.findUnique({ where: { userId } });
  if (!sub || !sub.active) return;
  await sendMessage(sub.chatId, text);
}

// Called from issues.service when assignee changes or status changes
export async function notifyIssueEvent(
  event: 'assigned' | 'status_changed' | 'commented',
  payload: {
    issueKey: string;
    issueTitle: string;
    assigneeId?: string | null;
    actorName: string;
    newStatus?: string;
  },
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return; // silently skip if not configured

  let text: string;
  let targetUserId: string | null | undefined;

  if (event === 'assigned' && payload.assigneeId) {
    text = `📋 <b>Assigned to you</b>\n<code>${payload.issueKey}</code> ${payload.issueTitle}\nBy: ${payload.actorName}`;
    targetUserId = payload.assigneeId;
  } else if (event === 'status_changed' && payload.assigneeId) {
    text = `🔄 <b>Status updated</b>\n<code>${payload.issueKey}</code> ${payload.issueTitle}\n${payload.newStatus} · By: ${payload.actorName}`;
    targetUserId = payload.assigneeId;
  } else if (event === 'commented' && payload.assigneeId) {
    text = `💬 <b>New comment</b>\n<code>${payload.issueKey}</code> ${payload.issueTitle}\nBy: ${payload.actorName}`;
    targetUserId = payload.assigneeId;
  } else {
    return;
  }

  if (!targetUserId) return;

  try {
    await notifyUser(targetUserId, text);
  } catch {
    // Notification failures must not break main flow
  }
}

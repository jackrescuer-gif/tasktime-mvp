import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.js';
import { validate } from '../../../shared/middleware/validate.js';
import * as telegramService from './telegram.service.js';
import type { AuthRequest } from '../../../shared/types/index.js';

const router = Router();

// POST /api/integrations/telegram/webhook — Telegram pushes updates here
// No auth — secured by secret token in URL or X-Telegram-Bot-Api-Secret-Token header
router.post('/integrations/telegram/webhook', async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (header !== secret) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const update = req.body as {
    message?: { chat: { id: number }; text?: string; from?: { id: number } };
  };

  // Handle /start command — respond with instructions
  if (update.message?.text?.startsWith('/start')) {
    const chatId = String(update.message.chat.id);
    try {
      await telegramService.sendMessage(
        chatId,
        '👋 <b>TaskTime Bot</b>\n\nTo receive notifications, copy your chat ID and paste it in TaskTime Profile → Telegram Notifications.\n\nYour chat ID: <code>' +
          chatId +
          '</code>',
      );
    } catch {
      // ignore send errors
    }
  }

  res.json({ ok: true });
});

// Auth required for the rest
router.use(authenticate);

const subscribeDto = z.object({ chatId: z.string().min(1) });

// POST /api/integrations/telegram/subscribe
router.post(
  '/integrations/telegram/subscribe',
  validate(subscribeDto),
  async (req: AuthRequest, res, next) => {
    try {
      await telegramService.subscribe(req.user!.userId, req.body.chatId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/integrations/telegram/unsubscribe
router.delete('/integrations/telegram/unsubscribe', async (req: AuthRequest, res, next) => {
  try {
    await telegramService.unsubscribe(req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/integrations/telegram/status
router.get('/integrations/telegram/status', async (req: AuthRequest, res, next) => {
  try {
    const sub = await telegramService.getSubscription(req.user!.userId);
    res.json({ connected: !!sub?.active, chatId: sub?.active ? sub.chatId : null });
  } catch (err) {
    next(err);
  }
});

export default router;

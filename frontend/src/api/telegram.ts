import api from './client';

export interface TelegramStatus {
  connected: boolean;
  chatId: string | null;
}

export function getStatus(): Promise<TelegramStatus> {
  return api.get<TelegramStatus>('/integrations/telegram/status').then((r) => r.data);
}

export function subscribe(chatId: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/integrations/telegram/subscribe', { chatId }).then((r) => r.data);
}

export function unsubscribe(): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>('/integrations/telegram/unsubscribe').then((r) => r.data);
}

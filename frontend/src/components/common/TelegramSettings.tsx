import { useEffect, useState } from 'react';
import { Button, Input, Space, Alert, Tag, Typography, Popconfirm } from 'antd';
import { SendOutlined, DisconnectOutlined } from '@ant-design/icons';
import * as telegramApi from '../../api/telegram';

export default function TelegramSettings() {
  const [status, setStatus] = useState<{ connected: boolean; chatId: string | null } | null>(null);
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const s = await telegramApi.getStatus();
      setStatus(s);
    } catch {
      // not fatal
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubscribe = async () => {
    if (!chatId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await telegramApi.subscribe(chatId.trim());
      setChatId('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await telegramApi.unsubscribe();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect');
    }
  };

  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
        Receive issue notifications in Telegram.
      </Typography.Text>

      {status?.connected ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Tag color="green">Connected</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Chat ID: <code>{status.chatId}</code>
            </Typography.Text>
          </Space>
          <Popconfirm title="Disconnect Telegram?" onConfirm={handleUnsubscribe}>
            <Button size="small" danger icon={<DisconnectOutlined />}>
              Disconnect
            </Button>
          </Popconfirm>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text style={{ fontSize: 12 }}>
            1. Start <strong>@tasktime_notify_bot</strong> in Telegram<br />
            2. Copy your chat ID from the bot's welcome message<br />
            3. Paste it below and connect
          </Typography.Text>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              size="small"
              placeholder="Your Telegram chat ID"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              onPressEnter={handleSubscribe}
            />
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              loading={saving}
              onClick={handleSubscribe}
              disabled={!chatId.trim()}
            >
              Connect
            </Button>
          </Space.Compact>
        </Space>
      )}

      {error && (
        <Alert type="error" message={error} style={{ marginTop: 8, fontSize: 12 }} showIcon />
      )}
    </div>
  );
}

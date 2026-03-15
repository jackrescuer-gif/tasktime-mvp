import { useEffect, useState } from 'react';
import { Button, Form, Input, Select, Alert, Tag, Space, Popconfirm, Typography } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';
import * as gitlabApi from '../../api/gitlab';
import * as projectsApi from '../../api/projects';
import type { Project } from '../../types';

export default function GitLabSettings() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [status, setStatus] = useState<{ configured: boolean; gitlabUrl: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    projectsApi.listProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProjectId) { setStatus(null); return; }
    gitlabApi.getStatus(selectedProjectId).then(setStatus).catch(() => setStatus(null));
  }, [selectedProjectId]);

  const handleSave = async (values: {
    gitlabUrl: string;
    gitlabToken: string;
    webhookToken: string;
  }) => {
    if (!selectedProjectId) return;
    setSaving(true);
    setError(null);
    try {
      await gitlabApi.configure({ projectId: selectedProjectId, ...values });
      form.resetFields();
      const s = await gitlabApi.getStatus(selectedProjectId);
      setStatus(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Configuration failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedProjectId) return;
    try {
      await gitlabApi.deactivate(selectedProjectId);
      setStatus({ configured: false, gitlabUrl: null });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Deactivation failed');
    }
  };

  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
        Auto-update issue statuses from GitLab MR events.
      </Typography.Text>

      <Select
        style={{ width: '100%', marginBottom: 12 }}
        size="small"
        placeholder="Select project"
        value={selectedProjectId}
        onChange={setSelectedProjectId}
        options={projects.map((p) => ({ value: p.id, label: `${p.key} — ${p.name}` }))}
      />

      {status?.configured ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Tag color="green">Connected</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {status.gitlabUrl}
            </Typography.Text>
          </Space>
          <Popconfirm title="Deactivate GitLab integration?" onConfirm={handleDeactivate}>
            <Button size="small" danger icon={<DisconnectOutlined />}>
              Deactivate
            </Button>
          </Popconfirm>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            Webhook URL: <code>/api/integrations/gitlab/webhook</code>
          </Typography.Text>
        </Space>
      ) : selectedProjectId ? (
        <Form form={form} layout="vertical" size="small" onFinish={handleSave}>
          <Form.Item
            name="gitlabUrl"
            label="GitLab repository URL"
            rules={[{ required: true, type: 'url', message: 'Enter valid URL' }]}
          >
            <Input placeholder="https://gitlab.com/org/repo" />
          </Form.Item>
          <Form.Item
            name="gitlabToken"
            label="Personal access token"
            rules={[{ required: true }]}
          >
            <Input.Password placeholder="glpat-..." />
          </Form.Item>
          <Form.Item
            name="webhookToken"
            label="Webhook secret token"
            rules={[{ required: true }]}
          >
            <Input placeholder="Random secret for webhook verification" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} size="small">
            Save
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
            After saving, configure GitLab webhook URL:<br />
            <code>/api/integrations/gitlab/webhook</code>
          </Typography.Text>
        </Form>
      ) : null}

      {error && (
        <Alert type="error" message={error} style={{ marginTop: 8, fontSize: 12 }} showIcon />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Select, Table, Button, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminApi, type AdminUser, type ProjectRole } from '../../api/admin';
import api from '../../api/client';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'orange', MANAGER: 'blue', USER: 'green', VIEWER: 'default',
};

type ViewMode = 'by-user' | 'by-project';

export default function AdminRolesPage() {
  const [mode, setMode] = useState<ViewMode>('by-user');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; key: string }[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [projectMembers, setProjectMembers] = useState<{ user: AdminUser; roles: ProjectRole[] }[]>([]);

  const [newProjectId, setNewProjectId] = useState<string | undefined>();
  const [newUserId, setNewUserId] = useState<string | undefined>();
  const [newRole, setNewRole] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void adminApi.listUsers({ pageSize: 200 }).then(r => setUsers(r.users));
    void api.get<{ id: string; name: string; key: string }[]>('/projects').then(r => setProjects(r.data));
  }, []);

  const loadUserRoles = async (userId: string) => {
    try {
      const r = await adminApi.getUserRoles(userId);
      setRoles(r);
    } catch {
      void message.error('Не удалось загрузить роли');
    }
  };

  const loadProjectRoles = async (projectId: string) => {
    try {
      const r = await adminApi.listUsers({ pageSize: 200 });
      const members = r.users
        .map(u => ({ user: u, roles: (u.projectRoles ?? []).filter(pr => pr.projectId === projectId) }))
        .filter(m => m.roles.length > 0);
      setProjectMembers(members);
    } catch {
      void message.error('Не удалось загрузить участников');
    }
  };

  const handleAddRole = async () => {
    const userId = mode === 'by-user' ? selectedUserId : newUserId;
    const projectId = mode === 'by-user' ? newProjectId : selectedProjectId;
    if (!userId || !projectId || !newRole) return;
    setAdding(true);
    try {
      await adminApi.assignRole(userId, { projectId, role: newRole });
      void message.success('Роль назначена');
      setNewProjectId(undefined); setNewUserId(undefined); setNewRole(undefined);
      if (mode === 'by-user' && selectedUserId) await loadUserRoles(selectedUserId);
      else if (mode === 'by-project' && selectedProjectId) await loadProjectRoles(selectedProjectId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      void message.error(err?.response?.data?.error || 'Ошибка');
    } finally { setAdding(false); }
  };

  const handleRemove = async (userId: string, roleId: string) => {
    try {
      await adminApi.removeRole(userId, roleId);
      void message.success('Роль снята');
      if (mode === 'by-user' && selectedUserId) await loadUserRoles(selectedUserId);
      else if (mode === 'by-project' && selectedProjectId) await loadProjectRoles(selectedProjectId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      void message.error(err?.response?.data?.error || 'Ошибка');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4}>Назначение ролей</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Select
          value={mode}
          onChange={(v) => { setMode(v); setRoles([]); setProjectMembers([]); }}
          options={[
            { value: 'by-user', label: 'По пользователю' },
            { value: 'by-project', label: 'По проекту' },
          ]}
          style={{ width: 180 }}
        />
        {mode === 'by-user' && (
          <Select
            placeholder="Выберите пользователя"
            style={{ width: 260 }}
            value={selectedUserId}
            onChange={(v) => { setSelectedUserId(v); void loadUserRoles(v); }}
            options={users.map(u => ({ value: u.id, label: `${u.name} <${u.email}>` }))}
            showSearch
            filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          />
        )}
        {mode === 'by-project' && (
          <Select
            placeholder="Выберите проект"
            style={{ width: 260 }}
            value={selectedProjectId}
            onChange={(v) => { setSelectedProjectId(v); void loadProjectRoles(v); }}
            options={projects.map(p => ({ value: p.id, label: `${p.key}: ${p.name}` }))}
            showSearch
            filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          />
        )}
      </Space>

      {mode === 'by-user' && selectedUserId && (
        <>
          <Table
            rowKey="id"
            size="small"
            dataSource={roles}
            pagination={false}
            style={{ marginBottom: 16 }}
            columns={[
              { title: 'Проект', render: (_: unknown, r: ProjectRole) => `${r.project.key}: ${r.project.name}` },
              { title: 'Роль', dataIndex: 'role', render: (role: string) => <Tag color={ROLE_COLORS[role]}>{role}</Tag> },
              { title: 'Назначена', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString() },
              {
                title: '',
                render: (_: unknown, r: ProjectRole) => (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => void handleRemove(selectedUserId, r.id)} />
                ),
              },
            ]}
          />
          <Space>
            <Select placeholder="Проект" style={{ width: 200 }} value={newProjectId} onChange={setNewProjectId}
              options={projects.map(p => ({ value: p.id, label: `${p.key}: ${p.name}` }))} showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())} />
            <Select placeholder="Роль" style={{ width: 130 }} value={newRole} onChange={setNewRole}
              options={['ADMIN','MANAGER','USER','VIEWER'].map(r => ({ value: r, label: r }))} />
            <Button type="primary" icon={<PlusOutlined />} loading={adding}
              disabled={!newProjectId || !newRole} onClick={() => void handleAddRole()}>
              Добавить
            </Button>
          </Space>
        </>
      )}

      {mode === 'by-project' && selectedProjectId && (
        <>
          <Table
            rowKey={(r) => r.user.id + (r.roles[0]?.id ?? '')}
            size="small"
            dataSource={projectMembers}
            pagination={false}
            style={{ marginBottom: 16 }}
            columns={[
              { title: 'Пользователь', render: (_: unknown, m: { user: AdminUser; roles: ProjectRole[] }) => `${m.user.name} <${m.user.email}>` },
              {
                title: 'Роли',
                render: (_: unknown, m: { user: AdminUser; roles: ProjectRole[] }) => (
                  <Space>
                    {m.roles.map((r: ProjectRole) => (
                      <Tag key={r.id} color={ROLE_COLORS[r.role]} closable
                        onClose={() => void handleRemove(m.user.id, r.id)}>
                        {r.role}
                      </Tag>
                    ))}
                  </Space>
                ),
              },
            ]}
          />
          <Space>
            <Select placeholder="Пользователь" style={{ width: 240 }} value={newUserId} onChange={setNewUserId}
              options={users.map(u => ({ value: u.id, label: `${u.name} <${u.email}>` }))} showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())} />
            <Select placeholder="Роль" style={{ width: 130 }} value={newRole} onChange={setNewRole}
              options={['ADMIN','MANAGER','USER','VIEWER'].map(r => ({ value: r, label: r }))} />
            <Button type="primary" icon={<PlusOutlined />} loading={adding}
              disabled={!newUserId || !newRole} onClick={() => void handleAddRole()}>
              Добавить
            </Button>
          </Space>
        </>
      )}
    </div>
  );
}

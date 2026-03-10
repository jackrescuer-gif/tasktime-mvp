import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Team, User } from '../types';
import * as teamsApi from '../api/teams';
import * as usersApi from '../api/auth';

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [membersForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [teamsData, usersData] = await Promise.all([
        teamsApi.listTeams(),
        usersApi.listUsers?.() ?? Promise.resolve([]),
      ]);
      setTeams(teamsData);
      setUsers(usersData as User[]);
    } catch {
      message.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditingTeam(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    form.setFieldsValue({ name: team.name, description: team.description });
    setIsModalOpen(true);
  };

  const openMembers = async (team: Team) => {
    try {
      const full = await teamsApi.getTeam(team.id);
      setEditingTeam(full);
      membersForm.setFieldsValue({
        userIds: full.members?.map((m) => m.userId) ?? [],
      });
      setIsMembersModalOpen(true);
    } catch {
      message.error('Failed to load team members');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingTeam) {
        await teamsApi.updateTeam(editingTeam.id, values);
        message.success('Team updated');
      } else {
        await teamsApi.createTeam(values);
        message.success('Team created');
      }
      setIsModalOpen(false);
      await load();
    } catch (err) {
      if ((err as any).errorFields) return;
      message.error('Failed to save team');
    }
  };

  const handleDelete = async (team: Team) => {
    try {
      await teamsApi.deleteTeam(team.id);
      message.success('Team deleted');
      await load();
    } catch {
      message.error('Failed to delete team');
    }
  };

  const handleSaveMembers = async () => {
    if (!editingTeam) return;
    try {
      const values = await membersForm.validateFields();
      await teamsApi.updateTeamMembers(editingTeam.id, values.userIds);
      message.success('Members updated');
      setIsMembersModalOpen(false);
      await load();
    } catch (err) {
      if ((err as any).errorFields) return;
      message.error('Failed to update members');
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Teams</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New Team
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Table<Team>
            rowKey="id"
            loading={loading}
            dataSource={teams}
            pagination={false}
            columns={[
              {
                title: 'Name',
                dataIndex: 'name',
                key: 'name',
              },
              {
                title: 'Description',
                dataIndex: 'description',
                key: 'description',
              },
              {
                title: 'Members',
                key: 'members',
                render: (_, record) => (
                  <Space size="small" wrap>
                    {record.members?.slice(0, 5).map((m) => (
                      <Tag key={m.id}>{m.user.name}</Tag>
                    ))}
                    {record._count && record._count.members > 5 && (
                      <Tag>+{record._count.members - 5} more</Tag>
                    )}
                  </Space>
                ),
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_, record) => (
                  <Space>
                    <Button size="small" onClick={() => openEdit(record)}>
                      Edit
                    </Button>
                    <Button size="small" onClick={() => openMembers(record)}>
                      Members
                    </Button>
                    <Popconfirm
                      title="Delete team"
                      description="Are you sure you want to delete this team?"
                      onConfirm={() => handleDelete(record)}
                    >
                      <Button size="small" danger>
                        Delete
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Col>
      </Row>

      <Modal
        open={isModalOpen}
        title={editingTeam ? 'Edit Team' : 'New Team'}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSave}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter team name' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isMembersModalOpen}
        title="Team Members"
        onCancel={() => setIsMembersModalOpen(false)}
        onOk={handleSaveMembers}
        okText="Save"
      >
        <Form form={membersForm} layout="vertical">
          <Form.Item
            name="userIds"
            label="Members"
            rules={[{ required: true, message: 'Select at least one member' }]}
          >
            <Select
              mode="multiple"
              placeholder="Select users"
              optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


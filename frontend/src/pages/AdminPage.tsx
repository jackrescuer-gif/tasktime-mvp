import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserOutlined, ProjectOutlined, BugOutlined, ClockCircleOutlined } from '@ant-design/icons';
import * as adminApi from '../api/admin';
import * as authApi from '../api/auth';
import type { User } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  createdIssues: number;
  assignedIssues: number;
  timeLogs: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<adminApi.AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, adminUsers, allUsers] = await Promise.all([
          adminApi.getStats(),
          adminApi.listAdminUsers(),
          authApi.listUsers(),
        ]);
        setStats(statsData);
        const userMap: Record<string, User> = {};
        allUsers.forEach((u) => {
          userMap[u.id] = u;
        });
        setUsersMap(userMap);
        setUsers(
          adminUsers.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            isActive: u.isActive,
            createdAt: u.createdAt,
            createdIssues: u._count.createdIssues,
            assignedIssues: u._count.assignedIssues,
            timeLogs: u._count.timeLogs,
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading || !stats) return <LoadingSpinner />;

  const issuesByStatus = stats.issuesByStatus.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count._all;
    return acc;
  }, {});

  const issuesByAssignee = stats.issuesByAssignee.map((row) => ({
    assignee: row.assigneeId ? usersMap[row.assigneeId]?.name ?? 'Unknown' : 'Unassigned',
    count: row._count._all,
  }));

  const userColumns: ColumnsType<AdminUserRow> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag>{role}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Created Issues',
      dataIndex: 'createdIssues',
      key: 'createdIssues',
    },
    {
      title: 'Assigned Issues',
      dataIndex: 'assignedIssues',
      key: 'assignedIssues',
    },
    {
      title: 'Time Logs',
      dataIndex: 'timeLogs',
      key: 'timeLogs',
    },
  ];

  return (
    <div>
      <Typography.Title level={3}>Admin</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Users" value={stats.counts.users} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Projects" value={stats.counts.projects} prefix={<ProjectOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Issues" value={stats.counts.issues} prefix={<BugOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Time Logs" value={stats.counts.timeLogs} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="Issues by Status">
            {Object.entries(issuesByStatus).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{status}</span>
                <span>{count}</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Issues by Assignee">
            {issuesByAssignee.map((row) => (
              <div key={row.assignee} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{row.assignee}</span>
                <span>{row.count}</span>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Card title="Users">
        <Table<AdminUserRow> rowKey="id" dataSource={users} columns={userColumns} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );
}


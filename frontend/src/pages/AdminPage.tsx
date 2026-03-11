import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tag, Typography, Select, DatePicker, Space, Divider } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserOutlined, ProjectOutlined, BugOutlined, ClockCircleOutlined } from '@ant-design/icons';
import * as adminApi from '../api/admin';
import * as authApi from '../api/auth';
import type { User, Project, Sprint } from '../types';
import * as projectsApi from '../api/projects';
import * as sprintsApi from '../api/sprints';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([undefined, undefined]);
  const [reportByStatus, setReportByStatus] = useState<{ status: string; _count: { _all: number } }[]>([]);
  const [reportByAssignee, setReportByAssignee] = useState<{ assignee: string; count: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, adminUsers, allUsers, allProjects] = await Promise.all([
          adminApi.getStats(),
          adminApi.listAdminUsers(),
          authApi.listUsers(),
          projectsApi.listProjects(),
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
        setProjects(allProjects);
        if (allProjects.length > 0) {
          setSelectedProjectId(allProjects[0].id);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadReports = async () => {
      if (!selectedProjectId) return;
      const [from, to] = dateRange;
      const [statusData, assigneeData, projectUsers] = await Promise.all([
        adminApi.getIssuesByStatusReport({
          projectId: selectedProjectId,
          sprintId: selectedSprintId,
          from,
          to,
        }),
        adminApi.getIssuesByAssigneeReport({
          projectId: selectedProjectId,
          sprintId: selectedSprintId,
          from,
          to,
        }),
        authApi.listUsers(),
      ]);
      const userMap: Record<string, User> = {};
      projectUsers.forEach((u) => {
        userMap[u.id] = u;
      });
      setUsersMap((prev) => ({ ...prev, ...userMap }));
      setReportByStatus(statusData);
      setReportByAssignee(
        assigneeData.map((row) => ({
          assignee: row.assigneeId ? userMap[row.assigneeId]?.name ?? 'Unknown' : 'Unassigned',
          count: row._count._all,
        }))
      );
    };
    void loadReports();
  }, [selectedProjectId, selectedSprintId, dateRange]);

  useEffect(() => {
    const loadSprints = async () => {
      if (!selectedProjectId) {
        setSprints([]);
        setSelectedSprintId(undefined);
        return;
      }
      const data = await sprintsApi.listSprints(selectedProjectId);
      setSprints(data);
      if (!selectedSprintId && data.length > 0) {
        setSelectedSprintId(data[0].id);
      }
    };
    void loadSprints();
  }, [selectedProjectId]);

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
        <Col span={24}>
          <Card title="Reports">
            <Space style={{ marginBottom: 16 }} wrap>
              <Select
                placeholder="Project"
                style={{ minWidth: 200 }}
                value={selectedProjectId}
                onChange={(value) => setSelectedProjectId(value)}
                options={projects.map((p) => ({ value: p.id, label: `${p.key} - ${p.name}` }))}
              />
              <Select
                allowClear
                placeholder="Sprint"
                style={{ minWidth: 200 }}
                value={selectedSprintId}
                onChange={(value) => setSelectedSprintId(value)}
                options={sprints.map((s) => ({ value: s.id, label: s.name }))}
              />
              <DatePicker.RangePicker
                onChange={(values) =>
                  setDateRange([
                    values?.[0]?.startOf('day').toISOString(),
                    values?.[1]?.endOf('day').toISOString(),
                  ])
                }
              />
            </Space>
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="Issues by Status">
                  {reportByStatus.map((row) => (
                    <div
                      key={row.status}
                      style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                    >
                      <span>{row.status}</span>
                      <span>{row._count._all}</span>
                    </div>
                  ))}
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="Issues by Assignee">
                  {reportByAssignee.map((row) => (
                    <div
                      key={row.assignee}
                      style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                    >
                      <span>{row.assignee}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title="Users">
        <Table<AdminUserRow> rowKey="id" dataSource={users} columns={userColumns} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );
}


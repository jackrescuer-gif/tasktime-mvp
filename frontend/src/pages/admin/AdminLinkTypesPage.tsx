import { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Form, Modal, Switch, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as linksApi from '../../api/links';
import type { IssueLinkType } from '../../types';

export default function AdminLinkTypesPage() {
  const [linkTypes, setLinkTypes] = useState<IssueLinkType[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkTypeSearch, setLinkTypeSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const loadLinkTypes = async () => {
    setLoading(true);
    try {
      const types = await linksApi.listLinkTypes(true);
      setLinkTypes(types);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLinkTypes();
  }, []);

  const handleCreateLinkType = async (values: { name: string; outboundName: string; inboundName: string }) => {
    setCreating(true);
    try {
      const newType = await linksApi.createLinkType(values);
      setLinkTypes((prev) => [...prev, newType]);
      setCreateModalOpen(false);
      createForm.resetFields();
      void message.success('Тип связи создан');
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleLinkType = async (id: string, isActive: boolean) => {
    try {
      const updated = await linksApi.updateLinkType(id, { isActive });
      setLinkTypes((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Ошибка обновления');
    }
  };

  const columns: ColumnsType<IssueLinkType> = [
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
      filteredValue: [linkTypeSearch],
      onFilter: (value, record) =>
        record.name.toLowerCase().includes(String(value).toLowerCase()) ||
        record.outboundName.toLowerCase().includes(String(value).toLowerCase()) ||
        record.inboundName.toLowerCase().includes(String(value).toLowerCase()),
    },
    { title: 'Исходящая связь', dataIndex: 'outboundName', key: 'outboundName' },
    { title: 'Входящая связь', dataIndex: 'inboundName', key: 'inboundName' },
    {
      title: 'Статус',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Активна' : 'Неактивна'}</Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.isActive}
          onChange={(checked) => void handleToggleLinkType(record.id, checked)}
          checkedChildren="Вкл"
          unCheckedChildren="Выкл"
        />
      ),
    },
  ];

  return (
    <div className="tt-page">
      <div className="tt-page-header">
        <div>
          <h1 className="tt-page-title">Виды связей</h1>
          <p className="tt-page-subtitle">Управление типами связей между задачами</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Input.Search
          placeholder="Поиск по названию или связи..."
          style={{ maxWidth: 320 }}
          value={linkTypeSearch}
          onChange={(e) => setLinkTypeSearch(e.target.value)}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          Создать вид связи
        </Button>
      </div>

      <Table<IssueLinkType>
        className="tt-table"
        rowKey="id"
        dataSource={linkTypes}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Создать вид связи"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={creating}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values: { name: string; outboundName: string; inboundName: string }) =>
            void handleCreateLinkType(values)
          }
        >
          <Form.Item name="name" label="Наименование вида связи" rules={[{ required: true, message: 'Обязательное поле' }]}>
            <Input placeholder="Блокирует" />
          </Form.Item>
          <Form.Item name="outboundName" label="Исходящая связь" rules={[{ required: true, message: 'Обязательное поле' }]}>
            <Input placeholder="блокирует" />
          </Form.Item>
          <Form.Item name="inboundName" label="Входящая связь" rules={[{ required: true, message: 'Обязательное поле' }]}>
            <Input placeholder="заблокировано" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

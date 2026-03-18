import { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography } from 'antd';
import {
  ProjectOutlined,
  LogoutOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  DeploymentUnitOutlined,
  MenuOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import UatOnboardingOverlay from '../uat/UatOnboardingOverlay';
import { hasRequiredRole } from '../../lib/roles';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Закрываем сайдбар при изменении маршрута
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Блокируем скролл body когда сайдбар открыт на мобиле
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNav = (key: string) => {
    if (key.startsWith('/')) {
      navigate(key);
      setMobileOpen(false);
    }
  };

  const mainItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
    {
      key: '/business-teams',
      icon: <ApartmentOutlined />,
      label: 'Бизнес-команды',
    },
    {
      key: '/flow-teams',
      icon: <DeploymentUnitOutlined />,
      label: 'Потоковые команды',
    },
    { key: '/sprints', icon: <CalendarOutlined />, label: 'Sprints' },
    { key: '/time', icon: <ClockCircleOutlined />, label: 'My Time' },
    { key: '/teams', icon: <TeamOutlined />, label: 'Teams' },
    ...(hasRequiredRole(user?.role, 'ADMIN')
      ? [{ key: '/admin', icon: <SettingOutlined />, label: 'Admin' } as const]
      : []),
  ];

  const toolsItems = [
    {
      key: '/uat',
      icon: <CheckCircleOutlined />,
      label: 'UAT чек-листы',
    },
  ];

  const menuItems = [
    {
      type: 'group' as const,
      key: 'main',
      label: 'Навигация',
      children: mainItems,
    },
    {
      type: 'group' as const,
      key: 'tools',
      label: 'Инструменты',
      children: toolsItems,
    },
  ];

  return (
    <Layout className="tt-app-shell">
      {/* Backdrop-оверлей — только на мобильных, когда сайдбар открыт */}
      {mobileOpen && (
        <div
          className="tt-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sider
        width={220}
        theme="dark"
        className={`tt-sidebar${mobileOpen ? ' tt-sidebar--open' : ''}`}
      >
        <div className="tt-sidebar-header">
          <div className="tt-workspace-dot" />
          <Typography.Text className="tt-sidebar-workspace-name">
            TaskTime
          </Typography.Text>
          {/* Кнопка закрытия — видна только на мобиле внутри сайдбара */}
          <Button
            className="tt-sidebar-close-btn"
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть меню"
          />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="tt-sidebar-menu"
          onClick={({ key }) => handleNav(key as string)}
        />
      </Sider>

      <Layout className="tt-main">
        <Header className="tt-topbar">
          {/* Гамбургер — видна только на мобиле */}
          <Button
            className="tt-mobile-hamburger"
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileOpen(true)}
            aria-label="Открыть меню"
          />

          <div className="tt-topbar-right">
            <Typography.Text className="tt-topbar-user">
              <span className="tt-topbar-user-name">{user?.name}</span>
              <span className="tt-topbar-role">{user?.role}</span>
            </Typography.Text>
            <Button
              size="small"
              icon={<LogoutOutlined />}
              className="tt-topbar-logout"
              onClick={handleLogout}
            >
              <span className="tt-topbar-logout-label">Logout</span>
            </Button>
          </div>
        </Header>

        <Content className="tt-content">
          <Outlet />
          <UatOnboardingOverlay />
        </Content>
      </Layout>
    </Layout>
  );
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usePreferenceStore } from '../../store/preferenceStore'

const navItems = [
    { to: '/app/user', label: '用户管理', icon: 'users' },
    { to: '/app/documents', label: '文档操作', icon: 'document' },
    { to: '/app/collaboration', label: '实时协同', icon: 'collaboration' },
    { to: '/app/versions', label: '版本控制', icon: 'versions' },
    { to: '/app/permissions', label: '权限管理', icon: 'permissions' },
    { to: '/app/security', label: '数据安全', icon: 'security' },
    { to: '/app/admin', label: '系统管理', icon: 'admin' },
]

const iconPaths: Record<string, string> = {
    users: 'M9 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm12 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0ZM1.5 21v-1.2C1.5 16.5 4.7 14 8.6 14s7.1 2.5 7.1 5.8V21m2.7 0v-1c0-2.9 2.5-5.2 5.6-5.2 3.1 0 5.6 2.3 5.6 5.2v1',
    document:
        'M7 3.5h8.2L21 9.3V20a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 20V6A2.5 2.5 0 0 1 7 3.5Zm7.5 0V9h5.5',
    collaboration:
        'M8.5 19.2A4.7 4.7 0 1 1 10 10m3.3 2.1a4 4 0 1 1 5.2 5.8M8 20.5h8M12 3.5v3M5.4 5.4l2.1 2.1M18.6 5.4l-2.1 2.1',
    versions:
        'M7 5.2h12M7 12h12M7 18.8h12M3.8 5.2h.4M3.8 12h.4M3.8 18.8h.4',
    permissions:
        'M12 3.8c-3.8 0-6.8 3-6.8 6.8v2.1c0 1.1-.4 2.1-1 3v4.5h15.6v-4.5c-.6-.9-1-1.9-1-3v-2.1c0-3.8-3-6.8-6.8-6.8Zm0 14.4a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z',
    security:
        'M12 3.5 18.2 6v5.7c0 4.2-2.7 7.8-6.2 9.3-3.5-1.5-6.2-5.1-6.2-9.3V6L12 3.5Zm-2.4 8.2 1.4 1.4 3-3',
    admin:
        'M12 2.8 14.6 6l3.9.6-1.9 3.4.7 3.9-3.7-.8L12 15.1l-1.6-2-3.7.8.7-3.9-1.9-3.4L9.4 6 12 2.8Zm0 7.1a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Z',
}

const SidebarIcon = ({ name }: { name: string }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={iconPaths[name]} />
    </svg>
)

export const MainLayout = () => {
    const navigate = useNavigate()
    const logout = useAuthStore((state) => state.logout)
    const user = useAuthStore((state) => state.currentUser)
    const theme = usePreferenceStore((state) => state.preference.theme)

    return (
        <div className={`app-shell theme-${theme}`}>
            <aside className="sidebar">
                <nav>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                            aria-label={item.label}
                            title={item.label}
                        >
                            <SidebarIcon name={item.icon} />
                            <span className="sr-only">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>
            <main className="content">
                <header className="topbar">
                    <div>
                        <strong>{user?.username ?? '访客'}</strong>
                        <span>{user?.role ?? '未登录'}</span>
                    </div>
                    <button
                        className="ghost"
                        onClick={() => {
                            logout()
                            navigate('/auth')
                        }}
                    >
                        退出登录
                    </button>
                </header>
                <Outlet />
            </main>
        </div>
    )
}

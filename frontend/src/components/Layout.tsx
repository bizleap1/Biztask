import { useState } from 'react';
import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, FileText, Settings, LogOut, Users, Activity, Menu, X } from 'lucide-react';
import NotificationBell from './NotificationBell';
import Logo from './Logo';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // We'll replace this with real auth state later
  const token = sessionStorage.getItem('token');
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[var(--color-brand-gray-light)] text-[var(--color-brand-black)] overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[var(--color-bg-card)] flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-16 px-6 flex justify-between items-center shrink-0">
          <Link to="/" className="text-xl font-extrabold flex items-center gap-2 text-[var(--color-text-main)] tracking-tight">
            <Logo className="w-8 h-8" />
            BizLeap
          </Link>
          <button className="md:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {(() => {
            const getLinkClass = (path: string) => {
              const isActive = location.pathname.startsWith(path);
              return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${isActive ? 'bg-gray-100 text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:bg-gray-50 hover:text-[var(--color-text-main)]'}`;
            };
            return (
              <>
                <Link to="/dashboard" className={getLinkClass('/dashboard')} onClick={() => setSidebarOpen(false)}>
                  <Home size={18} /> Dashboard
                </Link>
          {(user.role === 'SuperAdmin' || user.role === 'Manager') && (
            <>
              <Link to="/tasks" className={getLinkClass('/tasks')} onClick={() => setSidebarOpen(false)}>
                <CheckSquare size={18} /> Tasks Overview
              </Link>
              <Link to="/review-submissions" className={getLinkClass('/review-submissions')} onClick={() => setSidebarOpen(false)}>
                <CheckSquare size={18} /> Review Submissions
              </Link>
              <Link to="/daily-reports" className={getLinkClass('/daily-reports')} onClick={() => setSidebarOpen(false)}>
                <FileText size={18} /> Daily Reports
              </Link>
            </>
          )}
          {(user.role === 'DevEmployee' || user.role === 'MediaEmployee') && (
            <>
              <Link to="/my-tasks" className={getLinkClass('/my-tasks')} onClick={() => setSidebarOpen(false)}>
                <CheckSquare size={18} /> My Tasks
              </Link>
              <Link to="/assign-task" className={getLinkClass('/assign-task')} onClick={() => setSidebarOpen(false)}>
                <CheckSquare size={18} /> Assign Task
              </Link>
              <Link to="/my-daily-reports" className={getLinkClass('/my-daily-reports')} onClick={() => setSidebarOpen(false)}>
                <FileText size={18} /> My Daily Reports
              </Link>
            </>
          )}
          {(user.role === 'SuperAdmin' || user.role === 'Manager') && (
            <Link to="/employees" className={getLinkClass('/employees')} onClick={() => setSidebarOpen(false)}>
              <Users size={18} /> Employees
            </Link>
          )}
          {(user.role === 'SuperAdmin' || user.role === 'Manager' || user.role === 'Viewer') && (
            <Link to="/activity-logs" className={getLinkClass('/activity-logs')} onClick={() => setSidebarOpen(false)}>
              <Activity size={18} /> Activity Logs
            </Link>
          )}
          {user.role === 'SuperAdmin' && (
            <Link to="/settings" className={getLinkClass('/settings')} onClick={() => setSidebarOpen(false)}>
              <Settings size={18} /> Settings
            </Link>
          )}
              </>
            );
          })()}
        </nav>

        <div className="p-4 bg-[var(--color-bg-main)]/30">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-[var(--color-brand-black)] flex items-center justify-center text-[var(--color-brand-white)] font-bold shadow-sm">
              {user.name ? user.name.charAt(0) : 'U'}
            </div>
            <div>
              <p className="text-sm font-medium">{user.name || 'User'}</p>
              <p className="text-xs text-gray-500">{user.role || 'Role'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 font-medium text-sm hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full bg-[var(--color-bg-main)]">
        <header className="h-16 bg-[var(--color-bg-card)] flex items-center px-4 md:px-8 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-[var(--color-text-main)] truncate">Operations Portal</h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

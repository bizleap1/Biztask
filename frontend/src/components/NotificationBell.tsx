import { useState, useEffect, useRef } from 'react';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const countData = await notificationService.getUnreadCount();
      setUnreadCount(countData.count);

      if (isOpen) {
        const data = await notificationService.getNotifications({ limit: 5 });
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      fetchNotifications();
      setIsOpen(false);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notif: any) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);

    const userStr = sessionStorage.getItem('user');
    const role: string = userStr ? (JSON.parse(userStr).role || '') : '';
    const isPrivileged = ['SuperAdmin', 'Manager', 'TeamLead'].includes(role);
    const isAdminOrManager = ['SuperAdmin', 'Manager'].includes(role);

    // Role-aware navigation based on entity type
    if (notif.entityType === 'Task') {
      if (notif.entityId) {
        navigate(`/tasks/${notif.entityId}`);
      } else {
        navigate(isPrivileged ? '/tasks' : '/my-tasks');
      }
    } else if (notif.entityType === 'TaskSubmission') {
      navigate(isPrivileged ? '/review-submissions' : '/my-tasks');
    } else if (notif.entityType === 'DailyReport') {
      navigate(isPrivileged ? '/daily-reports' : '/my-daily-reports');
    } else if (notif.entityType === 'User') {
      navigate(isAdminOrManager ? '/employees' : '/notifications');
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-[var(--color-brand-black)] hover:bg-gray-50 rounded-full transition-colors relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-xs text-[var(--color-brand-black)] hover:text-[var(--color-brand-gray-dark)] font-medium flex items-center gap-1"
              >
                <Check size={14} /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No new notifications
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-gray-50/30' : ''}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm ${!notif.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{notif.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
            <Link 
              to="/notifications" 
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-[var(--color-brand-black)] hover:text-[var(--color-brand-gray-dark)] flex items-center justify-center gap-1"
            >
              View all notifications <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

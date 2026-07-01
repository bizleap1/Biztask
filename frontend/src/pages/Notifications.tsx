import { useState, useEffect } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { notificationService } from '../services/notificationService';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread
  const [typeFilter, setTypeFilter] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 50 };
      if (filter === 'unread') params.isRead = false;
      if (typeFilter) params.type = typeFilter;

      const data = await notificationService.getNotifications(params);
      setNotifications(data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter, typeFilter]);

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
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationService.deleteNotification(id);
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="text-[var(--color-brand-black)]" /> Notifications
          </h1>
          <p className="text-gray-500 text-sm mt-1">Stay updated on your recent activities and tasks.</p>
        </div>
        <button 
          onClick={handleMarkAllAsRead}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium"
        >
          <Check size={16} /> Mark all as read
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm"
        >
          <option value="all">All Status</option>
          <option value="unread">Unread Only</option>
        </select>
        <select 
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm"
        >
          <option value="">All Types</option>
          <option value="task_assigned">Task Assigned</option>
          <option value="task_approved">Task Approved</option>
          <option value="task_rejected">Task Rejected</option>
          <option value="daily_report_reviewed">Report Reviewed</option>
          <option value="daily_report_correction">Report Needs Correction</option>
          <option value="employee_created">Account Related</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Bell className="text-gray-300" size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No notifications yet</h3>
            <p className="text-gray-500 text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 flex items-start gap-4 transition-colors ${!notif.isRead ? 'bg-gray-50/40' : 'hover:bg-gray-50'}`}
              >
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!notif.isRead ? 'bg-blue-600' : 'bg-transparent'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className={`text-sm ${!notif.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${!notif.isRead ? 'text-gray-700' : 'text-gray-500'}`}>
                    {notif.message}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 sm:opacity-100">
                  {!notif.isRead && (
                    <button 
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-gray-400 hover:text-[var(--color-brand-black)] p-1.5 rounded-md hover:bg-gray-50 transition-colors"
                      title="Mark as read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(notif.id)}
                    className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

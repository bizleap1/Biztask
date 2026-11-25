import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { CheckCircle, Clock, XCircle, AlertTriangle, FileText, CheckSquare, Target, Bell } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import TaskProgressionWidget from '../../components/TaskProgressionWidget';

export default function EmployeeDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { notificationService } = await import('../../services/notificationService');
      const data = await notificationService.getNotifications({ limit: 5 });
      setNotifications(data.notifications);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await dashboardService.getEmployeeDashboard();
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load data.</div>;

  const taskData = [
    { name: 'Pending', value: data.myPendingTasks, color: '#f59e0b' },
    { name: 'In Progress', value: data.myInProgressTasks, color: '#3b82f6' },
    { name: 'Submitted', value: data.mySubmittedTasks, color: '#6366f1' },
    { name: 'Approved', value: data.myApprovedTasks, color: '#10b981' },
    { name: 'Rejected', value: data.myRejectedTasks, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.name}!</h1>
          <p className="text-gray-500 mt-1">Here is your productivity overview.</p>
        </div>
        <button onClick={fetchData} disabled={refreshing} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
          {refreshing ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></span> : null}
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Daily Report Alert */}
      {data.todayReportStatus === 'Missing' ? (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-800">
            <AlertTriangle className="text-red-500" />
            <div>
              <p className="font-bold">You have not submitted today's daily report.</p>
              <p className="text-sm">Please submit it before the end of your shift.</p>
            </div>
          </div>
          <Link to="/my-daily-reports" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Submit Daily Report
          </Link>
        </div>
      ) : data.todayReportStatus === 'Needs Correction' ? (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3 text-orange-800">
            <AlertTriangle className="text-orange-500" />
            <div>
              <p className="font-bold">Your daily report needs correction.</p>
              <p className="text-sm">Manager Feedback: {data.latestManagerFeedback}</p>
            </div>
          </div>
          <Link to="/my-daily-reports" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            Correct Report
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 text-green-800">
          <CheckCircle className="text-green-500" />
          <p className="font-medium">Today's daily report submitted successfully.</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Tasks</p>
              <p className="text-3xl font-bold mt-1">{data.myTotalTasks}</p>
            </div>
            <div className="p-3 bg-gray-50 text-gray-500 rounded-lg"><CheckSquare size={20} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold mt-1 text-yellow-600">{data.myPendingTasks}</p>
            </div>
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg"><Clock size={20} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm font-medium">Approved</p>
              <p className="text-3xl font-bold mt-1 text-green-600">{data.myApprovedTasks}</p>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={20} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm font-medium">Overdue</p>
              <p className="text-3xl font-bold mt-1 text-red-600">{data.myOverdueTasks}</p>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={20} /></div>
          </div>
        </div>
      </div>

      <TaskProgressionWidget />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm md:col-span-1 flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Task Status Breakdown</h2>
          <div className="flex-1 min-h-[250px]">
            {taskData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {taskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No tasks assigned yet.</div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm md:col-span-1 flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Bell size={20} className="text-[var(--color-brand-gray-dark)]"/> Recent Notifications
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3">
            {notifications.length > 0 ? (
              notifications.map((notif: any) => (
                <div key={notif.id} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm ${!notif.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {notif.title}
                    </h4>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{notif.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent notifications.</p>
            )}
          </div>
        </div>

        {/* Performance & Deadlines */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm md:col-span-2">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-indigo-50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-indigo-600 text-sm font-medium mb-1">Task Completion Rate</p>
                <p className="text-2xl font-bold text-indigo-900">{data.myTaskCompletionRate}%</p>
              </div>
              <Target className="text-indigo-300" size={32} />
            </div>
            <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-[var(--color-brand-black)] text-sm font-medium mb-1">Report Submission Rate</p>
                <p className="text-2xl font-bold text-[var(--color-brand-black)]">{data.myReportSubmissionRate}%</p>
              </div>
              <FileText className="text-blue-300" size={32} />
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Deadlines</h2>
          {data.myUpcomingDeadlines?.length > 0 ? (
            <div className="space-y-3">
              {data.myUpcomingDeadlines.map((task: any) => (
                <div key={task.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <Link to={`/tasks/${task.id}`} className="font-medium text-gray-900 hover:text-indigo-600">{task.title}</Link>
                    <p className="text-sm text-gray-500 mt-1">Status: {task.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{new Date(task.deadline).toLocaleDateString()}</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                      task.priority === 'Urgent' ? 'badge-danger' :
                      task.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'badge-neutral'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No upcoming deadlines.</p>
          )}
        </div>
      </div>
      
      {data.myRejectedTasksWithFeedback?.length > 0 && (
        <div className="bg-red-50 p-6 rounded-xl border border-red-100">
          <h2 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2"><XCircle size={20} /> Rejected Submissions</h2>
          <div className="space-y-3">
            {data.myRejectedTasksWithFeedback.map((sub: any) => (
              <div key={sub.id} className="bg-white p-4 rounded-lg shadow-sm border border-red-100">
                <Link to={`/tasks/${sub.taskId}`} className="font-medium text-gray-900 hover:text-indigo-600 mb-1 inline-block">{sub.task.title}</Link>
                <p className="text-sm text-red-700 font-medium mt-2">Manager Feedback: {sub.managerFeedback}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

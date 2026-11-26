import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Users,
  CheckSquare,
  CheckCircle2,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../services/api';

interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  recentSubmissions: number;
}

interface DepartmentTaskMetric {
  departmentId: number;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  avgCompletionHours: number;
}

interface StatusBreakdownItem {
  status: string;
  count: number;
}

interface TaskMetricsResponse {
  byDepartment: DepartmentTaskMetric[];
  statusBreakdown: StatusBreakdownItem[];
}

interface LoginDayItem {
  date: string;
  count: number;
}

interface RoleDistributionItem {
  role: string;
  count: number;
}

interface UserActivityResponse {
  loginsByDay: LoginDayItem[];
  roleDistribution: RoleDistributionItem[];
}

const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];

function useAnalytics() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [taskMetrics, setTaskMetrics] = useState<TaskMetricsResponse | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, tasksRes, usersRes] = await Promise.all([
        api.get<OverviewStats>('/analytics/overview'),
        api.get<TaskMetricsResponse>('/analytics/tasks'),
        api.get<UserActivityResponse>('/analytics/users'),
      ]);
      setOverview(overviewRes.data);
      setTaskMetrics(tasksRes.data);
      setUserActivity(usersRes.data);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setError(apiErr.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  return { overview, taskMetrics, userActivity, loading, error, refetch: fetchAnalytics };
}

export default function Analytics() {
  const { overview, taskMetrics, userActivity, loading, error, refetch } = useAnalytics();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-main)]">Analytics Dashboard</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Organization-wide task performance, department throughput, and user activity.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-gray-200 text-sm font-medium text-[var(--color-text-main)] hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Total Users
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-main)] mt-1">
                {overview.totalUsers}
              </p>
              <p className="text-xs text-emerald-600 mt-1">{overview.activeUsers} active</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users size={20} />
            </div>
          </div>

          <div className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Total Tasks
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-main)] mt-1">
                {overview.totalTasks}
              </p>
              <p className="text-xs text-amber-600 mt-1">{overview.pendingTasks} in progress / pending</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckSquare size={20} />
            </div>
          </div>

          <div className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Completed Tasks
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-main)] mt-1">
                {overview.completedTasks}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                {overview.totalTasks > 0
                  ? `${Math.round((overview.completedTasks / overview.totalTasks) * 100)}% completion rate`
                  : '0% completion rate'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Recent Submissions
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-main)] mt-1">
                {overview.recentSubmissions}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Last 7 days</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck size={20} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-[var(--color-text-main)] mb-4">
            Tasks by Department
          </h2>
          {taskMetrics && taskMetrics.byDepartment.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskMetrics.byDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="departmentName" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completedTasks" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendingTasks" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
              No department task data available yet.
            </p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-[var(--color-text-main)] mb-4">
            Daily Logins (Last 14 Days)
          </h2>
          {userActivity && userActivity.loginsByDay.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userActivity.loginsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Logins"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
              No login activity recorded in the last 14 days.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-[var(--color-text-main)] mb-4">
            User Role Distribution
          </h2>
          {userActivity && userActivity.roleDistribution.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userActivity.roleDistribution}
                    dataKey="count"
                    nameKey="role"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {userActivity.roleDistribution.map((entry, idx) => (
                      <Cell key={entry.role} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
              No user role data available.
            </p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-[var(--color-text-main)] mb-4">
            Average Completion Time by Department
          </h2>
          {taskMetrics && taskMetrics.byDepartment.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-[var(--color-text-muted)] border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 pr-4">Department</th>
                    <th className="py-2.5 px-4">Total</th>
                    <th className="py-2.5 px-4">Completed</th>
                    <th className="py-2.5 pl-4 text-right">Avg Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {taskMetrics.byDepartment.map((dept) => (
                    <tr key={dept.departmentId}>
                      <td className="py-2.5 pr-4 font-medium text-[var(--color-text-main)]">
                        {dept.departmentName}
                      </td>
                      <td className="py-2.5 px-4">{dept.totalTasks}</td>
                      <td className="py-2.5 px-4 text-emerald-600">{dept.completedTasks}</td>
                      <td className="py-2.5 pl-4 text-right font-mono">{dept.avgCompletionHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
              No department metrics available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

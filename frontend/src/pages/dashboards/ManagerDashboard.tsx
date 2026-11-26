import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { Users, FileText, AlertTriangle, LayoutDashboard, Target, Activity, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData(false);
  }, [filters]);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!data || !isRefresh) setLoading(true);
      else setRefreshing(true);
      const res = await dashboardService.getManagerDashboard(filters);
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (!data && loading) return <div className="p-8 text-center text-gray-500">Loading Manager Dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load data.</div>;

  const taskStatusData = [
    { name: 'Pending', value: data.pendingTeamTasks, color: '#f59e0b' },
    { name: 'In Progress', value: data.inProgressTeamTasks, color: '#3b82f6' },
    { name: 'Submitted', value: data.submittedTeamTasks, color: '#6366f1' },
    { name: 'Approved', value: data.approvedTeamTasks, color: '#10b981' },
    { name: 'Rejected', value: data.rejectedTeamTasks, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Analytics</h1>
          <p className="text-gray-500 mt-1">Overview of your department's performance.</p>
        </div>
        
        <div className="w-full md:w-auto flex flex-wrap gap-2 md:gap-3 items-center bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <Filter className="text-gray-400 ml-2" size={18} />
          <input 
            type="date"
            className="w-full sm:w-auto p-1.5 bg-transparent border-none outline-none text-sm text-gray-600"
            value={filters.startDate}
            onChange={e => setFilters({...filters, startDate: e.target.value})}
          />
          <span className="text-gray-400 text-sm">to</span>
          <input 
            type="date"
            className="w-full sm:w-auto p-1.5 bg-transparent border-none outline-none text-sm text-gray-600"
            value={filters.endDate}
            onChange={e => setFilters({...filters, endDate: e.target.value})}
          />
          <button onClick={() => fetchData(true)} disabled={refreshing} className="w-full sm:w-auto ml-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors p-2 disabled:opacity-50 flex items-center justify-center gap-2">
            {refreshing ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></span> : null}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div onClick={() => navigate('/tasks')} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Team Size</p>
              <p className="text-3xl font-bold mt-1 text-gray-900">{data.teamEmployees}</p>
            </div>
            <div className="p-2 bg-gray-50 text-[var(--color-brand-black)] rounded-lg"><Users size={20} /></div>
          </div>
          <p className="text-xs text-green-600 mt-3 font-medium">{data.activeTeamEmployees} Active</p>
        </div>
        
        <div onClick={() => navigate('/tasks?overdue=true')} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Tasks</p>
              <p className="text-3xl font-bold mt-1 text-gray-900">{data.totalTeamTasks}</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><LayoutDashboard size={20} /></div>
          </div>
          <p className="text-xs text-gray-500 mt-3 font-medium">{data.approvedTeamTasks} Approved</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Overdue</p>
              <p className="text-3xl font-bold mt-1 text-red-600">{data.overdueTeamTasks}</p>
            </div>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={20} /></div>
          </div>
          <p className="text-xs text-red-500 mt-3 font-medium">Needs attention</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Missing Reports (Today)</p>
              <p className="text-3xl font-bold mt-1 text-orange-600">{data.missingTeamReportsToday}</p>
            </div>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><FileText size={20} /></div>
          </div>
          <p className="text-xs text-gray-500 mt-3 font-medium">{data.todayTeamReports} Submitted Today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Chart & Team Performance */}
        <div className="space-y-6 lg:col-span-2">
          {/* Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Team Task Overview</h2>
            <div className="flex-1 min-h-[300px]">
              {taskStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={(entry: any) => navigate(`/tasks?status=${encodeURIComponent(entry.name)}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {taskStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">No task data available</div>
              )}
            </div>
          </div>

          {/* Performance Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Team Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="p-4 font-medium">Employee</th>
                    <th className="p-4 font-medium">Total</th>
                    <th className="p-4 font-medium">Approved</th>
                    <th className="p-4 font-medium">Overdue</th>
                    <th className="p-4 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.teamPerformanceSummary?.length > 0 ? (
                    data.teamPerformanceSummary.sort((a:any,b:any) => b.score - a.score).map((emp: any) => (
                      <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 font-medium text-gray-900">{emp.name}</td>
                        <td className="p-4 text-gray-600">{emp.totalTasks}</td>
                        <td className="p-4 text-green-600 font-medium">{emp.approved}</td>
                        <td className="p-4 text-red-600 font-medium">{emp.overdue}</td>
                        <td className="p-4">
                          <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold text-xs">
                            {emp.score} pts
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500">No team members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Action items & Deadlines */}
        <div className="space-y-6 lg:col-span-1">
          {/* Action Required */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Target size={20} className="text-indigo-500"/> Action Required
            </h2>
            <div className="space-y-4">
              <Link to="/review-submissions" className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors block cursor-pointer">
                <div>
                  <p className="text-sm font-bold text-indigo-900">Task Submissions</p>
                  <p className="text-xs text-indigo-700 mt-0.5">Pending Your Review</p>
                </div>
                <span className="text-xl font-bold text-indigo-600">{data.pendingReviewSubmissions}</span>
              </Link>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <p className="text-sm font-bold text-red-900">Overdue Tasks</p>
                  <p className="text-xs text-red-700 mt-0.5">Follow up required</p>
                </div>
                <span className="text-xl font-bold text-red-600">{data.overdueTeamTasks}</span>
              </div>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Deadlines</h2>
            <div className="space-y-3">
              {data.upcomingTeamDeadlines?.length > 0 ? (
                data.upcomingTeamDeadlines.map((task: any) => (
                  <div key={task.id} className="p-3 border border-gray-100 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Assignee: {task.assignedTo?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-900">{new Date(task.deadline).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No upcoming deadlines.</p>
              )}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col h-full max-h-[400px]">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity size={20} className="text-[var(--color-brand-gray-dark)]"/> Activity Feed
            </h2>
            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
              {data.recentActivityLogs?.length > 0 ? (
                data.recentActivityLogs.map((log: any, idx: number) => (
                  <div key={idx} className="flex gap-3 items-start relative pb-4">
                    {idx !== data.recentActivityLogs.length -1 && (
                      <div className="absolute left-[9px] top-6 bottom-0 w-px bg-gray-100"></div>
                    )}
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 z-10 ${
                      log.type.includes('TASK') ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-green-100 border-2 border-green-500'
                    }`}></div>
                    <div>
                      <p className="text-sm text-gray-800 font-medium leading-tight">{log.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(log.date).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

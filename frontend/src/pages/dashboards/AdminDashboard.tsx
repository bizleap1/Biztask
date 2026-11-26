import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '../../services/dashboardService';
import { clearSystemData } from '../../services/api';
import { Users, FileText, CheckCircle, AlertTriangle, Filter, LayoutDashboard, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { taskService } from '../../services/taskService';
import { userService } from '../../services/userService';
import { dailyReportService } from '../../services/dailyReportService';
import { X } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', department: '' });
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalType, setModalType] = useState<'employees' | 'tasks' | 'overdue' | 'missingReports' | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalData, setModalData] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  const openModal = async (type: 'employees' | 'tasks' | 'overdue' | 'missingReports', title?: string, filter?: { status?: string, department?: string, isOverdue?: boolean }) => {
    setModalType(type);
    setModalTitle(title || '');
    setLoadingModal(true);
    setModalData([]);
    try {
      if (type === 'employees') {
        const emps = await userService.getUsers();
        setModalData(emps.filter((e: any) => e.isActive && e.role !== 'SuperAdmin'));
      } else if (type === 'tasks' || type === 'overdue') {
        const tasks = await taskService.getTasks();
        let filtered = tasks;
        if (type === 'overdue' || filter?.isOverdue) {
          filtered = filtered.filter((t: any) => t.status !== 'Approved' && new Date(t.deadline) < new Date());
        }
        if (filter?.status) {
          filtered = filtered.filter((t: any) => t.status === filter.status);
        }
        if (filter?.department) {
          filtered = filtered.filter((t: any) => t.department?.name === filter.department);
        }
        setModalData(filtered);
      } else if (type === 'missingReports') {
        const [emps, reports] = await Promise.all([
          userService.getUsers(),
          dailyReportService.getAllReports()
        ]);
        const today = new Date().toISOString().split('T')[0];
        const todayReports = reports.filter((r: any) => new Date(r.reportDate).toISOString().split('T')[0] === today);
        const reportersToday = new Set(todayReports.map((r: any) => r.userId));
        const missing = emps.filter((e: any) => e.isActive && (e.role === 'DevEmployee' || e.role === 'MediaEmployee') && !reportersToday.has(e.id));
        setModalData(missing);
      }
    } catch (err) {
      console.error('Error fetching modal data', err);
    } finally {
      setLoadingModal(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [filters]);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!data || !isRefresh) setLoading(true);
      else setRefreshing(true);
      const res = await dashboardService.getAdminDashboard(filters);
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm("WARNING: This will permanently delete ALL tasks, reports, submissions, notifications, and activity logs. Users and departments will remain. Are you absolutely sure?")) {
      try {
        await clearSystemData();
        alert("System data cleared successfully.");
        fetchData(false);
      } catch (error) {
        console.error("Failed to clear data", error);
        alert("Error clearing data. Please try again.");
      }
    }
  };

  if (!data && loading) return <div className="p-8 text-center text-gray-500">Loading SuperAdmin Dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load data.</div>;

  const taskStatusData = [
    { name: 'Pending', value: data.pendingTasks, color: '#f59e0b' },
    { name: 'In Progress', value: data.inProgressTasks, color: '#3b82f6' },
    { name: 'Submitted', value: data.submittedTasks, color: '#6366f1' },
    { name: 'Approved', value: data.approvedTasks, color: '#10b981' },
    { name: 'Rejected', value: data.rejectedTasks, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SuperAdmin Analytics</h1>
          <p className="text-gray-500 mt-1">Company-wide performance and operations overview.</p>
        </div>
        
        <div className="w-full md:w-auto flex flex-wrap gap-2 md:gap-3 items-center bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <Filter className="text-gray-400 ml-2" size={18} />
          <select 
            className="w-full sm:w-auto p-2 bg-transparent border-none outline-none text-sm font-medium text-gray-600"
            value={filters.department}
            onChange={e => setFilters({...filters, department: e.target.value})}
          >
            <option value="">All Departments</option>
            <option value="Development">Development</option>
            <option value="Media">Media</option>
          </select>
          <div className="h-6 w-px bg-gray-200"></div>
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
          <button onClick={() => fetchData(true)} disabled={refreshing} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2">
            {refreshing ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></span> : null}
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
          <div className="h-6 w-px bg-gray-200"></div>
          <button 
            onClick={handleClearData} 
            className="w-full sm:w-auto ml-2 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded text-sm font-bold transition-colors"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div onClick={() => openModal('employees')} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Employees</p>
              <p className="text-3xl font-bold mt-1 text-gray-900">{data.totalEmployees}</p>
            </div>
            <div className="p-2 bg-gray-50 text-[var(--color-brand-black)] rounded-lg"><Users size={20} /></div>
          </div>
          <p className="text-xs text-green-600 mt-3 font-medium">{data.activeEmployees} Active</p>
        </div>
        
        <div onClick={() => openModal('tasks')} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Tasks</p>
              <p className="text-3xl font-bold mt-1 text-gray-900">{data.totalTasks}</p>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><LayoutDashboard size={20} /></div>
          </div>
          <p className="text-xs text-gray-500 mt-3 font-medium">{data.approvedTasks} Approved</p>
        </div>

        <div onClick={() => openModal('overdue')} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Overdue Tasks</p>
              <p className="text-3xl font-bold mt-1 text-red-600">{data.overdueTasks}</p>
            </div>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={20} /></div>
          </div>
          <p className="text-xs text-red-500 mt-3 font-medium">Needs attention</p>
        </div>

        <div onClick={() => openModal('missingReports')} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">Missing Reports (Today)</p>
              <p className="text-3xl font-bold mt-1 text-orange-600">{data.missingReportsToday}</p>
            </div>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><FileText size={20} /></div>
          </div>
          <p className="text-xs text-gray-500 mt-3 font-medium">{data.todayReports} Submitted Today</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Donut */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Task Status Overview</h2>
          <div className="flex-1 min-h-[300px]">
            {taskStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={taskStatusData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value"
                    onClick={(entry: any) => openModal('tasks', `Tasks: ${entry.name}`, { status: entry.name })}
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

        {/* Department Comparison Bar */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Department Task Metrics</h2>
          <div className="flex-1 min-h-[300px]">
            {data.departmentWiseTaskStats?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departmentWiseTaskStats} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} />
                  <RechartsTooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend />
                  <Bar dataKey="total" name="Total Tasks" fill="#94a3b8" radius={[4, 4, 0, 0]} onClick={(entry: any) => openModal('tasks', `Total Tasks: ${entry.name}`, { department: entry.name })} style={{ cursor: 'pointer' }} />
                  <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[4, 4, 0, 0]} onClick={(entry: any) => openModal('tasks', `Approved Tasks: ${entry.name}`, { department: entry.name, status: 'Approved' })} style={{ cursor: 'pointer' }} />
                  <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} onClick={(entry: any) => openModal('tasks', `Overdue Tasks: ${entry.name}`, { department: entry.name, isOverdue: true })} style={{ cursor: 'pointer' }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No department data</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Employee Performance Leaderboard</h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-medium">Employee</th>
                  <th className="p-4 font-medium">Department</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Approved</th>
                  <th className="p-4 font-medium">Overdue</th>
                  <th className="p-4 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.employeePerformanceSummary?.length > 0 ? (
                  data.employeePerformanceSummary.sort((a:any,b:any) => b.score - a.score).slice(0, 8).map((emp: any, index: number) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-medium text-gray-900 flex items-center gap-2">
                        {index < 3 && <span className={`w-2 h-2 rounded-full ${index===0?'bg-yellow-400':index===1?'bg-gray-400':'bg-amber-600'}`}></span>}
                        {emp.name}
                      </td>
                      <td className="p-4 text-gray-600">{emp.department}</td>
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
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">No performance data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar: Overdue & Activity */}
        <div className="space-y-6 lg:col-span-1">
          {/* Action Required */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-indigo-500"/> Action Required
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <div>
                  <p className="text-sm font-bold text-indigo-900">Task Submissions</p>
                  <p className="text-xs text-indigo-700 mt-0.5">Pending Manager Review</p>
                </div>
                <span className="text-xl font-bold text-indigo-600">{data.pendingReviewSubmissions}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div>
                  <p className="text-sm font-bold text-orange-900">Reports Needing Correction</p>
                  <p className="text-xs text-orange-700 mt-0.5">Awaiting employee fix</p>
                </div>
                <span className="text-xl font-bold text-orange-600">{data.reportsNeedingCorrection}</span>
              </div>
              <button
                onClick={() => navigate('/clients')}
                className="w-full flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100 text-left hover:bg-red-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-red-900">At-Risk Clients</p>
                  <p className="text-xs text-red-700 mt-0.5">Threshold: {data.atRiskThreshold || 3} overdue tasks</p>
                </div>
                <span className="text-xl font-bold text-red-600">{data.atRiskClients?.length || 0}</span>
              </button>
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
                      log.type.includes('Task') ? 'bg-indigo-100 border-2 border-indigo-500' : 'bg-green-100 border-2 border-green-500'
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

      {/* Details Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {modalTitle || (modalType === 'employees' ? 'Active Employees'
                  : modalType === 'tasks' ? 'All Tasks'
                  : modalType === 'overdue' ? 'Overdue Tasks'
                  : 'Missing Reports (Today)')}
              </h2>
              <button 
                onClick={() => setModalType(null)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {loadingModal ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {modalData.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No records found.</p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          {modalType === 'employees' || modalType === 'missingReports' ? (
                            <>
                              <th className="p-3 font-medium rounded-l-lg">Name</th>
                              <th className="p-3 font-medium">Role</th>
                              <th className="p-3 font-medium rounded-r-lg">{modalType === 'missingReports' || modalType === 'employees' ? 'Status' : 'Department'}</th>
                            </>
                          ) : (
                            <>
                              <th className="p-3 font-medium rounded-l-lg">Task Title</th>
                              <th className="p-3 font-medium">Assignee</th>
                              <th className="p-3 font-medium">Deadline</th>
                              <th className="p-3 font-medium rounded-r-lg">Status</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {modalData.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50/50">
                            {modalType === 'employees' || modalType === 'missingReports' ? (
                              <>
                                <td className="p-3 font-medium text-gray-900">{item.name}</td>
                                <td className="p-3 text-gray-600">{item.role}</td>
                                <td className="p-3 text-gray-600">
                                  {modalType === 'missingReports' ? (
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">Not Sent</span>
                                  ) : modalType === 'employees' ? (
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Active</span>
                                  ) : (
                                    item.department?.name || 'N/A'
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-medium text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => navigate(`/tasks/${item.id}`)}>{item.title}</td>
                                <td className="p-3 text-gray-600">{item.assignedTo?.name || 'Unassigned'}</td>
                                <td className="p-3 text-gray-600">{new Date(item.deadline).toLocaleDateString()}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    item.status === 'Approved' ? 'bg-green-100 text-green-700'
                                    : item.status === 'Overdue' || new Date(item.deadline) < new Date() ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {item.status}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

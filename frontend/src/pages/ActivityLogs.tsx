import { useState, useEffect } from 'react';
import { Activity, Search, FileText } from 'lucide-react';
import { activityLogService } from '../services/activityLogService';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 50 };
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;

      const data = await activityLogService.getActivityLogs(params);
      setLogs(data.logs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  // Handle search with debounce manually or on submit. For simplicity, we fetch on button click or enter
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="text-[var(--color-brand-black)]" /> System Activity Logs
        </h1>
        <p className="text-gray-500 text-sm mt-1">Audit trail of important actions within the operations portal.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <form onSubmit={handleSearch} className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Search descriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm"
          />
        </form>
        <select 
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm"
        >
          <option value="">All Actions</option>
          <option value="LOGIN">Login</option>
          <option value="TASK_CREATED">Task Created</option>
          <option value="TASK_UPDATED">Task Updated</option>
          <option value="TASK_SUBMITTED">Task Submitted</option>
          <option value="TASK_APPROVED">Task Approved</option>
          <option value="TASK_REJECTED">Task Rejected</option>
          <option value="DAILY_REPORT_SUBMITTED">Report Submitted</option>
          <option value="DAILY_REPORT_REVIEWED">Report Reviewed</option>
        </select>
        <select 
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 text-sm"
        >
          <option value="">All Entities</option>
          <option value="User">User</option>
          <option value="Task">Task</option>
          <option value="TaskSubmission">Task Submission</option>
          <option value="DailyReport">Daily Report</option>
        </select>
      </div>

      {/* Audit logs are immutable per security policy */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Time</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">User</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Action</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Entity</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="text-gray-300 mb-3" size={32} />
                      <p className="text-gray-500 font-medium">No activity logs found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[var(--color-brand-black)] text-xs font-bold">
                          {log.user?.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{log.user?.name || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.entityType || '-'} {log.entityId ? `#${log.entityId}` : ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 truncate max-w-xs">
                      {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

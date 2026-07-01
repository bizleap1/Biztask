import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye } from 'lucide-react';
import { taskService } from '../services/taskService';

export default function MyTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.getMyTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch my tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchStatus = statusFilter ? t.status === statusFilter : true;
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-gray-500 text-sm mt-1">View and manage tasks assigned to you.</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Search my tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300">
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* Task Grid */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No tasks found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((t) => (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                    t.priority === 'Urgent' ? 'badge-danger' :
                    t.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                    t.priority === 'Medium' ? 'badge-neutral' : 'badge-neutral'
                  }`}>
                    {t.priority}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    t.status === 'Approved' ? 'badge-success' :
                    t.status === 'Submitted' ? 'bg-purple-100 text-purple-700' :
                    t.status === 'Rejected' ? 'badge-danger' :
                    t.status === 'In Progress' ? 'badge-neutral' : 'badge-warning'
                  }`}>
                    {t.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">{t.title}</h3>
                <p className="text-sm text-gray-500 mb-4">{t.department?.name} • {t.category}</p>
                <div className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {t.description}
                </div>
              </div>
              <div className="border-t border-gray-100 p-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Deadline</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(t.deadline).toLocaleDateString()}</p>
                </div>
                <Link to={`/tasks/${t.id}`} className="flex items-center gap-2 text-sm font-medium text-[var(--color-brand-black)] hover:text-[var(--color-brand-black)]">
                  <Eye size={16} /> View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

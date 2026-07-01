import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';

const DEV_CATEGORIES = [
  'Website Development', 'Frontend Change', 'Backend API', 'Bug Fix',
  'UI/UX Update', 'Deployment', 'Database Work', 'Client Website Update',
  'Performance Optimization', 'Technical SEO Fix', 'GitHub/Code Review'
];

const MEDIA_CATEGORIES = [
  'Instagram Post', 'Instagram Reel', 'LinkedIn Post', 'Video Editing',
  'Content Calendar', 'Caption Writing', 'SEO On-page', 'SEO Off-page',
  'Keyword Research', 'Meta Ads Campaign', 'Campaign Report', 'Creative Design',
  'Client Social Media Report'
];

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    departmentId: '',
    category: '',
    assignedToId: '',
    priority: 'Medium',
    deadline: '',
    proofRequired: true,
    proofType: ''
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await userService.getUsers();
      setEmployees(data);
    } catch (error) {
      console.error('Failed to fetch employees', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchEmployees();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await taskService.createTask(formData);
      setShowAddModal(false);
      fetchTasks();
      // Reset
      setFormData({
        title: '', description: '', departmentId: '', category: '',
        assignedToId: '', priority: 'Medium', deadline: '', proofRequired: true, proofType: ''
      });
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create task');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await taskService.deleteTask(id);
      fetchTasks();
    } catch (error) {
      alert('Failed to delete task');
    }
  };

  // Derived state
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'Pending').length,
    inProgress: tasks.filter(t => t.status === 'In Progress').length,
    submitted: tasks.filter(t => t.status === 'Submitted').length,
    approved: tasks.filter(t => t.status === 'Approved').length,
  };

  const filteredTasks = tasks.filter(t => {
    const matchStatus = statusFilter ? t.status === statusFilter : true;
    const matchDept = deptFilter ? t.departmentId === Number(deptFilter) : true;
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchDept && matchSearch;
  });

  const availableCategories = formData.departmentId === '1' ? DEV_CATEGORIES : formData.departmentId === '2' ? MEDIA_CATEGORIES : [];
  const availableEmployees = employees.filter(emp => emp.departmentId === Number(formData.departmentId) && emp.isActive);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-gray-500 text-sm mt-1">Assign and track all company tasks.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[var(--color-brand-black)] hover:bg-[var(--color-brand-matte)] text-white font-medium py-2 px-5 rounded-full flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
        >
          Create Task <Plus size={20} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">In Progress</p>
          <p className="text-2xl font-bold text-[var(--color-brand-black)]">{stats.inProgress}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Submitted</p>
          <p className="text-2xl font-bold text-purple-600">{stats.submitted}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Approved</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Search tasks..."
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
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300">
          <option value="">All Departments</option>
          <option value="1">Development</option>
          <option value="2">Media</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Title & Category</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Assigned To</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Priority & Deadline</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading tasks...</td></tr>
              ) : filteredTasks.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No tasks found.</td></tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500">{t.department?.name} • {t.category}</p>
                    </td>
                    <td className="px-6 py-4">
                      {t.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 text-[var(--color-brand-black)] flex items-center justify-center text-xs font-bold">
                            {t.assignedTo.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{t.assignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                        t.priority === 'Urgent' ? 'badge-danger' :
                        t.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        t.priority === 'Medium' ? 'badge-neutral' : 'badge-neutral'
                      }`}>
                        {t.priority}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{new Date(t.deadline).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        t.status === 'Approved' ? 'badge-success' :
                        t.status === 'Submitted' ? 'bg-purple-100 text-purple-700' :
                        t.status === 'Rejected' ? 'badge-danger' :
                        t.status === 'In Progress' ? 'badge-neutral' : 'badge-warning'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link to={`/tasks/${t.id}`} className="inline-block text-gray-400 hover:text-[var(--color-brand-black)] transition-colors p-1" title="View">
                        <Eye size={18} />
                      </Link>
                      <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Create New Task</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="task-form" onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-md h-24" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                    <select required value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value, category: '', assignedToId: ''})} className="w-full px-3 py-2 border rounded-md">
                      <option value="">Select Department...</option>
                      <option value="1">Development</option>
                      <option value="2">Media</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select required disabled={!formData.departmentId} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                      <option value="">Select Category...</option>
                      {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                    <select disabled={!formData.departmentId} value={formData.assignedToId} onChange={e => setFormData({...formData, assignedToId: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                      <option value="">Unassigned</option>
                      {availableEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                    <input required type="date" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proof Type</label>
                    <select value={formData.proofType} onChange={e => setFormData({...formData, proofType: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                      <option value="">Any Format</option>
                      <option value="Image">Image</option>
                      <option value="PDF">PDF</option>
                      <option value="Video">Video</option>
                      <option value="Screenshot">Screenshot</option>
                      <option value="GitHub PR">GitHub PR</option>
                      <option value="Website URL">Website URL</option>
                      <option value="Social Media Link">Social Media Link</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mt-2">
                    <input type="checkbox" checked={formData.proofRequired} onChange={e => setFormData({...formData, proofRequired: e.target.checked})} className="rounded text-[var(--color-brand-black)] focus:ring-gray-300" />
                    Require proof submission for completion
                  </label>
                </div>
              </form>
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-gray-50">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" form="task-form" className="btn-primary py-2 px-4">Create Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

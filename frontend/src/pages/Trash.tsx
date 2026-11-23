import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, CheckCircle2, AlertCircle, FileText, CheckSquare, Users } from 'lucide-react';
import api from '../services/api';

interface TrashItem {
  id: number;
  type: 'task' | 'report' | 'user';
  title: string;
  detail: string;
  deletedAt: string;
  deletedById?: number;
}

export default function Trash() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'task' | 'report' | 'user'>('all');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const res = await api.get('/trash');
      setItems(res.data.items || []);
    } catch (err: any) {
      console.error('Error fetching trash:', err);
      setMsg({ text: 'Failed to load trash items.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (type: 'task' | 'report' | 'user', id: number) => {
    const key = `${type}-${id}`;
    setRestoringId(key);
    setMsg(null);
    try {
      await api.post('/trash/restore', { type, id });
      setItems(prev => prev.filter(item => !(item.type === type && item.id === id)));
      setMsg({ text: `Successfully restored ${type} #${id}`, type: 'success' });
    } catch (err: any) {
      setMsg({ text: err.response?.data?.message || 'Restore failed.', type: 'error' });
    } finally {
      setRestoringId(null);
    }
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return true;
    return item.type === activeTab;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="text-red-500" /> Trash & Recovery
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Audit trail of soft-deleted records. SuperAdmin can safely restore items at any time.
          </p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {msg.text}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {(['all', 'task', 'report', 'user'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab === 'all' && 'All Deleted'}
            {tab === 'task' && 'Tasks'}
            {tab === 'report' && 'Daily Reports'}
            {tab === 'user' && 'Users'}
            <span className="ml-2 text-xs opacity-75">
              ({items.filter(i => tab === 'all' || i.type === tab).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Type</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Item</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Deleted Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading deleted records...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Trash2 className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="font-medium">No soft-deleted items found.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {item.type === 'task' && <CheckSquare size={13} />}
                        {item.type === 'report' && <FileText size={13} />}
                        {item.type === 'user' && <Users size={13} />}
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(item.deletedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRestore(item.type, item.id)}
                        disabled={restoringId === `${item.type}-${item.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={14} />
                        {restoringId === `${item.type}-${item.id}` ? 'Restoring...' : 'Restore'}
                      </button>
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

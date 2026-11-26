import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

interface SettingItem {
  key: string;
  value: string;
  category: string;
  description?: string | null;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await api.get('/settings');
        setSettings(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => prev.map(s => (s.key === key ? { ...s, value } : s)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    setError('');
    try {
      const { data } = await api.put('/settings', { settings });
      setSettings(data);
      setSavedMsg('Settings saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
          <SettingsIcon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-main)]">System Settings</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Configure organization defaults, notification cutoffs, and client rules.</p>
        </div>
      </div>

      {savedMsg && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-center gap-2 text-green-800 text-sm">
          <CheckCircle2 size={18} /> {savedMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="card p-6 space-y-5">
        {settings.map(item => (
          <div key={item.key} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-gray-800 font-mono">{item.key}</label>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.category}</span>
            </div>
            {item.description && <p className="text-xs text-gray-500 mb-2">{item.description}</p>}
            <input
              type="text"
              value={item.value}
              onChange={e => handleChange(item.key, e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
        ))}

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 py-2.5 px-5 disabled:opacity-70"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

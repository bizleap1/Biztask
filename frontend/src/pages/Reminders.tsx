import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  MessageCircle,
  Mail,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Clock,
  X,
  Copy,
  Check,
} from 'lucide-react';
import api from '../services/api';

type ReminderCategory =
  | 'overdue_task'
  | 'upcoming_task'
  | 'missing_daily_report'
  | 'pending_review'
  | 'report_correction';

type ReminderSeverity = 'high' | 'medium' | 'low';

interface TargetUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  whatsappNumber: string | null;
}

interface UnifiedReminder {
  id: string;
  category: ReminderCategory;
  severity: ReminderSeverity;
  title: string;
  description: string;
  dueAt: string | null;
  targetUser: TargetUser | null;
  actionUrl: string;
}

interface ReminderTemplate {
  key: ReminderCategory;
  label: string;
  emailSubject: string;
  emailBody: string;
  whatsappText: string;
}

interface ReminderSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
}

const CATEGORY_LABELS: Record<ReminderCategory, string> = {
  overdue_task: 'Overdue Task',
  upcoming_task: 'Upcoming Deadline',
  missing_daily_report: 'Missing Daily Report',
  pending_review: 'Pending Review',
  report_correction: 'Report Correction',
};

const renderTemplate = (
  tpl: string,
  vars: Record<string, string>
): string => {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');
};

export default function Reminders() {
  const [reminders, setReminders] = useState<UnifiedReminder[]>([]);
  const [summary, setSummary] = useState<ReminderSummary>({
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state for WhatsApp or Email draft
  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'email' | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<UnifiedReminder | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (severityFilter) params.severity = severityFilter;

      const [remindersRes, templatesRes] = await Promise.all([
        api.get<{ reminders: UnifiedReminder[]; summary: ReminderSummary }>('/reminders', {
          params,
        }),
        api.get<{ templates: ReminderTemplate[] }>('/reminders/templates'),
      ]);

      setReminders(remindersRes.data.reminders);
      setSummary(remindersRes.data.summary);
      setTemplates(templatesRes.data.templates);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setError(apiErr.response?.data?.message || 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, severityFilter]);

  useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  const openChannelModal = (reminder: UnifiedReminder, channel: 'whatsapp' | 'email') => {
    const tpl = templates.find((t) => t.key === reminder.category);
    const vars: Record<string, string> = {
      name: reminder.targetUser?.name ?? 'Team Member',
      taskTitle: reminder.title,
      dueDate: reminder.dueAt ? new Date(reminder.dueAt).toLocaleDateString() : 'soon',
    };

    setSelectedReminder(reminder);
    setActiveChannel(channel);
    setModalError('');
    setCopied(false);

    if (channel === 'whatsapp') {
      setPhoneInput(
        reminder.targetUser?.whatsappNumber || reminder.targetUser?.phone || ''
      );
      setMessageInput(
        tpl ? renderTemplate(tpl.whatsappText, vars) : reminder.description
      );
    } else {
      setEmailInput(reminder.targetUser?.email || '');
      setSubjectInput(
        tpl ? renderTemplate(tpl.emailSubject, vars) : `Reminder: ${reminder.title}`
      );
      setMessageInput(
        tpl ? renderTemplate(tpl.emailBody, vars) : reminder.description
      );
    }
  };

  const closeModal = () => {
    setActiveChannel(null);
    setSelectedReminder(null);
    setModalError('');
  };

  const handleLaunchWhatsApp = async () => {
    if (!phoneInput.trim()) {
      setModalError('Please enter a WhatsApp phone number (with country code).');
      return;
    }
    setSending(true);
    setModalError('');
    try {
      const { data } = await api.post<{ url: string }>('/reminders/whatsapp-link', {
        phone: phoneInput,
        templateKey: selectedReminder?.category,
        customMessage: messageInput,
      });
      window.open(data.url, '_blank', 'noopener,noreferrer');
      closeModal();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setModalError(apiErr.response?.data?.message || 'Failed to generate WhatsApp link');
    } finally {
      setSending(false);
    }
  };

  const handleLaunchEmail = async (mode: 'gmail' | 'mailto') => {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setModalError('Please enter a valid recipient email address.');
      return;
    }
    setSending(true);
    setModalError('');
    try {
      const { data } = await api.post<{
        gmailComposeUrl: string;
        mailtoUrl: string;
      }>('/reminders/email-draft', {
        to: emailInput,
        templateKey: selectedReminder?.category,
        subject: subjectInput,
        body: messageInput,
      });
      const targetUrl = mode === 'gmail' ? data.gmailComposeUrl : data.mailtoUrl;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      closeModal();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setModalError(apiErr.response?.data?.message || 'Failed to generate email draft');
    } finally {
      setSending(false);
    }
  };

  const handleCopyDraft = async () => {
    const text =
      activeChannel === 'email'
        ? `Subject: ${subjectInput}\n\n${messageInput}`
        : messageInput;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <BellRing size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-main)]">
              Unified Reminder List
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Actionable follow-ups across overdue tasks, deadlines, daily reports, and pending reviews.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchReminders()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-gray-200 text-sm font-medium text-[var(--color-text-main)] hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase">
              Total Reminders
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-main)] mt-1">
              {summary.total}
            </p>
          </div>
          <BellRing size={20} className="text-indigo-600" />
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase">
              High Priority
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">{summary.high}</p>
          </div>
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase">
              Medium Priority
            </p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.medium}</p>
          </div>
          <Clock size={20} className="text-amber-500" />
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          <option value="overdue_task">Overdue Tasks</option>
          <option value="upcoming_task">Upcoming Deadlines</option>
          <option value="missing_daily_report">Missing Daily Reports</option>
          <option value="pending_review">Pending Reviews</option>
          <option value="report_correction">Report Corrections</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Reminder List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : reminders.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No pending reminders match your current filters.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reminders.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        item.severity === 'high'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.severity.toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    {item.dueAt && (
                      <span className="text-xs text-gray-400">
                        Due: {new Date(item.dueAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-main)]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">{item.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openChannelModal(item, 'whatsapp')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => openChannelModal(item, 'email')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium transition-colors"
                  >
                    <Mail size={14} /> Email Draft
                  </button>
                  <Link
                    to={item.actionUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium transition-colors"
                  >
                    Open <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Channel Composer Modal */}
      {activeChannel && selectedReminder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {activeChannel === 'whatsapp' ? (
                  <>
                    <MessageCircle size={18} className="text-emerald-600" /> WhatsApp Reminder
                  </>
                ) : (
                  <>
                    <Mail size={18} className="text-indigo-600" /> Email Reminder Draft
                  </>
                )}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 text-xs text-red-700 rounded">
                {modalError}
              </div>
            )}

            {activeChannel === 'whatsapp' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Recipient Phone / WhatsApp Number (with country code)
                </label>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="e.g. 919876543210"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="user@company.com"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Message
              </label>
              <textarea
                rows={5}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleCopyDraft()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Draft'}
              </button>

              <div className="flex items-center gap-2">
                {activeChannel === 'whatsapp' ? (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void handleLaunchWhatsApp()}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {sending ? 'Opening...' : 'Open WhatsApp'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void handleLaunchEmail('mailto')}
                      className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold disabled:opacity-60"
                    >
                      Mail App
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void handleLaunchEmail('gmail')}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {sending ? 'Opening...' : 'Open in Gmail'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Eye, Filter, CheckCircle, AlertCircle, MessageSquare, FileText } from 'lucide-react';
import { dailyReportService } from '../services/dailyReportService';

export default function DailyReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [feedbackType, setFeedbackType] = useState<'review' | 'needs-correction'>('review');
  const [feedback, setFeedback] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const fetchReports = async () => {
    try {
      const data = await dailyReportService.getAllReports(filters);
      setReports(data);
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoading(false);
    }
  };

  const openViewModal = (report: any) => {
    setSelectedReport(report);
    setShowViewModal(true);
  };

  const openFeedbackModal = (report: any, type: 'review' | 'needs-correction') => {
    setSelectedReport(report);
    setFeedbackType(type);
    setFeedback('');
    setShowFeedbackModal(true);
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (feedbackType === 'review') {
        await dailyReportService.reviewReport(selectedReport.id, feedback);
      } else {
        await dailyReportService.markNeedsCorrection(selectedReport.id, feedback);
      }
      setShowFeedbackModal(false);
      setSelectedReport(null);
      fetchReports();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to submit feedback');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Submitted': return 'badge-info';
      case 'Reviewed': return 'bg-green-100 text-green-800';
      case 'Needs Correction': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const todaysReports = reports.filter(r => r.reportDate.startsWith(today));
  const pendingReview = reports.filter(r => r.status === 'Submitted');
  const needsCorrection = reports.filter(r => r.status === 'Needs Correction');

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Daily Reports</h1>
          <p className="text-gray-500 mt-1">Review and manage employee daily reports.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Reports</p>
            <p className="text-3xl font-bold text-gray-900">{reports.length}</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg">
            <FileText size={24} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Today's Reports</p>
            <p className="text-3xl font-bold text-[var(--color-brand-black)]">{todaysReports.length}</p>
          </div>
          <div className="bg-gray-50 text-[var(--color-brand-black)] p-3 rounded-lg">
            <CheckCircle size={24} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-600">{pendingReview.length}</p>
          </div>
          <div className="bg-yellow-50 text-yellow-600 p-3 rounded-lg">
            <Eye size={24} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Needs Correction</p>
            <p className="text-3xl font-bold text-red-600">{needsCorrection.length}</p>
          </div>
          <div className="bg-red-50 text-red-600 p-3 rounded-lg">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-center">
        <Filter className="text-gray-400" />
        <select 
          className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Status</option>
          <option value="Submitted">Submitted (Pending Review)</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Needs Correction">Needs Correction</option>
        </select>

        <input 
          type="date"
          className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600"
          value={filters.startDate}
          onChange={(e) => setFilters({...filters, startDate: e.target.value})}
        />
        <span className="text-gray-400">to</span>
        <input 
          type="date"
          className="p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600"
          value={filters.endDate}
          onChange={(e) => setFilters({...filters, endDate: e.target.value})}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 text-sm">
                <th className="p-4 font-medium">Employee</th>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium">Report Date</th>
                <th className="p-4 font-medium">Work Completed Summary</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No reports found matching your filters.
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-gray-900 font-medium">
                      <div>
                        {report.user.name}
                        <p className="text-xs text-gray-500 font-normal">{report.user.role}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">
                      {report.department.name}
                    </td>
                    <td className="p-4 text-gray-900 font-medium">
                      {new Date(report.reportDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-gray-600 truncate max-w-xs">
                      {report.workCompleted}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      <button 
                        onClick={() => openViewModal(report)}
                        className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      {report.status === 'Submitted' && (
                        <>
                          <button 
                            onClick={() => openFeedbackModal(report, 'review')}
                            className="text-gray-400 hover:text-green-600 transition-colors p-1"
                            title="Mark as Reviewed"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => openFeedbackModal(report, 'needs-correction')}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Needs Correction"
                          >
                            <AlertCircle size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Daily Report: {selectedReport.user.name}
              </h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Date</p>
                  <p className="text-gray-900 font-medium">{new Date(selectedReport.reportDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Department</p>
                  <p className="text-gray-900 font-medium">{selectedReport.department.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Status</p>
                  <span className={`inline-block px-2 py-1 mt-1 rounded-full text-xs font-medium ${getStatusColor(selectedReport.status)}`}>
                    {selectedReport.status}
                  </span>
                </div>
              </div>

              {selectedReport.managerFeedback && (
                <div className={`p-4 rounded-lg ${selectedReport.status === 'Needs Correction' ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-gray-50 text-gray-800 border border-gray-200'}`}>
                  <h3 className="font-bold flex items-center gap-2 mb-1"><MessageSquare size={16} /> Previous Feedback</h3>
                  <p className="text-sm">{selectedReport.managerFeedback}</p>
                  {selectedReport.reviewedBy && (
                    <p className="text-xs mt-2 opacity-75">By {selectedReport.reviewedBy.name}</p>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Work Completed</h3>
                <div className="bg-gray-50 p-4 rounded-lg text-gray-800 whitespace-pre-wrap border border-gray-100">
                  {selectedReport.workCompleted}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Pending Work</h3>
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-800 whitespace-pre-wrap h-full border border-gray-100">
                    {selectedReport.pendingWork}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Tomorrow's Plan</h3>
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-800 whitespace-pre-wrap h-full border border-gray-100">
                    {selectedReport.tomorrowPlan}
                  </div>
                </div>
              </div>

              {selectedReport.blockers && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Blockers / Issues</h3>
                  <div className="bg-red-50 p-4 rounded-lg text-red-800 whitespace-pre-wrap border border-red-100">
                    {selectedReport.blockers}
                  </div>
                </div>
              )}

              {selectedReport.attachments && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Attachments</h3>
                  <a 
                    href={selectedReport.attachments} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                  >
                    View Attached Proof ↗
                  </a>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button 
                onClick={() => setShowViewModal(false)}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              {selectedReport.status === 'Submitted' && (
                <>
                  <button 
                    onClick={() => openFeedbackModal(selectedReport, 'needs-correction')}
                    className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Needs Correction
                  </button>
                  <button 
                    onClick={() => openFeedbackModal(selectedReport, 'review')}
                    className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Mark Reviewed
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className={`text-xl font-bold ${feedbackType === 'needs-correction' ? 'text-red-600' : 'text-green-600'}`}>
                {feedbackType === 'needs-correction' ? 'Request Correction' : 'Approve & Review'}
              </h2>
              <button onClick={() => setShowFeedbackModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={submitFeedback}>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {feedbackType === 'needs-correction' ? 'Correction Feedback (Required)' : 'Feedback (Optional)'}
                </label>
                <textarea
                  required={feedbackType === 'needs-correction'}
                  rows={4}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder={feedbackType === 'needs-correction' ? "Explain what needs to be fixed..." : "Great job!"}
                />
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
                <button 
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className={`${feedbackType === 'needs-correction' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg font-medium transition-colors`}
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

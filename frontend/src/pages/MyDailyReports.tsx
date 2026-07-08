import { useState, useEffect } from 'react';
import { Plus, Eye, Edit, AlertCircle } from 'lucide-react';
import { dailyReportService } from '../services/dailyReportService';

export default function MyDailyReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    workCompleted: '',
    pendingWork: '',
    blockers: '',
    tomorrowPlan: '',
    attachments: ''
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const data = await dailyReportService.getMyReports();
      setReports(data);
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      let attachmentUrl = formData.attachments;

      if (attachmentFile) {
        const { uploadFile } = await import('../services/api');
        const uploadRes = await uploadFile(attachmentFile);
        attachmentUrl = uploadRes.url;
      }

      const payload = {
        ...formData,
        attachments: attachmentUrl
      };

      if (selectedReport && selectedReport.status !== 'Reviewed') {
        await dailyReportService.updateReport(selectedReport.id, payload);
      } else {
        await dailyReportService.submitReport(payload);
      }
      setShowSubmitModal(false);
      setSelectedReport(null);
      resetForm();
      fetchReports();
      alert('Report submitted successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to submit report');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      reportDate: new Date().toISOString().split('T')[0],
      workCompleted: '',
      pendingWork: '',
      blockers: '',
      tomorrowPlan: '',
      attachments: ''
    });
  };

  const openSubmitModal = () => {
    resetForm();
    setAttachmentFile(null);
    setSelectedReport(null);
    setShowSubmitModal(true);
  };

  const openEditModal = (report: any) => {
    setSelectedReport(report);
    setFormData({
      reportDate: new Date(report.reportDate).toISOString().split('T')[0],
      workCompleted: report.workCompleted,
      pendingWork: report.pendingWork,
      blockers: report.blockers || '',
      tomorrowPlan: report.tomorrowPlan,
      attachments: report.attachments || ''
    });
    setShowSubmitModal(true);
  };

  const openViewModal = (report: any) => {
    setSelectedReport(report);
    setShowViewModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Submitted': return 'badge-info';
      case 'Reviewed': return 'bg-green-100 text-green-800';
      case 'Needs Correction': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Daily Reports</h1>
          <p className="text-gray-500 mt-1">Submit and track your daily work progress.</p>
        </div>
        <button 
          onClick={openSubmitModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={20} /> Submit Today's Report
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 text-sm">
                <th className="p-4 font-medium">Report Date</th>
                <th className="p-4 font-medium">Work Completed Summary</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No reports submitted yet.
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
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
                      {report.status === 'Needs Correction' && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={12} /> Feedback required
                        </p>
                      )}
                    </td>
                    <td className="p-4 flex gap-2">
                      <button 
                        onClick={() => openViewModal(report)}
                        className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      {(report.status === 'Submitted' || report.status === 'Needs Correction') && (
                        <button 
                          onClick={() => openEditModal(report)}
                          className="text-gray-400 hover:text-[var(--color-brand-black)] transition-colors p-1"
                          title="Edit/Correct Report"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit / Edit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedReport ? 'Edit Daily Report' : 'Submit Daily Report'}
              </h2>
              <button onClick={() => setShowSubmitModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {selectedReport?.status === 'Needs Correction' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-800">
                  <h3 className="font-bold flex items-center gap-2 mb-1"><AlertCircle size={18} /> Manager Feedback</h3>
                  <p className="text-sm">{selectedReport.managerFeedback}</p>
                </div>
              )}

              <form id="reportForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Date</label>
                  <input
                    type="date"
                    required
                    disabled={!!selectedReport}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.reportDate}
                    onChange={e => setFormData({...formData, reportDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Completed Today</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.workCompleted}
                    onChange={e => setFormData({...formData, workCompleted: e.target.value})}
                    placeholder="List everything you finished today..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pending Work</label>
                  <textarea
                    required
                    rows={2}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.pendingWork}
                    onChange={e => setFormData({...formData, pendingWork: e.target.value})}
                    placeholder="What is still left to do?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tomorrow's Plan</label>
                  <textarea
                    required
                    rows={2}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.tomorrowPlan}
                    onChange={e => setFormData({...formData, tomorrowPlan: e.target.value})}
                    placeholder="What will you work on tomorrow?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blockers / Issues (Optional)</label>
                  <textarea
                    rows={2}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.blockers}
                    onChange={e => setFormData({...formData, blockers: e.target.value})}
                    placeholder="Any obstacles preventing you from completing tasks?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attachments (Required File or URL)</label>
                  <div className="space-y-2">
                    <input 
                      type="file"
                      onChange={e => {
                        const file = e.target.files ? e.target.files[0] : null;
                        if (file && file.size > 4.5 * 1024 * 1024) {
                          alert('File is too large! Maximum allowed size is 4.5MB.');
                          e.target.value = '';
                          setAttachmentFile(null);
                        } else {
                          setAttachmentFile(file);
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 text-sm"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                    />
                    <div className="flex items-center text-sm text-gray-500 my-2">- OR -</div>
                    <input
                      type="url"
                      className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={formData.attachments}
                      onChange={e => setFormData({...formData, attachments: e.target.value})}
                      placeholder="https://... (External Link)"
                      disabled={!!attachmentFile}
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="reportForm"
                disabled={uploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : (selectedReport ? 'Resubmit Report' : 'Submit Report')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Daily Report Details
              </h2>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Date</p>
                  <p className="text-gray-900 font-medium">{new Date(selectedReport.reportDate).toLocaleDateString()}</p>
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
                  <h3 className="font-bold mb-1">Manager Feedback</h3>
                  <p className="text-sm">{selectedReport.managerFeedback}</p>
                  {selectedReport.reviewedBy && (
                    <p className="text-xs mt-2 opacity-75">Reviewed by: {selectedReport.reviewedBy.name}</p>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Work Completed</h3>
                <div className="bg-gray-50 p-4 rounded-lg text-gray-800 whitespace-pre-wrap">
                  {selectedReport.workCompleted}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Pending Work</h3>
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-800 whitespace-pre-wrap h-full">
                    {selectedReport.pendingWork}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Tomorrow's Plan</h3>
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-800 whitespace-pre-wrap h-full">
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
            
            <div className="p-6 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-xl">
              <button 
                onClick={() => setShowViewModal(false)}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

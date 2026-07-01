import { useState, useEffect } from 'react';
import { Eye, Check, X, MessageSquare } from 'lucide-react';
import { submissionService } from '../services/submissionService';

export default function ReviewSubmissions() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const data = await submissionService.getPendingSubmissions();
      setSubmissions(data);
    } catch (error) {
      console.error('Failed to fetch submissions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleApprove = async (id: number) => {
    if (!confirm('Are you sure you want to approve this submission?')) return;
    try {
      await submissionService.approveSubmission(id);
      fetchSubmissions();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve');
    }
  };

  const openRejectModal = (id: number) => {
    setActiveSubmissionId(id);
    setFeedback('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmissionId) return;
    try {
      await submissionService.rejectSubmission(activeSubmissionId, feedback);
      setShowRejectModal(false);
      fetchSubmissions();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review Submissions</h1>
        <p className="text-gray-500 text-sm mt-1">Review task proofs submitted by employees.</p>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          No pending submissions to review.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{sub.task.title}</h3>
                    <p className="text-sm text-gray-500">{sub.task.department.name} Task • Submitted by {sub.user.name}</p>
                  </div>
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                    Pending Review
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100">
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Completion Percentage</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-[var(--color-brand-black)] h-2 rounded-full" style={{ width: `${sub.completionPercentage}%` }}></div>
                      </div>
                      <span className="text-sm font-medium">{sub.completionPercentage}%</span>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Report</p>
                    <p className="text-sm text-gray-800 bg-white p-2 border rounded shadow-sm">{sub.reportText}</p>
                  </div>

                  {sub.proofUrl && (
                    <div className="mb-3 flex items-center gap-2">
                      <Eye size={16} className="text-gray-400" />
                      <a href={sub.proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--color-brand-black)] hover:underline">
                        View Proof {sub.proofType && `(${sub.proofType})`}
                      </a>
                    </div>
                  )}

                  {sub.blockers && (
                    <div>
                      <p className="text-xs text-red-500 font-semibold uppercase tracking-wider mb-1">Blockers / Issues</p>
                      <p className="text-sm text-gray-800 bg-red-50 p-2 border border-red-100 rounded text-red-900">{sub.blockers}</p>
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-gray-400">Submitted at: {new Date(sub.submittedAt).toLocaleString()}</p>
              </div>
              <div className="border-t border-gray-100 p-4 bg-gray-50 flex gap-3">
                <button 
                  onClick={() => openRejectModal(sub.id)}
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
                >
                  <X size={18} /> Reject
                </button>
                <button 
                  onClick={() => handleApprove(sub.id)}
                  className="flex-1 flex justify-center items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  <Check size={18} /> Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
              <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <MessageSquare size={20} /> Reject Submission
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-red-400 hover:text-red-600">&times;</button>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="p-5">
                <p className="text-sm text-gray-600 mb-4">Please provide detailed feedback on why this submission is being rejected. The employee will see this and will need to resubmit.</p>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager Feedback *</label>
                <textarea 
                  required
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-32 focus:outline-none focus:ring-2 focus:ring-red-500 border-red-200"
                  placeholder="E.g., The proof link is broken, or the image does not show the completed work clearly..."
                />
              </div>
              <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button type="button" onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm font-medium">Confirm Rejection</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

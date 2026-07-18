import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Send, CheckCircle, AlertCircle, FileText, Check } from 'lucide-react';
import { taskService } from '../services/taskService';

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  // Submit Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [formData, setFormData] = useState({
    reportText: '',
    proofUrl: '',
    completionPercentage: 100,
    blockers: '',
    notes: ''
  });
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Edit Task Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [employees, setEmployees] = useState<any[]>([]);

  const fetchTask = async () => {
    try {
      const data = await taskService.getTaskById(Number(id));
      setTask(data);
      setEditData({
        title: data.title,
        description: data.description,
        departmentId: data.departmentId,
        category: data.category,
        assignedToId: data.assignedToId || '',
        priority: data.priority,
        deadline: new Date(data.deadline).toISOString().split('T')[0],
        proofRequired: data.proofRequired,
        proofType: data.proofType || ''
      });
    } catch (error) {
      console.error('Failed to fetch task details', error);
      alert('Error or not authorized to view this task');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    if (user.role === 'SuperAdmin' || user.role === 'Manager') {
      try {
        const { userService } = await import('../services/userService');
        const data = await userService.getUsers();
        setEmployees(data);
      } catch (error) {
        console.error('Failed to fetch employees', error);
      }
    }
  };

  useEffect(() => {
    fetchTask();
    fetchEmployees();
  }, [id]);

  const handleStartTask = async () => {
    try {
      await taskService.updateTaskStatus(task.id, 'In Progress');
      fetchTask();
    } catch (error) {
      alert('Failed to start task');
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      let proofUrl = formData.proofUrl;
      let proofFileName = '';

      if (proofFiles.length > 0) {
        const { uploadFiles } = await import('../services/api');
        const uploadRes = await uploadFiles(proofFiles);
        proofUrl = JSON.stringify(uploadRes.files.map((f: any) => f.url));
        proofFileName = uploadRes.files.map((f: any) => f.fileName).join(', ');
      }

      const payload = {
        ...formData,
        proofUrl: proofUrl,
        proofFileName: proofFileName || undefined
      };

      await taskService.submitTask(task.id, payload);
      setShowSubmitModal(false);
      setProofFiles([]);
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to submit task');
    } finally {
      setUploading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await taskService.updateTask(task.id, editData);
      setShowEditModal(false);
      fetchTask();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update task');
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading task details...</div>;
  if (!task) return <div className="p-10 text-center text-red-500">Task not found.</div>;

  const isAssignedUser = task.assignedToId === user.id;
  const isManagerOrAdmin = user.role === 'Manager' || user.role === 'SuperAdmin';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{task.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{task.department?.name} • {task.category}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {isManagerOrAdmin && task.status !== 'Approved' && (
            <button 
              onClick={() => setShowEditModal(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Edit Task
            </button>
          )}
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
            task.status === 'Approved' ? 'badge-success' :
            task.status === 'Submitted' ? 'bg-purple-100 text-purple-700' :
            task.status === 'Rejected' ? 'badge-danger' :
            task.status === 'In Progress' ? 'badge-neutral' : 'badge-warning'
          }`}>
            {task.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="md:col-span-2 space-y-6">

          {/* Dynamic Fields */}
          {(task.clientName || task.driveLink || task.socialMediaPlatform || task.githubRepo) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">
                Project Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {task.clientName && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Client Name</p>
                    <p className="text-sm text-gray-900 mt-1">{task.clientName}</p>
                  </div>
                )}
                {task.driveLink && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Drive Link</p>
                    <a href={task.driveLink} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline mt-1 block truncate">
                      {task.driveLink}
                    </a>
                  </div>
                )}
                {task.socialMediaPlatform && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Platform</p>
                    <p className="text-sm text-gray-900 mt-1">{task.socialMediaPlatform}</p>
                  </div>
                )}
                {task.postType && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Post Type</p>
                    <p className="text-sm text-gray-900 mt-1">{task.postType}</p>
                  </div>
                )}
                {task.githubRepo && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">GitHub Repo</p>
                    <p className="text-sm text-gray-900 mt-1">{task.githubRepo}</p>
                  </div>
                )}
                {task.environment && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Environment</p>
                    <p className="text-sm text-gray-900 mt-1">{task.environment}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-[var(--color-brand-gray-dark)]" /> Description
            </h3>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {task.description}
            </div>
            
            {task.proofRequired && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-3">
                <AlertCircle size={20} className="text-[var(--color-brand-gray-dark)] mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--color-brand-black)] text-sm">Proof Submission Required</p>
                  <p className="text-sm text-[var(--color-brand-gray-dark)] mt-1">This task requires proof of completion. Allowed type: <span className="font-bold">{task.proofType || 'Any format'}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Submission History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">Submission History</h3>
            {task.submissions?.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No submissions yet.</p>
            ) : (
              <div className="space-y-4">
                {task.submissions.map((sub: any) => (
                  <div key={sub.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-gray-900">{sub.user?.name}</span>
                        <span className="text-gray-500 text-xs ml-2">{new Date(sub.submittedAt).toLocaleString()}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        sub.reviewStatus === 'Approved' ? 'badge-success' :
                        sub.reviewStatus === 'Rejected' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {sub.reviewStatus}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-semibold text-xs text-gray-500 uppercase">Report:</span> {sub.reportText}
                    </div>
                    {sub.proofUrl && (
                      <div className="flex flex-col gap-1 mt-2">
                        {(() => {
                           try {
                             const urls = JSON.parse(sub.proofUrl);
                             if (Array.isArray(urls)) {
                               return urls.map((u: string, i: number) => (
                                 <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">
                                   View Proof File {i+1}
                                 </a>
                               ));
                             }
                           } catch (e) {
                             // Fallback for single string URLs
                           }
                           return <a href={sub.proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">View Proof Link</a>;
                        })()}
                      </div>
                    )}
                    {sub.managerFeedback && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-800">
                        <span className="font-bold">Manager Feedback: </span>
                        {sub.managerFeedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Meta & Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">Task Details</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Assigned To</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{task.assignedTo?.name || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Assigned By</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{task.assignedBy?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Priority</p>
                <span className={`inline-block mt-1 text-xs font-bold px-2 py-1 rounded ${
                  task.priority === 'Urgent' ? 'badge-danger' :
                  task.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                  task.priority === 'Medium' ? 'badge-neutral' : 'badge-neutral'
                }`}>
                  {task.priority}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Deadline</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{new Date(task.deadline).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Created At</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{new Date(task.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
            {isAssignedUser && task.status === 'Pending' && (
              <button 
                onClick={handleStartTask}
                className="w-full btn-primary"
              >
                <Play size={18} /> Start Task
              </button>
            )}

            {isAssignedUser && (task.status === 'In Progress' || task.status === 'Rejected') && (
              <button 
                onClick={() => setShowSubmitModal(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
              >
                <Send size={18} /> Submit for Review
              </button>
            )}

            {isManagerOrAdmin && task.status === 'Submitted' && (
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 text-center">
                <p className="text-sm font-medium text-purple-800 mb-3">This task is waiting for your review.</p>
                <button 
                  onClick={() => navigate('/review-submissions')}
                  className="w-full bg-white border border-purple-200 text-purple-700 py-2 rounded-md hover:bg-purple-100 transition-colors text-sm font-medium"
                >
                  Go to Review Submissions
                </button>
              </div>
            )}

            {task.status === 'Approved' && (
              <div className="w-full bg-green-50 text-green-700 py-3 rounded-lg flex items-center justify-center gap-2 font-medium border border-green-200">
                <CheckCircle size={18} /> Task Completed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit Task Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50">
              <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                <Send size={20} /> Submit Work for Review
              </h3>
              <button onClick={() => setShowSubmitModal(false)} className="text-purple-400 hover:text-purple-600">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="submit-form" onSubmit={handleSubmitWork} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Report / Summary *</label>
                  <textarea 
                    required 
                    value={formData.reportText} 
                    onChange={e => setFormData({...formData, reportText: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-md h-32 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Describe what you did to complete this task..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Completion Percentage *</label>
                    <input 
                      type="number" min="0" max="100" required 
                      value={formData.completionPercentage} 
                      onChange={e => setFormData({...formData, completionPercentage: Number(e.target.value)})} 
                      className="w-full px-3 py-2 border rounded-md focus:ring-purple-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proof File / Link {task.proofRequired && '*'}
                    </label>
                    <div className="space-y-2">
                      <input 
                        type="file"
                        multiple
                        onChange={e => {
                          const selectedFiles = Array.from(e.target.files || []);
                          let newFiles = [...proofFiles, ...selectedFiles];
                          let nonImageCount = 0;
                          let validFiles: File[] = [];

                          for (const file of newFiles) {
                            if (file.size > 4.5 * 1024 * 1024) {
                              alert(`File ${file.name} is too large! Max 4.5MB.`);
                              continue;
                            }
                            const isImage = file.type.startsWith('image/');
                            if (isImage) {
                              validFiles.push(file);
                            } else {
                              const validTypes = ['application/pdf', 'video/mp4', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
                              if (!validTypes.includes(file.type)) {
                                alert(`Invalid file type for ${file.name}! Please upload an image, PDF, DOC, or video.`);
                                continue;
                              }
                              if (nonImageCount >= 4) {
                                alert(`You can only upload up to 4 non-image files. Skipping ${file.name}.`);
                                continue;
                              }
                              validFiles.push(file);
                              nonImageCount++;
                            }
                          }
                          setProofFiles(validFiles);
                          e.target.value = ''; // Reset input so same file can be selected again if removed
                        }}
                        className="w-full px-3 py-2 border rounded-md focus:ring-purple-500 text-sm"
                      />
                      {proofFiles.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                          <p className="font-medium mb-1">Selected Files:</p>
                          <ul className="space-y-1">
                            {proofFiles.map((f, i) => (
                              <li key={i} className="flex justify-between items-center bg-gray-100 p-1.5 rounded">
                                <span className="truncate max-w-[200px]">{f.name}</span>
                                <button type="button" onClick={() => setProofFiles(proofFiles.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-500 my-2">- OR -</div>
                      <input 
                        type="url" 
                        value={formData.proofUrl} 
                        onChange={e => setFormData({...formData, proofUrl: e.target.value})} 
                        className="w-full px-3 py-2 border rounded-md focus:ring-purple-500" 
                        placeholder="https://... (External Link)"
                        disabled={proofFiles.length > 0}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Upload a file or provide an external link to your work.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blockers or Issues Encountered (Optional)</label>
                  <textarea 
                    value={formData.blockers} 
                    onChange={e => setFormData({...formData, blockers: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-md h-20 focus:ring-purple-500"
                  />
                </div>
              </form>
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-gray-50">
              <button type="button" onClick={() => setShowSubmitModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" form="submit-form" disabled={uploading} className="px-4 py-2 bg-[var(--color-brand-black)] text-white rounded-md hover:bg-[var(--color-brand-matte)] shadow-sm font-medium flex items-center gap-2 disabled:opacity-50">
                <Check size={18} /> {uploading ? 'Uploading...' : 'Submit Work'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Edit Task</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <form id="edit-form" onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input required type="text" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea required value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} className="w-full px-3 py-2 border rounded-md h-24" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                    <select value={editData.assignedToId} onChange={e => setEditData({...editData, assignedToId: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                      <option value="">Unassigned</option>
                      {employees.filter(emp => emp.departmentId === editData.departmentId && emp.isActive).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                    <input required type="date" value={editData.deadline} onChange={e => setEditData({...editData, deadline: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select value={editData.priority} onChange={e => setEditData({...editData, priority: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-gray-50">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" form="edit-form" className="btn-primary py-2 px-4">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

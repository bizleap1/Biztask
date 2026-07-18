import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';
import TaskProgressionWidget from '../components/TaskProgressionWidget';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';

const DEV_CATEGORIES = [
  'Website Development', 'Frontend Change', 'Backend API', 'Bug Fix',
  'UI/UX Update', 'Deployment', 'Database Work', 'Client Website Update',
  'Performance Optimization', 'Technical SEO Fix', 'GitHub/Code Review', 'Other'
];

const MEDIA_CATEGORIES = [
  'Instagram Post', 'Instagram Reel', 'LinkedIn Post', 'Video Editing',
  'Content Calendar', 'Caption Writing', 'SEO On-page', 'SEO Off-page',
  'Keyword Research', 'Meta Ads Campaign', 'Campaign Report', 'Creative Design',
  'Client Social Media Report', 'Other'
];

export default function AssignTask() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isParsingTask, setIsParsingTask] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    departmentId: '',
    category: '',
    assignedToId: '',
    priority: 'Medium',
    deadline: '',
    proofRequired: true,
    proofType: '',
    clientName: '',
    clientDetails: '',
    driveLink: '',
    socialMediaPlatform: '',
    postType: '',
    githubRepo: '',
    environment: ''
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await userService.getUsers();
        setEmployees(data);
      } catch (err) {
        console.error('Failed to fetch employees', err);
      }
    };
    fetchEmployees();
  }, []);

  const handleMicClick = async () => {
    if (isRecording) {
      if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      }
    } else {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            sampleRate: 48000,
            channelCount: 1,
            autoGainControl: true
          } 
        });
        const recorder = new MediaRecorder(stream);
        const audioChunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          setIsParsingTask(true);
          try {
            const parsedData = await aiService.parseTaskFromAudio(audioBlob);
            setFormData(prev => {
              let deptId = prev.departmentId;
              if (parsedData.category) {
                if (DEV_CATEGORIES.includes(parsedData.category)) deptId = '2';
                else if (MEDIA_CATEGORIES.includes(parsedData.category)) deptId = '3';
              }
              return {
                ...prev,
                ...parsedData,
                departmentId: deptId || prev.departmentId,
              };
            });
          } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to parse task from voice.');
          } finally {
            setIsParsingTask(false);
          }
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
      } catch (err) {
        console.error('Error accessing microphone', err);
        setError('Could not access microphone. Please allow microphone permissions.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await taskService.createTask(formData);
      setSuccess(true);
      setFormData({
        title: '', description: '', departmentId: '', category: '',
        assignedToId: '', priority: 'Medium', deadline: '', proofRequired: true, proofType: '',
        clientName: '', clientDetails: '', driveLink: '', socialMediaPlatform: '', postType: '', githubRepo: '', environment: ''
      });
      // Optionally navigate to my-tasks after a short delay
      setTimeout(() => navigate('/my-tasks'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create task. Please ensure all fields are correct.');
    } finally {
      setLoading(false);
    }
  };

  const availableCategories = formData.departmentId === '2' ? DEV_CATEGORIES : formData.departmentId === '3' ? MEDIA_CATEGORIES : [];
  const availableEmployees = employees.filter(emp => emp.departmentId === Number(formData.departmentId) && emp.isActive);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign a Task</h1>
          <p className="text-gray-500 text-sm mt-1">Create and assign a new task to a team member.</p>
        </div>
        <button
          onClick={handleMicClick}
          disabled={isParsingTask}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all shadow-sm ${isRecording ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
        >
          {isParsingTask ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Parsing...</>
          ) : isRecording ? (
            <><MicOff className="w-5 h-5" /> Stop Recording</>
          ) : (
            <><Mic className="w-5 h-5" /> Speak Task</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg border border-green-100">
            Task assigned successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input required type="text" placeholder="E.g., Update homepage banner" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea required placeholder="Detailed description of the task..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all min-h-[120px] resize-y" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                <select required value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value, category: '', assignedToId: ''})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all bg-white">
                  <option value="">Select Department...</option>
                  <option value="2">Development</option>
                  <option value="3">Media</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select required disabled={!formData.departmentId} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Select Category...</option>
                  {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Dynamic Fields Based on Department */}
            {formData.departmentId && (
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">
                  {formData.departmentId === '2' ? 'Development Details' : formData.departmentId === '3' ? 'Media Details' : 'Project Details'}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client/Project Name</label>
                    <input type="text" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all" placeholder="e.g. Acme Corp" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Drive Link (Assets)</label>
                    <input type="url" value={formData.driveLink} onChange={e => setFormData({...formData, driveLink: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all" placeholder="https://drive.google.com/..." />
                  </div>
                </div>

                {/* Media Specific */}
                {formData.departmentId === '3' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Social Media Platform</label>
                      <select value={formData.socialMediaPlatform} onChange={e => setFormData({...formData, socialMediaPlatform: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all bg-white">
                        <option value="">Select Platform...</option>
                        <option value="Instagram">Instagram</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Twitter">Twitter</option>
                        <option value="TikTok">TikTok</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Post Type</label>
                      <input type="text" value={formData.postType} onChange={e => setFormData({...formData, postType: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all" placeholder="e.g. Reel, Carousel, Story" />
                    </div>
                  </div>
                )}

                {/* Dev Specific */}
                {formData.departmentId === '2' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Repository</label>
                      <input type="text" value={formData.githubRepo} onChange={e => setFormData({...formData, githubRepo: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all" placeholder="e.g. bizleap1/Biztask" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                      <select value={formData.environment} onChange={e => setFormData({...formData, environment: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all bg-white">
                        <option value="">Select Environment...</option>
                        <option value="Local">Local</option>
                        <option value="Development">Development</option>
                        <option value="Staging">Staging</option>
                        <option value="Production">Production</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
                <select required disabled={!formData.departmentId} value={formData.assignedToId} onChange={e => setFormData({...formData, assignedToId: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Select Team Member...</option>
                  {availableEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                <input required type="date" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all bg-white">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proof Type (Optional)</label>
                <select value={formData.proofType} onChange={e => setFormData({...formData, proofType: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-brand-black)] focus:border-transparent outline-none transition-all bg-white">
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

            <div className="pt-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                <input type="checkbox" checked={formData.proofRequired} onChange={e => setFormData({...formData, proofRequired: e.target.checked})} className="w-5 h-5 rounded text-[var(--color-brand-black)] focus:ring-[var(--color-brand-black)]" />
                <span className="text-sm font-medium text-gray-700">Require proof submission for completion</span>
              </label>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <button type="submit" disabled={loading} className="w-full sm:w-auto px-8 py-3 bg-[var(--color-brand-black)] hover:bg-[var(--color-brand-matte)] text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? 'Assigning Task...' : 'Assign Task'}
            </button>
          </div>
        </form>
        </div>
        </div>
        <div className="lg:col-span-1 h-full">
          <TaskProgressionWidget />
        </div>
      </div>
    </div>
  );
}

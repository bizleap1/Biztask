import { useState, useEffect } from 'react';
import { taskService } from '../services/taskService';
import { CheckCircle, Clock, FileText, AlertTriangle, Activity } from 'lucide-react';

export default function TaskProgressionWidget() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const fetchAssignedTasks = async () => {
    try {
      const allTasks = await taskService.getTasks();
      const assignedByMe = allTasks.filter((t: any) => t.assignedById === user.id);
      setTasks(assignedByMe);
    } catch (err) {
      console.error('Error fetching tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedTasks();
    const interval = setInterval(fetchAssignedTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Activity size={20} className="text-[var(--color-brand-gray-dark)]"/> Assigned Progress
      </h2>
      <div className="text-gray-500 text-sm animate-pulse">Loading progression...</div>
    </div>
  );

  if (tasks.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Activity size={20} className="text-[var(--color-brand-gray-dark)]"/> Assigned Progress
      </h2>
      <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px] pr-1">
        {tasks.map(task => {
          let progress = 0;
          let colorClass = 'bg-gray-200';
          let Icon = Clock;
          
          if (task.status === 'Pending') { progress = 25; colorClass = 'bg-yellow-400'; }
          else if (task.status === 'In Progress') { progress = 50; colorClass = 'bg-blue-500'; }
          else if (task.status === 'Submitted') { progress = 75; colorClass = 'bg-indigo-500'; Icon = FileText; }
          else if (task.status === 'Approved' || task.status === 'Completed') { progress = 100; colorClass = 'bg-green-500'; Icon = CheckCircle; }
          else if (task.status === 'Rejected') { progress = 25; colorClass = 'bg-red-500'; Icon = AlertTriangle; }

          return (
            <div key={task.id} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm text-gray-900 truncate">{task.title}</h3>
                  <p className="text-xs text-gray-500 truncate">To: {task.assignedTo?.name || 'Unassigned'}</p>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 whitespace-nowrap ${task.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  <Icon size={10} /> {task.status}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

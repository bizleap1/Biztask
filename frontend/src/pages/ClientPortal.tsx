import { useEffect, useState } from 'react';
import { portalService } from '../services/portalService';

export default function ClientPortal() {
  const [overview, setOverview] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([portalService.getOverview(), portalService.getTasks()])
      .then(([overviewData, taskData]) => {
        setOverview(overviewData);
        setTasks(taskData);
      })
      .catch(() => setError('This account has no active client workspace membership.'));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Client Portal</h1>
        <p className="text-gray-500">Shared progress and approved work for your account.</p>
      </div>
      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        {overview?.clients?.map((client: any) => (
          <div key={client.id} className="bg-white border rounded-xl p-5">
            <h2 className="font-bold">{client.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{client.projects?.length || 0} active projects</p>
            <p className="text-sm text-gray-500">{client.tasks?.length || 0} shared tasks</p>
            <p className="text-sm text-gray-500">{client.meetings?.length || 0} upcoming meetings</p>
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-bold mb-4">Shared Tasks</h2>
        {tasks.map(task => (
          <div key={task.id} className="py-3 border-t flex justify-between">
            <div><p className="font-medium">{task.title}</p><p className="text-xs text-gray-500">{task.project?.name || 'General project'}</p></div>
            <span className="text-sm">{task.status}</span>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-gray-500">No shared tasks.</p>}
      </div>
    </div>
  );
}

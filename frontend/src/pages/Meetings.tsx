import { useEffect, useState, type FormEvent } from 'react';
import { meetingService } from '../services/meetingService';
import { userService } from '../services/userService';
import { Calendar, Clock, MapPin, Plus, X } from 'lucide-react';

export default function Meetings() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const canManage = ['SuperAdmin', 'Manager', 'TeamLead'].includes(user.role);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [view, setView] = useState<'all' | 'today' | 'next7'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');
  const [form, setForm] = useState({ title: '', description: '', agenda: '', startAt: '', durationMinutes: 30, locationLink: '', repeatWeekly: false, attendeeIds: [] as number[] });

  const load = async () => {
    const data = await meetingService.getMeetings(view === 'all' ? undefined : view);
    setMeetings(data);
  };

  useEffect(() => { load(); }, [view]);
  useEffect(() => { userService.getUsers().then(setUsers).catch(console.error); }, []);

  const createMeeting = async (event: FormEvent) => {
    event.preventDefault();
    await meetingService.createMeeting(form);
    setShowCreate(false);
    setForm({ title: '', description: '', agenda: '', startAt: '', durationMinutes: 30, locationLink: '', repeatWeekly: false, attendeeIds: [] });
    await load();
  };

  const openMeeting = async (meeting: any) => {
    setSelected(await meetingService.getMeeting(meeting.id));
  };

  const saveMinutes = async () => {
    if (!selected || !minutes.trim()) return;
    await meetingService.saveMinutes(selected.id, minutes);
    setMinutes('');
    setSelected(await meetingService.getMeeting(selected.id));
  };

  const addAction = async () => {
    if (!selected || !actionTitle.trim()) return;
    await meetingService.addActionItem(selected.id, {
      title: actionTitle,
      assigneeId: actionAssignee ? Number(actionAssignee) : null
    });
    setActionTitle('');
    setActionAssignee('');
    setSelected(await meetingService.getMeeting(selected.id));
  };

  const convertAction = async (itemId: number) => {
    if (!selected) return;
    await meetingService.convertActionItem(selected.id, itemId);
    setSelected(await meetingService.getMeeting(selected.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div><h1 className="text-2xl font-bold">Meetings</h1><p className="text-gray-500">Schedule and track meeting outcomes.</p></div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg"><Plus size={16}/>New Meeting</button>
        )}
      </div>
      <div className="flex gap-2">
        {(['all', 'today', 'next7'] as const).map(item => (
          <button key={item} onClick={() => setView(item)} className={`px-3 py-2 rounded-lg text-sm ${view === item ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
            {item === 'all' ? 'All' : item === 'today' ? 'Today' : 'Next 7 Days'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {meetings.map(meeting => (
          <button key={meeting.id} onClick={() => openMeeting(meeting)} className="text-left bg-white p-5 rounded-xl border hover:shadow-md">
            <h2 className="font-bold">{meeting.title}</h2>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Calendar size={15}/>{new Date(meeting.startAt).toLocaleString()}</p>
              <p className="flex items-center gap-2"><Clock size={15}/>{meeting.durationMinutes} minutes</p>
              {meeting.locationLink && <p className="flex items-center gap-2"><MapPin size={15}/>{meeting.locationLink}</p>}
            </div>
          </button>
        ))}
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={createMeeting} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3">
            <div className="flex justify-between"><h2 className="text-lg font-bold">New Meeting</h2><button type="button" onClick={() => setShowCreate(false)}><X/></button></div>
            <input required placeholder="Title" className="w-full border p-2 rounded" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/>
            <textarea placeholder="Description" className="w-full border p-2 rounded" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/>
            <textarea placeholder="Agenda" className="w-full border p-2 rounded" value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })}/>
            <input required type="datetime-local" className="w-full border p-2 rounded" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })}/>
            <input type="number" min="5" className="w-full border p-2 rounded" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })}/>
            <input placeholder="Meeting link or location" className="w-full border p-2 rounded" value={form.locationLink} onChange={e => setForm({ ...form, locationLink: e.target.value })}/>
            <select multiple className="w-full border p-2 rounded min-h-24" value={form.attendeeIds.map(String)} onChange={e => setForm({ ...form, attendeeIds: Array.from(e.target.selectedOptions).map(option => Number(option.value)) })}>
              {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <label className="flex gap-2"><input type="checkbox" checked={form.repeatWeekly} onChange={e => setForm({ ...form, repeatWeekly: e.target.checked })}/>Weekly repeat</label>
            <button className="w-full bg-indigo-600 text-white p-2 rounded">Create</button>
          </form>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-40 bg-black/40 flex justify-end">
          <div className="w-full max-w-xl bg-white p-6 overflow-y-auto">
            <div className="flex justify-between"><h2 className="text-xl font-bold">{selected.title}</h2><button onClick={() => setSelected(null)}><X/></button></div>
            {selected.agenda && <p className="mt-4 text-gray-600"><strong>Agenda:</strong> {selected.agenda}</p>}
            <div className="mt-6 space-y-3">
              <h3 className="font-bold">Minutes</h3>
              <textarea className="w-full border p-2 rounded" placeholder="Record meeting minutes" value={minutes} onChange={e => setMinutes(e.target.value)} />
              <button onClick={saveMinutes} className="px-3 py-2 bg-black text-white rounded">Save Minutes</button>
              {selected.minutes?.map((minute: any) => <p key={minute.id} className="p-3 bg-gray-50 rounded">{minute.content}</p>)}
            </div>
            <div className="mt-6 space-y-3">
              <h3 className="font-bold">Action Items</h3>
              <div className="flex gap-2">
                <input className="border p-2 rounded flex-1" placeholder="Action item" value={actionTitle} onChange={e => setActionTitle(e.target.value)} />
                <select className="border p-2 rounded" value={actionAssignee} onChange={e => setActionAssignee(e.target.value)}>
                  <option value="">Assignee</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
                <button onClick={addAction} className="px-3 bg-indigo-600 text-white rounded">Add</button>
              </div>
              {selected.actionItems?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-3 border rounded">
                  <div><p className="font-medium">{item.title}</p>{item.task && <p className="text-xs text-green-600">Task #{item.task.id}: {item.task.status}</p>}</div>
                  {!item.task && <button onClick={() => convertAction(item.id)} className="text-sm text-indigo-600">Convert to task</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

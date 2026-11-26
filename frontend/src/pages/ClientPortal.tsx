import { useEffect, useState } from 'react';
import { portalService } from '../services/portalService';

export default function ClientPortal() {
  const [overview, setOverview] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestForm, setRequestForm] = useState({ clientId: '', title: '', description: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      portalService.getOverview(),
      portalService.getTasks(),
      portalService.getInvoices(),
      portalService.getReports(),
      portalService.getRequests()
    ])
      .then(([overviewData, taskData, invoiceData, reportData, requestData]) => {
        setOverview(overviewData);
        setTasks(taskData);
        setInvoices(invoiceData);
        setReports(reportData);
        setRequests(requestData);
      })
      .catch(() => setError('This account has no active client workspace membership.'));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Client Portal</h1>
        <p className="text-gray-500">Shared progress and approved work for your account.</p>
      </div>
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-bold mb-3">Published Reports</h2>
        {reports.map(report => <div key={report.id} className="py-2 border-t">{report.title} — {report.reportingMonth}/{report.reportingYear}</div>)}
        {reports.length === 0 && <p className="text-sm text-gray-500">No published reports.</p>}
      </div>
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-bold mb-3">Invoices</h2>
        {invoices.map(invoice => (
          <div key={invoice.id} className="py-2 border-t flex justify-between">
            <span>{invoice.invoiceNumber}</span>
            <span>₹{Number(invoice.totalAmount).toLocaleString('en-IN')} · {invoice.status}</span>
          </div>
        ))}
        {invoices.length === 0 && <p className="text-sm text-gray-500">No published invoices.</p>}
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
            <div className="text-right">
              <span className="text-sm block">{task.status}</span>
              {task.clientApprovalStatus !== 'Approved' && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={async () => { await portalService.approveTask(task.id, 'Approved'); setTasks(await portalService.getTasks()); }}
                    className="text-xs text-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => { await portalService.approveTask(task.id, 'Rejected'); setTasks(await portalService.getTasks()); }}
                    className="text-xs text-red-600"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-gray-500">No shared tasks.</p>}
      </div>
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-bold">Client Requests</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <select className="border p-2 rounded" value={requestForm.clientId} onChange={e => setRequestForm({ ...requestForm, clientId: e.target.value })}>
            <option value="">Select account</option>
            {overview?.clients?.map((client: any) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <input className="border p-2 rounded" placeholder="Request title" value={requestForm.title} onChange={e => setRequestForm({ ...requestForm, title: e.target.value })} />
          <button
            onClick={async () => {
              if (!requestForm.clientId || !requestForm.title) return;
              await portalService.createRequest({ clientId: Number(requestForm.clientId), title: requestForm.title, description: requestForm.description || requestForm.title });
              setRequestForm({ clientId: '', title: '', description: '' });
              setRequests(await portalService.getRequests());
            }}
            className="bg-indigo-600 text-white rounded px-3 py-2"
          >
            Submit Request
          </button>
        </div>
        {requests.map(request => <div key={request.id} className="border-t py-2 text-sm">{request.title} — {request.status}</div>)}
        {requests.length === 0 && <p className="text-sm text-gray-500">No requests.</p>}
      </div>
    </div>
  );
}

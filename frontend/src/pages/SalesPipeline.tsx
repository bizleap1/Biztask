import { useEffect, useState, type FormEvent } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { crmService } from '../services/crmService';

const stages = ['New', 'Contacted', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export default function SalesPipeline() {
  const [leads, setLeads] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', companyName: '', email: '', phone: '', source: '', stage: 'New', dealValue: 0, expectedRevenue: 0 });

  const load = async () => setLeads(await crmService.getLeads(true));
  useEffect(() => { void load(); }, []);

  const createLead = async (event: FormEvent) => {
    event.preventDefault();
    await crmService.createLead(form);
    setShowCreate(false);
    setForm({ name: '', companyName: '', email: '', phone: '', source: '', stage: 'New', dealValue: 0, expectedRevenue: 0 });
    await load();
  };

  const moveLead = async (lead: any, stage: string) => {
    await crmService.updateLead(lead.id, { stage });
    await load();
  };

  const convertLead = async (lead: any) => {
    if (!window.confirm(`Convert ${lead.name} to a client?`)) return;
    await crmService.convertLead(lead.id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold">Sales Pipeline</h1><p className="text-gray-500">Track leads, follow-ups and won deals.</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg"><Plus size={16}/>New Lead</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto">
        {stages.map(stage => (
          <section key={stage} className="min-w-52 bg-gray-50 rounded-xl p-3">
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><TrendingUp size={15}/>{stage}</h2>
            <div className="space-y-2">
              {leads.filter(lead => lead.stage === stage).map(lead => (
                <article key={lead.id} className="bg-white border rounded-lg p-3 shadow-sm">
                  <p className="font-bold text-sm">{lead.name}</p>
                  {lead.companyName && <p className="text-xs text-gray-500">{lead.companyName}</p>}
                  <p className="mt-2 text-sm">₹{Number(lead.dealValue).toLocaleString('en-IN')}</p>
                  {lead.nextFollowUpAt && <p className="text-xs text-orange-600 mt-1">Follow-up {new Date(lead.nextFollowUpAt).toLocaleDateString()}</p>}
                  <select className="mt-3 w-full border rounded p-1 text-xs" value={lead.stage} onChange={e => moveLead(lead, e.target.value)}>
                    {stages.map(item => <option key={item}>{item}</option>)}
                  </select>
                  {lead.stage === 'Won' && <button onClick={() => convertLead(lead)} className="mt-2 text-xs text-indigo-600 font-bold">Convert to client</button>}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={createLead} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3">
            <h2 className="text-lg font-bold">New Lead</h2>
            <input required placeholder="Contact name" className="w-full border p-2 rounded" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
            <input placeholder="Company" className="w-full border p-2 rounded" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })}/>
            <input placeholder="Email" type="email" className="w-full border p-2 rounded" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/>
            <input placeholder="Phone" className="w-full border p-2 rounded" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/>
            <input placeholder="Source" className="w-full border p-2 rounded" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}/>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="0" placeholder="Deal value" className="border p-2 rounded" value={form.dealValue} onChange={e => setForm({ ...form, dealValue: Number(e.target.value) })}/>
              <input type="number" min="0" placeholder="Revenue" className="border p-2 rounded" value={form.expectedRevenue} onChange={e => setForm({ ...form, expectedRevenue: Number(e.target.value) })}/>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border p-2 rounded">Cancel</button>
              <button className="flex-1 bg-indigo-600 text-white p-2 rounded">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

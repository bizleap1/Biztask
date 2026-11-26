import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Edit, Trash2, UserPlus, FolderPlus, ChevronDown, ChevronUp, Mail, Phone } from 'lucide-react';
import api from '../services/api';

interface ClientContact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
}

interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  departmentId?: number | null;
  department?: { id: number; name: string } | null;
}

interface Client {
  id: number;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  industry?: string;
  status: 'Active' | 'At-Risk' | 'Paused' | 'Churned';
  accountManagerId?: number | null;
  accountManager?: { id: number; name: string; email: string } | null;
  contacts: ClientContact[];
  projects: Project[];
  _count?: { projects: number; tasks: number };
}

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  'At-Risk': 'bg-red-100 text-red-700',
  Paused: 'bg-yellow-100 text-yellow-800',
  Churned: 'bg-gray-200 text-gray-700',
};

export default function Clients() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAdminOrManager = user.role === 'SuperAdmin' || user.role === 'Manager';

  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null);

  // Client Modal
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    industry: '',
    status: 'Active',
    accountManagerId: '',
  });
  const [clientError, setClientError] = useState('');

  // Contact Modal
  const [contactClientId, setContactClientId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', designation: '', isPrimary: false });

  // Project Modal
  const [projectClientId, setProjectClientId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', departmentId: '', status: 'Active' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, usersRes, deptsRes] = await Promise.all([
        api.get('/clients'),
        api.get('/users'),
        api.get('/users/departments'),
      ]);
      setClients(clientsRes.data);
      setManagers(usersRes.data.filter((u: any) => u.isActive));
      setDepartments(deptsRes.data);
    } catch (err) {
      console.error('Failed to load clients', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateClient = () => {
    setEditingClient(null);
    setClientForm({ name: '', companyName: '', email: '', phone: '', industry: '', status: 'Active', accountManagerId: '' });
    setClientError('');
    setShowClientModal(true);
  };

  const openEditClient = (c: Client) => {
    setEditingClient(c);
    setClientForm({
      name: c.name,
      companyName: c.companyName || '',
      email: c.email || '',
      phone: c.phone || '',
      industry: c.industry || '',
      status: c.status,
      accountManagerId: c.accountManagerId ? String(c.accountManagerId) : '',
    });
    setClientError('');
    setShowClientModal(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError('');
    try {
      const payload = {
        ...clientForm,
        accountManagerId: clientForm.accountManagerId ? Number(clientForm.accountManagerId) : null,
      };
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, payload);
      } else {
        await api.post('/clients', payload);
      }
      setShowClientModal(false);
      fetchData();
    } catch (err: any) {
      setClientError(err.response?.data?.message || 'Failed to save client');
    }
  };

  const handleArchiveClient = async (c: Client) => {
    if (!window.confirm(`Archive client "${c.name}"?`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to archive client');
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactClientId) return;
    try {
      await api.post(`/clients/${contactClientId}/contacts`, contactForm);
      setContactClientId(null);
      setContactForm({ name: '', email: '', phone: '', designation: '', isPrimary: false });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add contact');
    }
  };

  const handleDeleteContact = async (clientId: number, contactId: number) => {
    if (!window.confirm('Remove this contact?')) return;
    try {
      await api.delete(`/clients/${clientId}/contacts/${contactId}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove contact');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectClientId) return;
    try {
      await api.post('/projects', {
        name: projectForm.name,
        description: projectForm.description,
        clientId: projectClientId,
        departmentId: projectForm.departmentId ? Number(projectForm.departmentId) : null,
        status: projectForm.status,
      });
      setProjectClientId(null);
      setProjectForm({ name: '', description: '', departmentId: '', status: 'Active' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create project');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-main)]">Clients & Projects</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage client accounts, points of contact, and active projects</p>
        </div>
        {isAdminOrManager && (
          <button onClick={openCreateClient} className="btn-primary flex items-center gap-2 py-2 px-4">
            <Plus size={16} /> Add Client
          </button>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="card py-16 flex flex-col items-center text-center">
          <Briefcase size={40} className="text-gray-300 mb-4" />
          <p className="text-[var(--color-text-muted)] font-medium">No clients yet</p>
          {isAdminOrManager && <p className="text-sm text-gray-400 mt-1">Click "Add Client" to create your first client account.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(client => (
            <div key={client.id} className="card overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedClientId(expandedClientId === client.id ? null : client.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Briefcase size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--color-text-main)]">{client.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[client.status] || 'bg-gray-100 text-gray-700'}`}>
                        {client.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {client.companyName || client.industry || 'General'} · {client.projects.length} project(s) · {client.contacts.length} contact(s)
                      {client.accountManager ? ` · AM: ${client.accountManager.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdminOrManager && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setContactClientId(client.id); }}
                        className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50"
                        title="Add Contact"
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setProjectClientId(client.id); }}
                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                        title="Add Project"
                      >
                        <FolderPlus size={16} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openEditClient(client); }}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                        title="Edit Client"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleArchiveClient(client); }}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                        title="Archive Client"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                  {expandedClientId === client.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {expandedClientId === client.id && (
                <div className="border-t border-gray-100 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/40">
                  {/* Contacts */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Contacts</h3>
                    {client.contacts.length === 0 ? (
                      <p className="text-sm text-gray-400">No contacts added.</p>
                    ) : (
                      <div className="space-y-2">
                        {client.contacts.map(ct => (
                          <div key={ct.id} className="bg-white p-3 rounded-lg border border-gray-100 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {ct.name} {ct.isPrimary && <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Primary</span>}
                              </p>
                              <p className="text-xs text-gray-500">{ct.designation || 'Contact'}</p>
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                {ct.email && <span className="flex items-center gap-1"><Mail size={12} /> {ct.email}</span>}
                                {ct.phone && <span className="flex items-center gap-1"><Phone size={12} /> {ct.phone}</span>}
                              </div>
                            </div>
                            {isAdminOrManager && (
                              <button onClick={() => handleDeleteContact(client.id, ct.id)} className="text-red-400 hover:text-red-600 p-1">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Projects */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Projects</h3>
                    {client.projects.length === 0 ? (
                      <p className="text-sm text-gray-400">No projects yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {client.projects.map(p => (
                          <div key={p.id} className="bg-white p-3 rounded-lg border border-gray-100 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{p.name}</p>
                              {p.description && <p className="text-xs text-gray-500 line-clamp-1">{p.description}</p>}
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">{p.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button onClick={() => setShowClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{editingClient ? 'Edit Client' : 'Add Client'}</h2>
            {clientError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{clientError}</div>}
            <form onSubmit={handleSaveClient} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                <input required type="text" value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" value={clientForm.companyName} onChange={e => setClientForm({ ...clientForm, companyName: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={clientForm.email} onChange={e => setClientForm({ ...clientForm, email: e.target.value })} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={clientForm.phone} onChange={e => setClientForm({ ...clientForm, phone: e.target.value })} className="w-full p-2 border rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                  <input type="text" value={clientForm.industry} onChange={e => setClientForm({ ...clientForm, industry: e.target.value })} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={clientForm.status} onChange={e => setClientForm({ ...clientForm, status: e.target.value })} className="w-full p-2 border rounded-lg">
                    <option value="Active">Active</option>
                    <option value="At-Risk">At-Risk</option>
                    <option value="Paused">Paused</option>
                    <option value="Churned">Churned</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Manager</label>
                <select value={clientForm.accountManagerId} onChange={e => setClientForm({ ...clientForm, accountManagerId: e.target.value })} className="w-full p-2 border rounded-lg">
                  <option value="">— Unassigned —</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg mt-2">
                {editingClient ? 'Save Changes' : 'Create Client'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {contactClientId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button onClick={() => setContactClientId(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Client Contact</h2>
            <form onSubmit={handleAddContact} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input required type="text" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input type="text" value={contactForm.designation} onChange={e => setContactForm({ ...contactForm, designation: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm({ ...contactForm, isPrimary: e.target.checked })} />
                Primary Point of Contact
              </label>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">Add Contact</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {projectClientId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button onClick={() => setProjectClientId(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input required type="text" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} className="w-full p-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={projectForm.departmentId} onChange={e => setProjectForm({ ...projectForm, departmentId: e.target.value })} className="w-full p-2 border rounded-lg">
                    <option value="">— Any —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={projectForm.status} onChange={e => setProjectForm({ ...projectForm, status: e.target.value })} className="w-full p-2 border rounded-lg">
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg">Create Project</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

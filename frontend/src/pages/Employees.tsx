import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Eye, UserX, UserCheck, Shield, Trash2 } from 'lucide-react';
import { userService } from '../services/userService';
import api from '../services/api';

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  
  // Add/Edit Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    departmentId: '',
    designation: '',
    isActive: true
  });
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState<{email: string, pass: string} | null>(null);
  const [resetCodeInfo, setResetCodeInfo] = useState<{name: string, code: string, expiresAt: string} | null>(null);

  const loggedInUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isSuperAdmin = loggedInUser.role === 'SuperAdmin';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empData, deptData] = await Promise.all([
        userService.getUsers(),
        userService.getDepartments()
      ]);
      setEmployees(empData);
      setDepartments(deptData);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password: pass });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await userService.createUser(formData);
      setSuccessMsg({ email: formData.email, pass: formData.password });
      setShowAddModal(false);
      fetchData();
      // Reset form
      setFormData({ name: '', email: '', password: '', role: '', departmentId: '', designation: '', isActive: true });
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await userService.updateUser(selectedEmp.id, formData);
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to update user');
    }
  };

  const toggleStatus = async (emp: any) => {
    try {
      if (emp.isActive) {
        await userService.deactivateUser(emp.id);
      } else {
        await userService.activateUser(emp.id);
      }
      fetchData();
    } catch (error) {
      console.error('Failed to change status', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this employee? This will also delete any tasks assigned by them.')) return;
    try {
      await userService.deleteUser(id);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const openEdit = (emp: any) => {
    setSelectedEmp(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      password: '', // Do not allow edit here
      role: emp.role,
      departmentId: emp.departmentId || '',
      designation: emp.designation || '',
      isActive: emp.isActive
    });
    setShowEditModal(true);
  };

  const grantReset = async (emp: any) => {
    if (window.confirm(`Are you sure you want to approve password reset for ${emp.name}?`)) {
      try {
        const { data } = await api.patch(`/users/${emp.id}/grant-reset`);
        setResetCodeInfo({
          name: emp.name,
          code: data.resetCode,
          expiresAt: data.expiresAt,
        });
        fetchData();
      } catch (error: any) {
        console.error(error);
        alert(error.response?.data?.message || 'Action failed');
      }
    }
  };

  const openView = (emp: any) => {
    setSelectedEmp(emp);
    setShowViewModal(true);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || 
                          emp.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter ? emp.role === roleFilter : true;
    const matchesStatus = statusFilter === 'Active' ? emp.isActive === true : 
                          statusFilter === 'Inactive' ? emp.isActive === false : true;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage team members, roles, and access.</p>
        </div>
        <button 
          onClick={() => { setFormError(''); setSuccessMsg(null); setShowAddModal(true); }}
          className="bg-[var(--color-brand-black)] hover:bg-[var(--color-brand-matte)] text-white font-medium py-2 px-5 rounded-full flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
        >
          Add Employee <Plus size={20} />
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md shadow-sm">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Employee Created Successfully</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Email: <span className="font-mono font-semibold">{successMsg.email}</span></p>
                <p>Temporary Password: <span className="font-mono font-semibold">{successMsg.pass}</span></p>
                <p className="mt-2 font-semibold text-red-600">Ask the employee to change their password after first login.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetCodeInfo && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm flex items-start justify-between">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">Password Reset Approved for {resetCodeInfo.name}</h3>
            <div className="mt-2 text-sm text-amber-700">
              <p>One-time Reset Code: <span className="font-mono font-bold text-base tracking-wider bg-white px-2 py-0.5 rounded border border-amber-200">{resetCodeInfo.code}</span></p>
              <p className="mt-1 text-xs">Share this code securely with the employee. Expires at {new Date(resetCodeInfo.expiresAt).toLocaleString()}.</p>
            </div>
          </div>
          <button onClick={() => setResetCodeInfo(null)} className="text-amber-600 hover:text-amber-800 font-bold text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
        <select 
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">All Roles</option>
          {isSuperAdmin && <option value="SuperAdmin">SuperAdmin</option>}
          <option value="Manager">Manager</option>
          <option value="DevEmployee">DevEmployee</option>
          <option value="MediaEmployee">MediaEmployee</option>
          <option value="Viewer">Viewer</option>
        </select>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Role</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Designation</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading employees...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No employees found.</td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[var(--color-brand-black)] font-bold">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{emp.name}</p>
                          <p className="text-sm text-gray-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {emp.role === 'SuperAdmin' && <Shield size={12} />}
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {emp.designation || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${emp.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {emp.resetPasswordRequested && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Reset Requested
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openView(emp)} className="text-gray-400 hover:text-[var(--color-brand-black)] transition-colors" title="View">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => openEdit(emp)} className="text-gray-400 hover:text-orange-600 transition-colors" title="Edit">
                        <Edit size={18} />
                      </button>
                      {isSuperAdmin && emp.id !== loggedInUser.id && (
                        <>
                          <button 
                            onClick={() => toggleStatus(emp)} 
                            className={`text-gray-400 transition-colors p-1 ${emp.isActive ? 'hover:text-red-600' : 'hover:text-green-600'}`}
                            title={emp.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {emp.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                          </button>
                          {emp.resetPasswordRequested && (
                            <button 
                              onClick={() => grantReset(emp)}
                              className="text-yellow-600 hover:text-yellow-800 transition-colors p-1"
                              title="Approve Password Reset"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                            </button>
                          )}

                          <button 
                            onClick={() => handleDelete(emp.id)} 
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Delete Permanently"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add New Employee</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {formError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                  <option value="">Select Role...</option>
                  <option value="Manager">Manager</option>
                  <option value="TeamLead">Team Lead</option>
                  <option value="Employee">Employee</option>
                  <option value="DevEmployee">Development Employee (Legacy)</option>
                  <option value="MediaEmployee">Media Employee (Legacy)</option>
                  <option value="ClientUser">Client User</option>
                  <option value="Viewer">Viewer (HR/Other)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} className="w-full px-3 py-2 border rounded-md">
                  <option value="">No Department (Auto-assign by role)</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="w-full px-3 py-2 border rounded-md" placeholder="e.g. Frontend Engineer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                <div className="flex gap-2">
                  <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
                  <button type="button" onClick={handleGeneratePassword} className="px-3 py-2 bg-gray-100 text-sm text-gray-700 rounded-md hover:bg-gray-200">Generate</button>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
                <button type="submit" className="btn-primary py-2 px-4">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEmp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Edit Employee</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {formError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border rounded-md" disabled={selectedEmp.id === loggedInUser.id}>
                  {isSuperAdmin && <option value="SuperAdmin">SuperAdmin</option>}
                  <option value="Manager">Manager</option>
                  <option value="TeamLead">Team Lead</option>
                  <option value="Employee">Employee</option>
                  <option value="DevEmployee">Development Employee (Legacy)</option>
                  <option value="MediaEmployee">Media Employee (Legacy)</option>
                  <option value="ClientUser">Client User</option>
                  <option value="Viewer">Viewer (HR/Other)</option>
                </select>
                {selectedEmp.id === loggedInUser.id && <span className="text-xs text-gray-400">You cannot edit your own role</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} className="w-full px-3 py-2 border rounded-md" disabled={selectedEmp.id === loggedInUser.id && !isSuperAdmin}>
                  <option value="">No Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={formData.isActive ? 'true' : 'false'} onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})} className="w-full px-3 py-2 border rounded-md" disabled={selectedEmp.id === loggedInUser.id}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedEmp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Employee Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-[var(--color-brand-black)] font-bold text-2xl">
                  {selectedEmp.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xl font-bold">{selectedEmp.name}</h4>
                  <p className="text-gray-500">{selectedEmp.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Role</p>
                  <p className="font-semibold">{selectedEmp.role}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className={`font-semibold ${selectedEmp.isActive ? 'text-green-600' : 'text-red-600'}`}>{selectedEmp.isActive ? 'Active' : 'Inactive'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Designation</p>
                  <p className="font-semibold">{selectedEmp.designation || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Joined</p>
                  <p className="font-semibold">{new Date(selectedEmp.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {selectedEmp.mustChangePassword && (
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-xs mt-4 border border-yellow-200">
                  ⚠️ This user has not changed their initial temporary password yet.
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-4 py-2 badge-neutral rounded-md hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

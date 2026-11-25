import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

interface TeamMember {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    designation?: string;
  };
}

interface Team {
  id: number;
  name: string;
  departmentId: number | null;
  department?: { id: number; name: string } | null;
  lead?: { id: number; name: string; role: string } | null;
  members: TeamMember[];
}

interface Department {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function Teams() {
  const userStr = sessionStorage.getItem('user');
  const user = JSON.parse(userStr || '{}');
  const isAdminOrManager = user.role === 'SuperAdmin' || user.role === 'Manager';

  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  // Create Team modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDeptId, setNewTeamDeptId] = useState<string>('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Add Member modal
  const [addMemberTeamId, setAddMemberTeamId] = useState<number | null>(null);
  const [addMemberUserId, setAddMemberUserId] = useState<string>('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, deptsRes, usersRes] = await Promise.all([
        api.get('/teams'),
        api.get('/users/departments'),
        api.get('/users'),
      ]);
      setTeams(teamsRes.data);
      setDepartments(deptsRes.data);
      setEmployees(usersRes.data);
    } catch (err) {
      console.error('Failed to load teams data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) { setCreateError('Team name is required.'); return; }
    setCreateLoading(true);
    setCreateError('');
    try {
      await api.post('/teams', {
        name: newTeamName.trim(),
        departmentId: newTeamDeptId ? Number(newTeamDeptId) : null,
      });
      setShowCreateModal(false);
      setNewTeamName('');
      setNewTeamDeptId('');
      await fetchData();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to create team.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberUserId || !addMemberTeamId) { setAddMemberError('Select an employee.'); return; }
    setAddMemberLoading(true);
    setAddMemberError('');
    try {
      await api.post(`/teams/${addMemberTeamId}/members`, {
        userId: Number(addMemberUserId),
        role: 'Member',
      });
      setAddMemberTeamId(null);
      setAddMemberUserId('');
      await fetchData();
    } catch (err: any) {
      setAddMemberError(err.response?.data?.message || 'Failed to add member.');
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveMember = async (teamId: number, userId: number) => {
    if (!confirm('Remove this member from the team?')) return;
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove member.');
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-main)]">Teams</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage team rosters and members</p>
        </div>
        {isAdminOrManager && (
          <button
            onClick={() => { setShowCreateModal(true); setCreateError(''); }}
            className="btn-primary flex items-center gap-2 py-2 px-4"
          >
            <Plus size={16} /> Create Team
          </button>
        )}
      </div>

      {/* Teams List */}
      {teams.length === 0 ? (
        <div className="card py-16 flex flex-col items-center text-center">
          <Users size={40} className="text-gray-300 mb-4" />
          <p className="text-[var(--color-text-muted)] font-medium">No teams yet</p>
          {isAdminOrManager && (
            <p className="text-sm text-gray-400 mt-1">Create the first team using the button above.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.id} className="card overflow-hidden">
              {/* Team Header Row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Users size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-main)]">{team.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {team.department?.name ?? 'No Department'} · {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                      {team.lead ? ` · Lead: ${team.lead.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdminOrManager && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setAddMemberTeamId(team.id);
                        setAddMemberUserId('');
                        setAddMemberError('');
                      }}
                      className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Add Member"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                  {expandedTeam === team.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded Members */}
              {expandedTeam === team.id && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  {team.members.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No members yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {team.members.map(({ user: member }) => (
                        <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-main)]">{member.name}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">{member.role} {member.designation ? `· ${member.designation}` : ''}</p>
                            </div>
                          </div>
                          {isAdminOrManager && (
                            <button
                              onClick={() => handleRemoveMember(team.id, member.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Remove member"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Create New Team</h2>
            <p className="text-sm text-gray-500 mb-5">Set up a new team and assign members later.</p>

            {createError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{createError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Dev Team Alpha"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department (optional)</label>
                <select
                  value={newTeamDeptId}
                  onChange={e => setNewTeamDeptId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">— No Department —</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCreateTeam}
                disabled={createLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {createLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : <Plus size={16} />}
                {createLoading ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberTeamId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setAddMemberTeamId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Add Team Member</h2>
            <p className="text-sm text-gray-500 mb-5">
              Adding to: <strong>{teams.find(t => t.id === addMemberTeamId)?.name}</strong>
            </p>

            {addMemberError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{addMemberError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
                <select
                  value={addMemberUserId}
                  onChange={e => setAddMemberUserId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">— Select employee —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddMember}
                disabled={addMemberLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {addMemberLoading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : <UserPlus size={16} />}
                {addMemberLoading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

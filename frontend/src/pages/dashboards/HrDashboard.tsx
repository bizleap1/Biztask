import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { Users, FileText, CheckCircle, Activity, UserMinus, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function HrDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await dashboardService.getHrDashboard();
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading HR Dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load data.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR & Operations Overview</h1>
          <p className="text-gray-500 mt-1">Read-only view of organization statistics.</p>
        </div>
        <button onClick={fetchData} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Employees</p>
              <p className="text-3xl font-bold mt-1">{data.totalEmployees}</p>
            </div>
            <div className="p-3 bg-gray-50 text-[var(--color-brand-black)] rounded-lg"><Users size={20} /></div>
          </div>
          <div className="text-sm mt-4 flex justify-between">
            <span className="text-green-600 flex items-center gap-1"><UserCheck size={14}/> {data.activeEmployees} Active</span>
            <span className="text-gray-400 flex items-center gap-1"><UserMinus size={14}/> {data.inactiveEmployees} Inactive</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-500 text-sm font-medium">Task Completion</p>
              <p className="text-3xl font-bold mt-1">{data.taskCompletionOverview}%</p>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={20} /></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">Company-wide approved tasks vs total</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-500 text-sm font-medium">Daily Report Compliance</p>
              <p className="text-3xl font-bold mt-1">{data.dailyReportCompliance}%</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={20} /></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">Submission rate for today</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-500 text-sm font-medium">System Health</p>
              <p className="text-3xl font-bold mt-1 text-green-500">Good</p>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-lg"><Activity size={20} /></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">All services operational</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Employees by Department</h2>
          <div className="h-[300px]">
            {data.departmentWiseEmployees?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departmentWiseEmployees} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f9fafb'}} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Employees" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Daily Reports</h2>
          <div className="flex-1 overflow-y-auto">
            {data.recentReports?.length > 0 ? (
              <div className="space-y-3">
                {data.recentReports.map((report: any) => (
                  <div key={report.id} className="p-3 border border-gray-100 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{report.user.name}</p>
                      <p className="text-xs text-gray-500">{report.department.name}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 badge-neutral rounded text-xs font-medium mb-1">
                        {report.status}
                      </span>
                      <p className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No recent reports</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

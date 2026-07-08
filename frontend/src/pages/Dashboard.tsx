import AdminDashboard from './dashboards/AdminDashboard';
import ManagerDashboard from './dashboards/ManagerDashboard';
import EmployeeDashboard from './dashboards/EmployeeDashboard';
import HrDashboard from './dashboards/HrDashboard';

export default function Dashboard() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');

  const renderDashboard = () => {
    switch (user.role) {
      case 'SuperAdmin':
        return <AdminDashboard />;
      case 'Manager':
        return <ManagerDashboard />;
      case 'DevEmployee':
      case 'MediaEmployee':
        return <EmployeeDashboard />;
      case 'Viewer':
        return <HrDashboard />;
      default:
        return <div>Invalid Role</div>;
    }
  };

  return (
    <div className="w-full">
      {renderDashboard()}
    </div>
  );
}

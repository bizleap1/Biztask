import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees.tsx';
import ChangePassword from './pages/ChangePassword';
import Tasks from './pages/Tasks';
import AssignTask from './pages/AssignTask';
import MyTasks from './pages/MyTasks';
import TaskDetails from './pages/TaskDetails';
import ReviewSubmissions from './pages/ReviewSubmissions';
import MyDailyReports from './pages/MyDailyReports';
import DailyReports from './pages/DailyReports';
import Notifications from './pages/Notifications';
import ActivityLogs from './pages/ActivityLogs';
import Teams from './pages/Teams';
import { AuthGuard } from './components/AuthGuard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={
        <AuthGuard>
          <ChangePassword />
        </AuthGuard>
      } />
      <Route path="/" element={
        <AuthGuard>
          <Layout />
        </AuthGuard>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="employees" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager']}>
            <Employees />
          </AuthGuard>
        } />
        <Route path="teams" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager']}>
            <Teams />
          </AuthGuard>
        } />
        <Route path="tasks" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager', 'TeamLead']}>
            <Tasks />
          </AuthGuard>
        } />
        <Route path="assign-task" element={
          <AuthGuard allowedRoles={['Employee', 'DevEmployee', 'MediaEmployee', 'TeamLead']}>
            <AssignTask />
          </AuthGuard>
        } />
        <Route path="my-tasks" element={
          <AuthGuard allowedRoles={['Employee', 'DevEmployee', 'MediaEmployee', 'TeamLead']}>
            <MyTasks />
          </AuthGuard>
        } />
        <Route path="tasks/:id" element={<TaskDetails />} />
        <Route path="review-submissions" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager', 'TeamLead']}>
            <ReviewSubmissions />
          </AuthGuard>
        } />
        <Route path="my-daily-reports" element={
          <AuthGuard allowedRoles={['Employee', 'DevEmployee', 'MediaEmployee', 'TeamLead']}>
            <MyDailyReports />
          </AuthGuard>
        } />
        <Route path="daily-reports" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager', 'TeamLead']}>
            <DailyReports />
          </AuthGuard>
        } />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity-logs" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager', 'Viewer']}>
            <ActivityLogs />
          </AuthGuard>
        } />

        <Route path="settings" element={
          <AuthGuard allowedRoles={['SuperAdmin']}>
            <div className="p-4 bg-white rounded-xl shadow-pepper">Settings Feature Coming Soon</div>
          </AuthGuard>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

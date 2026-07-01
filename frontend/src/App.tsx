import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees.tsx';
import ChangePassword from './pages/ChangePassword';
import Tasks from './pages/Tasks';
import MyTasks from './pages/MyTasks';
import TaskDetails from './pages/TaskDetails';
import ReviewSubmissions from './pages/ReviewSubmissions';
import MyDailyReports from './pages/MyDailyReports';
import DailyReports from './pages/DailyReports';
import Notifications from './pages/Notifications';
import ActivityLogs from './pages/ActivityLogs';
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
        <Route path="tasks" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager']}>
            <Tasks />
          </AuthGuard>
        } />
        <Route path="my-tasks" element={
          <AuthGuard allowedRoles={['DevEmployee', 'MediaEmployee']}>
            <MyTasks />
          </AuthGuard>
        } />
        <Route path="tasks/:id" element={<TaskDetails />} />
        <Route path="review-submissions" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager']}>
            <ReviewSubmissions />
          </AuthGuard>
        } />
        <Route path="my-daily-reports" element={
          <AuthGuard allowedRoles={['DevEmployee', 'MediaEmployee']}>
            <MyDailyReports />
          </AuthGuard>
        } />
        <Route path="daily-reports" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager']}>
            <DailyReports />
          </AuthGuard>
        } />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity-logs" element={
          <AuthGuard allowedRoles={['SuperAdmin', 'Manager', 'Viewer']}>
            <ActivityLogs />
          </AuthGuard>
        } />
        <Route path="reports" element={<div className="p-4 bg-white rounded-xl pepper-shadow">Reports Feature Coming Soon</div>} />
        <Route path="settings" element={<div className="p-4 bg-white rounded-xl pepper-shadow">Settings Feature Coming Soon</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import api from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState<'request'|'reset'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotResetCode, setForgotResetCode] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');

  const handleForgotSubmit = async () => {
    setForgotMsg('');
    setForgotLoading(true);
    try {
      if (forgotMode === 'request') {
        const response = await api.post('/auth/request-reset', { email: forgotEmail });
        if (response.data.alreadyGranted) {
          setForgotMode('reset');
          setForgotMsg('You already have permission. Please set your new password below.');
        } else {
          setForgotMsg('Success! Password reset request sent to admin.');
        }
      } else {
        if (!forgotResetCode.trim() || !forgotNewPassword) {
          setForgotMsg('Please enter both the reset code and a new password.');
          setForgotLoading(false);
          return;
        }
        await api.post('/auth/execute-reset', { email: forgotEmail, resetCode: forgotResetCode.trim(), newPassword: forgotNewPassword });
        setForgotMsg('Success! Password updated. You can now login.');
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotMode('request');
          setForgotEmail('');
          setForgotResetCode('');
          setForgotNewPassword('');
          setForgotMsg('');
        }, 2000);
      }
    } catch (err: any) {
      setForgotMsg(err.response?.data?.message || 'Action failed.');
    } finally {
      setForgotLoading(false);
    }
  };

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        email: loginEmail,
        password: loginPass
      });
      
      sessionStorage.setItem('user', JSON.stringify({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        departmentId: data.departmentId,
        designation: data.designation,
        status: data.status,
        mustChangePassword: data.mustChangePassword,
        token: data.token
      }));
      
      if (data.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login');
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <Logo className="w-16 h-16" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--color-text-main)] tracking-tight">
          BizLeap Operations Portal
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
          Manage teams, tasks, reports, and performance in one place.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="card py-8 px-4 sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-main)] mb-1">
                Email address
              </label>
              <div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-main)] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter your password"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <button type="submit" disabled={loading} className="btn-primary py-2.5 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : null}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
            

            <div className="flex items-center justify-between mt-4">
              <button type="button" onClick={() => setShowForgotModal(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Forgot your password?
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 relative">
            <button onClick={() => { setShowForgotModal(false); setForgotMode('request'); setForgotEmail(''); setForgotResetCode(''); setForgotNewPassword(''); setForgotMsg(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {forgotMode === 'request' ? 'Reset Password' : 'Set New Password'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {forgotMode === 'request' 
                ? 'Enter your email to request password reset permission from your admin.' 
                : 'Enter your email and new password to reset.'}
            </p>

            {forgotMsg && (
              <div className={`p-3 rounded-lg text-sm mb-4 ${
                forgotMsg.toLowerCase().includes('success') || forgotMsg.toLowerCase().includes('already have permission')
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {forgotMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input 
                  type="email" 
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your email"
                />
              </div>

              {forgotMode === 'reset' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Reset Code</label>
                    <input
                      type="text"
                      value={forgotResetCode}
                      onChange={e => setForgotResetCode(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                      placeholder="Enter reset code from your admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input 
                        type={showForgotNewPassword ? 'text' : 'password'} 
                        value={forgotNewPassword}
                        onChange={e => setForgotNewPassword(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter new password"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showForgotNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button 
                onClick={handleForgotSubmit}
                disabled={forgotLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex justify-center items-center"
              >
                {forgotLoading ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : (forgotMode === 'request' ? 'Request Reset' : 'Update Password')}
              </button>
              
              {forgotMode === 'request' && (
                <div className="text-center mt-2">
                  <button onClick={() => setForgotMode('reset')} className="text-xs text-indigo-600 hover:underline">
                    Already got permission? Click here to set new password.
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import './LoginPage.css';

const LoginPage = () => {
  const [loginType, setLoginType] = useState('student'); // 'student', 'teacher', 'admin'
  const [form, setForm] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const result = await login(form);
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      // 立即广播认证状态变化，确保导航栏首次登录即显示
      window.dispatchEvent(new Event('auth-changed'));
      
      // 根据用户角色跳转到不同页面
      if (result.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (result.user.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/problems');
      }
    } catch (error) {
      setError(error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginTypeChange = (type) => {
    setLoginType(type);
    setForm({ username: '', password: '' });
    setError('');
  };

  const getPlaceholder = () => {
    if (loginType === 'student') return '请输入学号';
    if (loginType === 'teacher') return '请输入工号';
    return '请输入工号';
  };

  const getLabel = () => {
    if (loginType === 'student') return '学号';
    if (loginType === 'teacher') return '工号';
    return '工号';
  };

  return (
    <div className="login-container">
      {/* 背景装饰元素 */}
      <div className="bg-decoration">
        <div className="decoration-circle circle-1"></div>
        <div className="decoration-circle circle-2"></div>
        <div className="decoration-circle circle-3"></div>
      </div>
      
      <div className="login-card">
        {/* 顶部装饰 */}
        <div className="login-header">
          <div className="logo-section">
            <div className="logo-icon">🚀</div>
            <h1>OJ在线评测系统</h1>
            <p className="subtitle">Online Judge System</p>
          </div>
        </div>
        
        {/* 登录类型选择 */}
        <div className="login-type-selector">
          <button
            type="button"
            className={`type-btn ${loginType === 'student' ? 'active' : ''}`}
            onClick={() => handleLoginTypeChange('student')}
          >
            <span className="type-icon">🎓</span>
            <span className="type-text">学生登录</span>
          </button>
          <button
            type="button"
            className={`type-btn ${loginType === 'teacher' ? 'active' : ''}`}
            onClick={() => handleLoginTypeChange('teacher')}
          >
            <span className="type-icon">👨‍🏫</span>
            <span className="type-text">教师登录</span>
          </button>
          <button
            type="button"
            className={`type-btn ${loginType === 'admin' ? 'active' : ''}`}
            onClick={() => handleLoginTypeChange('admin')}
          >
            <span className="type-icon">👑</span>
            <span className="type-text">管理员登录</span>
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        {/* 登录表单 */}
        <div className="form-section">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                {getLabel()}
                <span className="input-icon">👤</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({...form, username: e.target.value})}
                  required
                  placeholder={getPlaceholder()}
                  autoComplete="username"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>
                密码
                <span className="input-icon">🔒</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({...form, password: e.target.value})}
                  required
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span className="loading-text">
                  <span className="loading-spinner"></span>
                  登录中...
                </span>
              ) : (
                <span>🚀 立即登录</span>
              )}
            </button>
          </form>
        </div>
        
        {/* 登录信息说明 */}
        <div className="login-info">
          {loginType === 'student' ? (
            <div className="info-box">
              <div className="info-header">
                <span className="info-icon">💡</span>
                <span className="info-title">学生登录说明</span>
              </div>
              <ul>
                <li>使用学号作为登录账号</li>
                <li>密码由任课教师提供</li>
                <li>如有问题请联系任课教师</li>
              </ul>
            </div>
          ) : loginType === 'teacher' ? (
            <div className="info-box">
              <div className="info-header">
                <span className="info-icon">💡</span>
                <span className="info-title">教师登录说明</span>
              </div>
              <ul>
                <li>使用工号作为登录账号</li>
                <li>密码由管理员提供</li>
                <li>如有问题请联系系统管理员</li>
              </ul>
            </div>
          ) : (
            <div className="info-box">
              <div className="info-header">
                <span className="info-icon">💡</span>
                <span className="info-title">管理员登录说明</span>
              </div>
              <ul>
                <li>使用工号作为登录账号</li>
                <li>密码由系统提供</li>
                <li>如有问题请联系系统维护人员</li>
              </ul>
            </div>
          )}
        </div>
        
        {/* 底部链接 */}
        <div className="login-links">
          <a href="/forgot-password">🔑 忘记密码？</a>
          {loginType === 'admin' && <a href="/admin/register">📝 注册管理员</a>}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

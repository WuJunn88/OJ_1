import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import './LoginPage.css';

const ForgotPasswordPage = () => {
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!identifier.trim()) {
      setError('请输入邮箱或手机号');
      return;
    }
    if (!newPassword) {
      setError('请输入新密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ identifier, new_password: newPassword });
      setSuccess('密码已重置，请使用新密码登录');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err?.response?.data?.error || '邮箱或手机填写有误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="bg-decoration">
        <div className="decoration-circle circle-1"></div>
        <div className="decoration-circle circle-2"></div>
        <div className="decoration-circle circle-3"></div>
      </div>
      <div className="login-card">
        <div className="login-header">
          <div className="logo-section">
            <div className="logo-icon">🔑</div>
            <h1>找回密码</h1>
            <p className="subtitle">通过邮箱或手机号重置密码</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="form-section">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                邮箱或手机号
                <span className="input-icon">📮</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="请输入邮箱或手机号"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                新密码
                <span className="input-icon">🔒</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                确认新密码
                <span className="input-icon">✅</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span className="loading-text">
                  <span className="loading-spinner"></span>
                  提交中...
                </span>
              ) : (
                <span>提交重置</span>
              )}
            </button>
          </form>
        </div>

        <div className="login-links">
          <a href="/login">返回登录</a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

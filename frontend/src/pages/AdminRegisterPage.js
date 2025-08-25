import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerAdmin } from '../services/api';
import './AdminRegisterPage.css';

const AdminRegisterPage = () => {
  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
    school_name: '',
    major_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // 验证密码
    if (form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError('密码长度至少6位');
      setLoading(false);
      return;
    }

    try {
      await registerAdmin({
        username: form.username,
        name: form.name,
        password: form.password,
        email: form.email || undefined,
        phone: form.phone || undefined,
        school_name: form.school_name || undefined,
        major_name: form.major_name || undefined
      });

      setSuccess('管理员注册成功！正在跳转到登录页面...');
      
      // 3秒后跳转到登录页面
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (error) {
      setError(error.response?.data?.error || '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-register-container">
      <div className="admin-register-card">
        <h1>👑 管理员注册</h1>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>工号：<span className="required-mark">*</span></label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({...form, username: e.target.value})}
                required
                placeholder="请输入工号"
                autoComplete="username"
              />
            </div>
            
            <div className="form-group">
              <label>姓名：<span className="required-mark">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                required
                placeholder="请输入姓名"
                autoComplete="name"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>密码：<span className="required-mark">*</span></label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                required
                placeholder="请输入密码（至少6位）"
                autoComplete="new-password"
                minLength="6"
              />
            </div>
            
            <div className="form-group">
              <label>确认密码：<span className="required-mark">*</span></label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
                required
                placeholder="请再次输入密码"
                autoComplete="new-password"
                minLength="6"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>邮箱：</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                placeholder="请输入邮箱地址（可选）"
                autoComplete="email"
              />
            </div>
            
            <div className="form-group">
              <label>手机号：</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({...form, phone: e.target.value})}
                placeholder="请输入手机号码（可选）"
                autoComplete="tel"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>学校：</label>
              <input
                type="text"
                value={form.school_name}
                onChange={(e) => setForm({...form, school_name: e.target.value})}
                placeholder="请输入学校名称（可选）"
              />
            </div>
            
            <div className="form-group">
              <label>院部：</label>
              <input
                type="text"
                value={form.major_name}
                onChange={(e) => setForm({...form, major_name: e.target.value})}
                placeholder="请输入院部名称（可选）"
              />
            </div>
          </div>
          
          <div className="form-actions">
            <button type="submit" className="register-btn" disabled={loading}>
              {loading ? '注册中...' : '注册管理员'}
            </button>
            
            <button 
              type="button" 
              className="back-btn"
              onClick={() => navigate('/login')}
            >
              返回登录
            </button>
          </div>
        </form>
        
        <div className="register-info">
          <div className="info-box">
            <p>💡 管理员注册说明：</p>
            <ul>
              <li>工号和姓名为必填项，注册后不可修改</li>
              <li>密码长度至少6位</li>
              <li>邮箱、手机号、学校、院部为可选项</li>
              <li>注册成功后请妥善保管账号信息</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRegisterPage;

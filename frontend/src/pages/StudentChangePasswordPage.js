import React, { useState } from 'react';
import { resetPassword } from '../services/api';

function StudentChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('请填写完整信息');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码长度不能少于6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    try {
      setLoading(true);
      const res = await resetPassword({ old_password: oldPassword, new_password: newPassword });
      setMessage(res.message || '密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || '修改失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <h2>修改密码</h2>
      <form className="change-password-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>旧密码</label>
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        </div>
        <div className="form-group">
          <label>新密码</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="form-group">
          <label>确认新密码</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}
        <button type="submit" disabled={loading} className="primary-btn">
          {loading ? '提交中...' : '保存修改'}
        </button>
      </form>
    </div>
  );
}

export default StudentChangePasswordPage;

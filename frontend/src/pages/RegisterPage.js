import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getSchools, getMajors, getClasses } from '../services/api';
import './RegisterPage.css';

const RegisterPage = () => {
  const [form, setForm] = useState({
    // 学生自助注册已关闭，仅保留教师注册入口说明
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
    phone: '',
    role: 'student',
    school_id: '',
    major_id: '',
    class_id: ''
  });
  
  const [schools, setSchools] = useState([]);
  const [majors, setMajors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const schoolsData = await getSchools();
      setSchools(schoolsData);
    } catch (error) {
      console.error('获取学校列表失败:', error);
    }
  };

  const handleSchoolChange = async (schoolId) => {
    setForm(prev => {
      const newForm = { ...prev, school_id: schoolId, major_id: '', class_id: '' };
      return newForm;
    });
    
    setMajors([]);
    setClasses([]);
    
    if (schoolId) {
      try {
        const majorsData = await getMajors(schoolId);
        setMajors(majorsData);
      } catch (error) {
        console.error('获取专业列表失败:', error);
      }
    }
  };

  const handleMajorChange = async (majorId) => {
    setForm(prev => ({ ...prev, major_id: majorId, class_id: '' }));
    setClasses([]);
    
    if (majorId) {
      try {
        const classesData = await getClasses(majorId);
        setClasses(classesData);
      } catch (error) {
        console.error('获取班级列表失败:', error);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    // 学生自助注册已关闭
    setError('当前已关闭自助注册，请联系任课教师创建账号');
  };

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h1>用户注册</h1>
        
        {error && <div className="error-message">⚠️ {error}</div>}
        {success && <div className="success-message">✅ {success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="info-message" style={{marginBottom: '12px'}}>
            已关闭学生自助注册。请联系任课教师创建学生账号。
          </div>
          {/* 基本信息 */}
          <div className="form-section">
            <h3>基本信息</h3>
            
            <div className="form-group">
              <label>用户名 *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="请输入用户名"
                required
              />
            </div>

            <div className="form-group">
              <label>姓名 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="请输入真实姓名"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>密码 *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="至少6位"
                  required
                />
              </div>

              <div className="form-group">
                <label>确认密码 *</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="再次输入密码"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>邮箱</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="请输入邮箱地址"
                />
              </div>

              <div className="form-group">
                <label>手机号</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="请输入手机号"
                />
              </div>
            </div>

            <div className="form-group">
              <label>用户角色 *</label>
              <select
                value={form.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                required
              >
                <option value="student">学生</option>
                <option value="teacher">教师</option>
              </select>
            </div>
          </div>

          {/* 学校信息（可选） */}
          {form.role === 'student' && (
            <div className="form-section">
              <h3>学校信息（可选）</h3>
              
              <div className="form-group">
                <label>学校</label>
                <select
                  value={form.school_id}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    handleSchoolChange(newValue);
                  }}
                >
                  <option value="">请选择学校</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>专业</label>
                <select
                  value={form.major_id}
                  onChange={(e) => handleMajorChange(e.target.value)}
                  disabled={!form.school_id}
                >
                  <option value="">请选择专业</option>
                  {majors.map(major => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>班级</label>
                <select
                  value={form.class_id}
                  onChange={(e) => handleInputChange('class_id', e.target.value)}
                  disabled={!form.major_id}
                >
                  <option value="">请选择班级</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              disabled={loading || success}
              className="register-btn"
            >
              {loading ? '注册中...' : success ? '注册成功！' : '注册'}
            </button>
          </div>
        </form>

        <div className="login-link">
          已有账户？<Link to="/login">立即登录</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

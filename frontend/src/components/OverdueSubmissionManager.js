import React, { useState, useEffect, useCallback } from 'react';
import './OverdueSubmissionManager.css';
import { api } from '../services/api';
import { getCourseStudents } from '../services/api';

const OverdueSubmissionManager = ({ assignment, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overdueUsers, setOverdueUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [courseStudents, setCourseStudents] = useState([]);
  const [settings, setSettings] = useState({
    allow_overdue_submission: assignment.allow_overdue_submission || false,
    overdue_deadline: assignment.overdue_deadline || '',
    overdue_score_ratio: assignment.overdue_score_ratio || 0.8
  });
  const [message, setMessage] = useState('');

  // 加载逾期用户白名单
  const loadOverdueUsers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/assignments/${assignment.id}/overdue-users`);
      setOverdueUsers(response.data.overdue_users);
    } catch (error) {
      console.error('加载白名单失败:', error);
      setMessage('加载白名单失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 加载课程学生列表
  const loadCourseStudents = useCallback(async () => {
    try {
      // 检查作业是否有课程ID
      if (!assignment.course_id) {
        console.error('作业缺少课程ID，无法获取学生列表');
        setMessage('作业缺少课程信息，无法加载学生列表');
        return;
      }

      // 使用真实API获取课程学生列表
      const studentsData = await getCourseStudents(assignment.course_id);
      if (studentsData && Array.isArray(studentsData)) {
        // 统一处理学生数据字段名
        const normalizedStudents = studentsData.map(student => ({
          id: student.id || student.student_id,
          name: student.name || student.student_name || '未知姓名',
          username: student.username || student.student_no || '未知学号'
        }));
        
        setCourseStudents(normalizedStudents);
        console.log(`成功加载课程 ${assignment.course_id} 的学生列表，共 ${normalizedStudents.length} 人`);
        console.log('学生数据示例:', normalizedStudents[0]);
      } else {
        console.error('获取课程学生数据格式错误:', studentsData);
        setMessage('获取课程学生数据格式错误');
        setCourseStudents([]);
      }
    } catch (error) {
      console.error('加载课程学生失败:', error);
      setMessage('加载课程学生失败: ' + (error.message || '未知错误'));
      setCourseStudents([]);
    }
  }, [assignment.course_id]);

  // 组件挂载时加载数据
  useEffect(() => {
    if (assignment.allow_overdue_submission) {
      loadOverdueUsers();
      loadCourseStudents();
    }
  }, [assignment.id, assignment.course_id, assignment.allow_overdue_submission, loadCourseStudents]);

  // 添加用户到白名单
  const addUserToWhitelist = async () => {
    if (!selectedUser) {
      setMessage('请选择要添加的用户');
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post(`/assignments/${assignment.id}/overdue-users`, {
        user_id: parseInt(selectedUser)
      });
      
      // 直接使用返回的完整用户信息更新状态
      if (response.data && response.data.overdue_users) {
        setOverdueUsers(response.data.overdue_users);
      }
      setSelectedUser('');
      setMessage('用户已添加到白名单');
      
      // 通知父组件更新
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('添加用户失败:', error);
      setMessage(error.response?.data?.error || '添加用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 从白名单移除用户
  const removeUserFromWhitelist = async (userId) => {
    try {
      setIsLoading(true);
      const response = await api.delete(`/assignments/${assignment.id}/overdue-users/${userId}`);
      
      // 直接使用返回的完整用户信息更新状态
      if (response.data && response.data.overdue_users) {
        setOverdueUsers(response.data.overdue_users);
      }
      setMessage('用户已从白名单中移除');
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('移除用户失败:', error);
      setMessage(error.response?.data?.error || '移除用户失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新补交设置
  const updateOverdueSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.put(`/assignments/${assignment.id}/overdue-settings`, settings);
      
      setMessage('补交设置已更新');
      
      // 通知父组件更新
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('更新设置失败:', error);
      setMessage(error.response?.data?.error || '更新设置失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理设置变更
  const handleSettingChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 格式化日期时间
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('zh-CN');
  };

  // 计算剩余时间
  const getRemainingTime = (deadline) => {
    if (!deadline) return '';
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;
    
    if (diff <= 0) return '已过期';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `剩余 ${days} 天 ${hours} 小时`;
    return `剩余 ${hours} 小时`;
  };

  return (
    <div className="overdue-submission-manager">
      <div 
        className="manager-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h4>补交作业管理</h4>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div className="manager-content">
          {/* 补交设置 */}
          <div className="settings-section">
            <h5>补交设置</h5>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.allow_overdue_submission}
                  onChange={(e) => handleSettingChange('allow_overdue_submission', e.target.checked)}
                />
                允许补交作业
              </label>
            </div>

            {settings.allow_overdue_submission && (
              <>
                <div className="setting-item">
                  <label>补交截止时间:</label>
                  <input
                    type="datetime-local"
                    value={settings.overdue_deadline}
                    onChange={(e) => handleSettingChange('overdue_deadline', e.target.value)}
                  />
                  {settings.overdue_deadline && (
                    <span className="remaining-time">
                      {getRemainingTime(settings.overdue_deadline)}
                    </span>
                  )}
                </div>

                <div className="setting-item">
                  <label>逾期得分比例:</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.overdue_score_ratio}
                    onChange={(e) => handleSettingChange('overdue_score_ratio', parseFloat(e.target.value))}
                  />
                  <span className="score-ratio">{Math.round(settings.overdue_score_ratio * 100)}%</span>
                </div>

                <button 
                  className="update-settings-btn"
                  onClick={updateOverdueSettings}
                  disabled={isLoading}
                >
                  {isLoading ? '更新中...' : '更新设置'}
                </button>
              </>
            )}
          </div>

          {/* 白名单管理 */}
          {settings.allow_overdue_submission && (
            <div className="whitelist-section">
              <h5>补交白名单</h5>
              
              <div className="add-user-form">
                <div className="student-selector-info">
                  <small>课程学生总数: {courseStudents.length} | 已在白名单: {overdueUsers.length}</small>
                </div>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="">选择学生...</option>
                  {courseStudents
                    .filter(student => !overdueUsers.some(u => u.id === student.id))
                    .map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.username})
                      </option>
                    ))}
                </select>
                <button
                  onClick={addUserToWhitelist}
                  disabled={!selectedUser || isLoading}
                >
                  {isLoading ? '添加中...' : '添加到白名单'}
                </button>
              </div>
              {courseStudents.length === 0 && (
                <div className="no-students-warning">
                  <small>⚠️ 未找到课程学生，请检查作业是否关联了正确的课程</small>
                </div>
              )}

              <div className="whitelist-users">
                <h6>当前白名单 ({overdueUsers.length}人)</h6>
                {isLoading ? (
                  <div className="loading">加载中...</div>
                ) : overdueUsers.length > 0 ? (
                  <div className="user-list">
                    {overdueUsers.map(user => (
                      <div key={user.id} className="user-item">
                        <span className="user-name">{user.name}</span>
                        <span className="user-username">({user.username})</span>
                        <button
                          className="remove-user-btn"
                          onClick={() => removeUserFromWhitelist(user.id)}
                          disabled={isLoading}
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-whitelist">暂无白名单用户</div>
                )}
              </div>
            </div>
          )}

          {/* 消息提示 */}
          {message && (
            <div className={`message ${message.includes('失败') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          {/* 当前状态显示 */}
          <div className="status-section">
            <h5>当前状态</h5>
            <div className="status-info">
              <div className="status-item">
                <span className="label">补交状态:</span>
                <span className={`value ${assignment.can_overdue ? 'enabled' : 'disabled'}`}>
                  {assignment.can_overdue ? '允许补交' : '不允许补交'}
                </span>
              </div>
              {assignment.overdue_deadline && (
                <div className="status-item">
                  <span className="label">补交截止:</span>
                  <span className="value">
                    {formatDateTime(assignment.overdue_deadline)}
                  </span>
                </div>
              )}
              <div className="status-item">
                <span className="label">得分比例:</span>
                <span className="value">
                  {Math.round((assignment.overdue_score_ratio || 0.8) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverdueSubmissionManager;

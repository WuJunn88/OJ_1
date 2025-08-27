import React, { useState, useEffect, useCallback } from 'react';
import './AssignmentWhitelistManager.css';
import { 
  getAssignmentOverdueUsers, 
  addUserToOverdueWhitelist, 
  removeUserFromOverdueWhitelist 
} from '../services/api';

const AssignmentWhitelistManager = ({ assignment, onUpdate }) => {
  const [overdueUsers, setOverdueUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [message, setMessage] = useState('');
  const [courseStudents, setCourseStudents] = useState([]);

  // 加载逾期用户白名单
  const loadOverdueUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getAssignmentOverdueUsers(assignment.id);
      setOverdueUsers(response.overdue_users || []);
    } catch (error) {
      console.error('加载白名单失败:', error);
      setMessage('加载白名单失败');
    } finally {
      setIsLoading(false);
    }
  }, [assignment.id]);

  // 加载课程学生列表
  const loadCourseStudents = useCallback(async () => {
    try {
      // 这里应该调用获取课程学生的API
      // 暂时使用模拟数据
      const mockStudents = [
        { id: 1, name: '张三', username: 'zhangsan001' },
        { id: 2, name: '李四', username: 'lisi002' },
        { id: 3, name: '王五', username: 'wangwu003' }
      ];
      setCourseStudents(mockStudents);
    } catch (error) {
      console.error('加载课程学生失败:', error);
    }
  }, []);

  // 添加用户到白名单
  const addUserToWhitelist = async () => {
    if (!selectedUser) {
      setMessage('请选择要添加的学生');
      return;
    }

    try {
      setIsLoading(true);
      const response = await addUserToOverdueWhitelist(assignment.id, parseInt(selectedUser));
      
      setOverdueUsers(response.overdue_users || []);
      setSelectedUser('');
      setMessage('学生已添加到白名单');
      
      // 通知父组件更新
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('添加学生失败:', error);
      setMessage(error.message || '添加学生失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 从白名单移除用户
  const removeUserFromWhitelist = async (userId) => {
    try {
      setIsLoading(true);
      const response = await removeUserFromOverdueWhitelist(assignment.id, userId);
      
      setOverdueUsers(response.overdue_users || []);
      setMessage('学生已从白名单中移除');
      
      // 通知父组件更新
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('移除学生失败:', error);
      setMessage(error.message || '移除学生失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    if (assignment.allow_overdue_submission) {
      loadOverdueUsers();
      loadCourseStudents();
    }
  }, [assignment.id, assignment.allow_overdue_submission, loadOverdueUsers, loadCourseStudents]);

  // 如果作业不允许补交，不显示组件
  if (!assignment.allow_overdue_submission) {
    return null;
  }

  return (
    <div className="assignment-whitelist-manager">
      <div className="whitelist-header">
        <h5>👥 补交白名单管理</h5>
        <span className="whitelist-count">({overdueUsers.length}人)</span>
      </div>

      <div className="whitelist-content">
        {/* 添加学生到白名单 */}
        <div className="add-student-section">
          <div className="add-student-form">
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
              className="add-student-btn"
            >
              {isLoading ? '添加中...' : '添加到白名单'}
            </button>
          </div>
        </div>

        {/* 白名单学生列表 */}
        <div className="whitelist-students">
          {isLoading ? (
            <div className="loading">加载中...</div>
          ) : overdueUsers.length > 0 ? (
            <div className="student-list">
              {overdueUsers.map(user => (
                <div key={user.id} className="student-item">
                  <div className="student-info">
                    <span className="student-name">{user.name}</span>
                    <span className="student-username">({user.username})</span>
                  </div>
                  <button
                    className="remove-student-btn"
                    onClick={() => removeUserFromWhitelist(user.id)}
                    disabled={isLoading}
                    title="从白名单中移除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-whitelist">
              <p>暂无白名单学生</p>
              <small>添加学生到白名单后，他们就可以在截止时间后补交作业</small>
            </div>
          )}
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`message ${message.includes('失败') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {/* 白名单说明 */}
        <div className="whitelist-info">
          <h6>💡 白名单说明</h6>
          <ul>
            <li>只有白名单中的学生可以在截止时间后补交作业</li>
            <li>补交截止时间后，系统将拒绝所有补交请求</li>
            <li>可以随时添加或移除白名单学生</li>
            <li>建议只将确实需要补交的学生添加到白名单</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AssignmentWhitelistManager;

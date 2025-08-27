import React, { useState, useEffect } from 'react';
import './OverdueSubmissionStatus.css';
import { api } from '../services/api';

const OverdueSubmissionStatus = ({ assignment, onStatusChange }) => {
  const [overdueStatus, setOverdueStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 检查补交权限
  const checkOverduePermission = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await api.get(`/assignments/${assignment.id}/can-overdue-submit`);
      setOverdueStatus(response.data);
      
      // 通知父组件状态变化
      if (onStatusChange) {
        onStatusChange(response.data);
      }
    } catch (error) {
      console.error('检查补交权限失败:', error);
      setError(error.response?.data?.error || '检查补交权限失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时检查权限
  useEffect(() => {
    if (assignment.allow_overdue_submission) {
      checkOverduePermission();
    }
  }, [assignment.id, assignment.allow_overdue_submission]);

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
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `剩余 ${days} 天 ${hours} 小时`;
    if (hours > 0) return `剩余 ${hours} 小时 ${minutes} 分钟`;
    return `剩余 ${minutes} 分钟`;
  };

  // 如果作业不允许补交，不显示组件
  if (!assignment.allow_overdue_submission) {
    return null;
  }

  return (
    <div className="overdue-submission-status">
      <div className="status-header">
        <h5>补交作业状态</h5>
        <button 
          className="refresh-btn"
          onClick={checkOverduePermission}
          disabled={isLoading}
          title="刷新状态"
        >
          {isLoading ? '🔄' : '🔄'}
        </button>
      </div>

      {isLoading ? (
        <div className="loading-status">检查中...</div>
      ) : error ? (
        <div className="error-status">
          <span className="error-icon">⚠️</span>
          {error}
          <button 
            className="retry-btn"
            onClick={checkOverduePermission}
          >
            重试
          </button>
        </div>
      ) : overdueStatus ? (
        <div className={`status-content ${overdueStatus.can_overdue ? 'can-overdue' : 'cannot-overdue'}`}>
          {overdueStatus.can_overdue ? (
            <>
              <div className="status-icon">✅</div>
              <div className="status-info">
                <div className="status-title">可以补交作业</div>
                <div className="status-details">
                  {overdueStatus.overdue_deadline && (
                    <div className="deadline-info">
                      <span className="label">补交截止:</span>
                      <span className="value">
                        {formatDateTime(overdueStatus.overdue_deadline)}
                      </span>
                      <span className="remaining">
                        {getRemainingTime(overdueStatus.overdue_deadline)}
                      </span>
                    </div>
                  )}
                  <div className="score-info">
                    <span className="label">逾期得分比例:</span>
                    <span className="value">
                      {Math.round(overdueStatus.score_ratio * 100)}%
                    </span>
                  </div>
                </div>
                <div className="status-note">
                  注意：逾期提交的作业将按比例得分，请尽快完成
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="status-icon">❌</div>
              <div className="status-info">
                <div className="status-title">无法补交作业</div>
                <div className="status-reason">{overdueStatus.reason}</div>
                {overdueStatus.reason === '补交截止时间已过' && (
                  <div className="deadline-info">
                    <span className="label">原截止时间:</span>
                    <span className="value">
                      {formatDateTime(assignment.due_date)}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="no-status">未获取到补交状态</div>
      )}

      {/* 补交说明 */}
      <div className="overdue-explanation">
        <h6>补交说明</h6>
        <ul>
          <li>补交作业需要教师特别授权</li>
          <li>逾期提交的作业将按比例得分</li>
          <li>补交截止时间由教师设定</li>
          <li>只有白名单中的学生可以补交</li>
        </ul>
      </div>
    </div>
  );
};

export default OverdueSubmissionStatus;

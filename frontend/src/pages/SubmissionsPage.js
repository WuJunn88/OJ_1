import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubmissions } from '../services/api';
import './SubmissionsPage.css';

const SubmissionsPage = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterProblemTitle, setFilterProblemTitle] = useState('');  // 改为题目名称筛选
  const [appliedFilter, setAppliedFilter] = useState('');  // 新增：已应用的筛选条件
  
  const navigate = useNavigate();

  // 新增：应用筛选函数
  const handleApplyFilter = () => {
    console.log('应用筛选，筛选条件:', filterProblemTitle);  // 调试信息
    setAppliedFilter(filterProblemTitle);
    // 不在这里设置currentPage，让useEffect处理
  };

  // 新增：清除筛选函数
  const handleClearFilter = () => {
    console.log('清除筛选');  // 调试信息
    setFilterProblemTitle('');
    setAppliedFilter('');
    setCurrentPage(1);  // 重置到第一页
  };

  // 新增：useEffect来处理筛选条件变化
  useEffect(() => {
    if (appliedFilter !== '') {
      setCurrentPage(1);  // 当筛选条件变化时，重置到第一页
    }
  }, [appliedFilter]);

  // 主要的useEffect，处理API调用
  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, appliedFilter]);  // 改为appliedFilter

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      console.log('调用API，参数:', { currentPage, appliedFilter });  // 调试信息
      
      // 调用API时正确传递参数
      const response = await getSubmissions(currentPage, 20, null, appliedFilter);
      
      console.log('API响应:', response);  // 调试信息
      setSubmissions(response.submissions);
      setTotalPages(response.pages);
      setTotal(response.total);
      setError(null);
    } catch (err) {
      setError('获取提交记录失败');
      console.error('获取提交记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProblemClick = (problemId) => {
    navigate(`/problem/${problemId}`);
  };

  const handleSubmissionClick = (submissionId) => {
    navigate(`/result/${submissionId}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return 'status-accepted';
      case 'wrong_answer':
        return 'status-wrong';
      case 'error':
        return 'status-error';
      case 'time_limit_exceeded':
        return 'status-timeout';
      case 'memory_limit_exceeded':
        return 'status-memory';
      case 'judging':
        return 'status-judging';
      case 'pending':
        return 'status-pending';
      default:
        return 'status-default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'accepted':
        return '通过';
      case 'wrong_answer':
        return '答案错误';
      case 'error':
        return '运行错误';
      case 'time_limit_exceeded':
        return '时间超限';
      case 'memory_limit_exceeded':
        return '内存超限';
      case 'judging':
        return '判题中';
      case 'pending':
        return '等待中';
      default:
        return status;
    }
  };

  const getProblemTypeText = (type) => {
    switch (type) {
      case 'programming':
        return '编程题';
      case 'choice':
        return '选择题';
      case 'judge':
        return '判断题';
      case 'short_answer':
        return '简答题';
      default:
        return type || '未知';
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '-';
    return `${(seconds * 1000).toFixed(0)}ms`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  if (loading && submissions.length === 0) {
    return (
      <div className="submissions-page">
        <div className="submissions-header">
          <h1>提交记录</h1>
        </div>
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="submissions-page">
      <div className="submissions-header">
        <h1>提交记录</h1>
        <div className="submissions-stats">
          共 {total} 条记录
        </div>
      </div>

      <div className="submissions-filters">
        <div className="filter-group">
          <label htmlFor="problemFilter">题目名称:</label>
          <input
            id="problemFilter"
            type="text"
            value={filterProblemTitle}
            onChange={(e) => setFilterProblemTitle(e.target.value)}
            placeholder="输入题目名称筛选"
          />
          <button 
            onClick={handleApplyFilter}
            className="apply-filter-btn"
          >
            应用筛选
          </button>
          <button 
            onClick={handleClearFilter}
            className="clear-filter-btn"
          >
            清除筛选
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="submissions-table-container">
        <table className="submissions-table">
          <thead>
            <tr>
              <th>提交ID</th>
              <th>题目</th>
              <th>题目类型</th>
              <th>语言</th>
              <th>状态</th>
              <th>执行时间</th>
              <th>提交时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr key={submission.id}>
                <td>{submission.id}</td>
                <td>
                  <button
                    className="problem-link"
                    onClick={() => handleProblemClick(submission.problem_id)}
                  >
                    {submission.problem_title || `题目${submission.problem_id}`}
                  </button>
                </td>
                <td>{getProblemTypeText(submission.problem_type)}</td>
                <td>{submission.language}</td>
                <td>
                  <span className={`status-badge ${getStatusColor(submission.status)}`}>
                    {getStatusText(submission.status)}
                  </span>
                </td>
                <td>{formatTime(submission.execution_time)}</td>
                <td>{formatDate(submission.created_at)}</td>
                <td>
                  <button
                    className="view-result-btn"
                    onClick={() => handleSubmissionClick(submission.id)}
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {submissions.length === 0 && !loading && (
        <div className="no-submissions">
          {appliedFilter ? '没有找到符合条件的提交记录' : '暂无提交记录'}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="page-btn"
          >
            上一页
          </button>
          <span className="page-info">
            第 {currentPage} 页，共 {totalPages} 页
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="page-btn"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

export default SubmissionsPage;

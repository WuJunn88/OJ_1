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
  const [filterProblemId, setFilterProblemId] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filterProblemId]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        per_page: 20
      };
      
      if (filterProblemId) {
        params.problem_id = parseInt(filterProblemId);
      }
      
      const response = await getSubmissions(params);
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
          <label htmlFor="problemFilter">题目ID:</label>
          <input
            id="problemFilter"
            type="number"
            value={filterProblemId}
            onChange={(e) => setFilterProblemId(e.target.value)}
            placeholder="输入题目ID筛选"
            min="1"
          />
          <button 
            onClick={() => setFilterProblemId('')}
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
                    题目{submission.problem_id}
                  </button>
                </td>
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
          {filterProblemId ? '没有找到符合条件的提交记录' : '暂无提交记录'}
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

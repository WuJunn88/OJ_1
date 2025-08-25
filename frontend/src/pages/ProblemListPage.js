import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProblems } from '../services/api';
import './ProblemListPage.css';

const ProblemListPage = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [difficulty, setDifficulty] = useState('');

  useEffect(() => {
    fetchProblems();
  }, [currentPage, difficulty]);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const result = await getProblems(currentPage, 10, difficulty);
      setProblems(result.problems);
      setTotalPages(result.pages);
    } catch (error) {
      setError('获取题目列表失败');
      console.error('Error fetching problems:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDifficultyChange = (newDifficulty) => {
    setDifficulty(newDifficulty);
    setCurrentPage(1);
  };

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'easy': return '#52c41a';
      case 'medium': return '#faad14';
      case 'hard': return '#f5222d';
      default: return '#666';
    }
  };

  const getDifficultyText = (diff) => {
    switch (diff) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      default: return '未知';
    }
  };

  if (loading && problems.length === 0) {
    return (
      <div className="problem-list-container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="problem-list-container">
      <div className="problem-list-header">
        <h1>题目列表</h1>
        <div className="filters">
          <select 
            value={difficulty} 
            onChange={(e) => handleDifficultyChange(e.target.value)}
            className="difficulty-filter"
          >
            <option value="">全部难度</option>
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="problem-grid">
        {problems.map(problem => (
          <div key={problem.id} className="problem-card">
            <div className="problem-header">
              <h3 className="problem-title">
                <Link to={`/problem/${problem.id}`}>
                  {problem.id}. {problem.title}
                </Link>
              </h3>
              <span 
                className="difficulty-badge"
                style={{ backgroundColor: getDifficultyColor(problem.difficulty) }}
              >
                {getDifficultyText(problem.difficulty)}
              </span>
            </div>
            
            <div className="problem-info">
              <div className="problem-meta">
                <span>时间限制: {problem.time_limit}ms</span>
                <span>内存限制: {problem.memory_limit}MB</span>
              </div>
            </div>
            
            <div className="problem-actions">
              <Link 
                to={`/problem/${problem.id}`} 
                className="view-btn"
              >
                查看详情
              </Link>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="page-btn"
          >
            上一页
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`page-btn ${currentPage === page ? 'active' : ''}`}
            >
              {page}
            </button>
          ))}
          
          <button 
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
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

export default ProblemListPage;

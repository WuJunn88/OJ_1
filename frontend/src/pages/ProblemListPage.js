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
      const result = await getProblems(currentPage, 9, difficulty);
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
        <>
          <div className="pagination-info">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className="pagination">
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="page-btn"
            >
              上一页
            </button>
            
            {/* 智能显示页码，避免过多页码按钮 */}
            {(() => {
              const pages = [];
              const maxVisible = 7; // 最多显示7个页码按钮
              
              if (totalPages <= maxVisible) {
                // 如果总页数不多，显示所有页码
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(i);
                }
              } else {
                // 如果总页数很多，智能显示
                if (currentPage <= 4) {
                  // 当前页在前几页
                  for (let i = 1; i <= 5; i++) {
                    pages.push(i);
                  }
                  pages.push('...');
                  pages.push(totalPages);
                } else if (currentPage >= totalPages - 3) {
                  // 当前页在后几页
                  pages.push(1);
                  pages.push('...');
                  for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  // 当前页在中间
                  pages.push(1);
                  pages.push('...');
                  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                  }
                  pages.push('...');
                  pages.push(totalPages);
                }
              }
              
              return pages.map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="page-ellipsis">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`page-btn ${currentPage === page ? 'active' : ''}`}
                  >
                    {page}
                  </button>
                )
              ));
            })()}
            
            <button 
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="page-btn"
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ProblemListPage;

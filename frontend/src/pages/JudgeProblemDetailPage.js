import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProblem, submitCode } from '../services/api';
import './ProblemDetailPage.css';

const JudgeProblemDetailPage = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  
  // 判断题的选项状态
  const [selectedAnswer, setSelectedAnswer] = useState('');

  useEffect(() => {
    fetchProblem();
  }, [problemId]);

  const fetchProblem = async () => {
    try {
      setLoading(true);
      const result = await getProblem(problemId);
      setProblem(result);
    } catch (error) {
      setError('获取题目信息失败');
      console.error('Error fetching problem:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (answer) => {
    setSelectedAnswer(answer);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAnswer) {
      setError('请选择答案');
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      const result = await submitCode({
        problem_id: parseInt(problemId),
        code: selectedAnswer,
        language: 'judge'
      });
      
      setSubmission(result);
      // 跳转到结果页面
      navigate(`/result/${result.submission_id}`);
    } catch (error) {
      setError(error.response?.data?.error || '提交失败');
    } finally {
      setSubmitting(false);
    }
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

  if (loading) {
    return (
      <div className="problem-detail-container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="problem-detail-container">
        <div className="error-message">{error || '题目不存在'}</div>
      </div>
    );
  }

  return (
    <div className="problem-detail-container">
      <div className="problem-header">
        <div className="problem-title-section">
          <h1>{problem.id}. {problem.title}</h1>
          <div className="problem-badges">
            <span 
              className="difficulty-badge"
              style={{ backgroundColor: getDifficultyColor(problem.difficulty) }}
            >
              {getDifficultyText(problem.difficulty)}
            </span>
            <span className="type-badge">
              判断题
            </span>
          </div>
        </div>
      </div>

      <div className="problem-content">
        <div className="problem-description">
          <h2>题目描述</h2>
          <div className="description-text">
            {problem.description.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>

        <div className="problem-options">
          <h2>请判断以下说法是否正确</h2>
          <div className="judge-options">
            <label className="judge-option">
              <input
                type="radio"
                name="judge"
                value="正确"
                checked={selectedAnswer === '正确'}
                onChange={() => handleAnswerChange('正确')}
                className="judge-input"
              />
              <span className="judge-label">
                <span className="judge-text">正确</span>
              </span>
            </label>
            
            <label className="judge-option">
              <input
                type="radio"
                name="judge"
                value="错误"
                checked={selectedAnswer === '错误'}
                onChange={() => handleAnswerChange('错误')}
                className="judge-input"
              />
              <span className="judge-label">
                <span className="judge-text">错误</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="judge-submission">
        <h2>提交答案</h2>
        <form onSubmit={handleSubmit}>
          <div className="selected-answer">
            <p>已选择的答案: {selectedAnswer || '无'}</p>
          </div>
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={submitting || !selectedAnswer}
            >
              {submitting ? '提交中...' : '提交答案'}
            </button>
          </div>
        </form>
      </div>

      {submission && (
        <div className="submission-result">
          <h3>提交结果</h3>
          <p>提交ID: {submission.submission_id}</p>
          <p>状态: {submission.status}</p>
          <p>消息: {submission.message}</p>
        </div>
      )}
    </div>
  );
};

export default JudgeProblemDetailPage;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProblem, submitCode } from '../services/api';
import './ProblemDetailPage.css';

const ChoiceProblemDetailPage = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  
  // 选择题的选项状态
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    fetchProblem();
  }, [problemId]);

  const fetchProblem = async () => {
    try {
      setLoading(true);
      const result = await getProblem(problemId);
      setProblem(result);
      
      // 解析选项，假设选项存储在test_cases字段中，格式为JSON字符串
      if (result.test_cases) {
        try {
          const parsedOptions = JSON.parse(result.test_cases);
          setOptions(parsedOptions);
        } catch (e) {
          // 如果不是JSON格式，尝试解析为普通文本
          const lines = result.test_cases.split('\n').filter(line => line.trim());
          const parsedOptions = lines.map((line, index) => ({
            id: String.fromCharCode(65 + index), // A, B, C, D...
            text: line.trim(),
            value: line.trim()
          }));
          setOptions(parsedOptions);
        }
      }
    } catch (error) {
      setError('获取题目信息失败');
      console.error('Error fetching problem:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (optionId) => {
    if (problem.type === 'choice_single') {
      // 单选题：只能选择一个选项
      setSelectedOptions([optionId]);
    } else if (problem.type === 'choice_multiple') {
      // 多选题：可以选择多个选项
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          return prev.filter(id => id !== optionId);
        } else {
          return [...prev, optionId];
        }
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedOptions.length === 0) {
      setError('请选择答案');
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      // 对于选择题，我们将选择的选项作为"代码"提交
      const selectedText = selectedOptions.map(id => {
        const option = options.find(opt => opt.id === id);
        return option ? option.text : id;
      }).join(', ');
      
      const result = await submitCode({
        problem_id: parseInt(problemId),
        code: selectedText,
        language: 'choice'
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

  const getProblemTypeText = (type) => {
    switch (type) {
      case 'choice_single': return '单选题';
      case 'choice_multiple': return '多选题';
      default: return '选择题';
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
              {getProblemTypeText(problem.type)}
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
          <h2>选项</h2>
          <div className="options-list">
            {options.map((option) => (
              <label key={option.id} className="option-item">
                <input
                  type={problem.type === 'choice_single' ? 'radio' : 'checkbox'}
                  name="choice"
                  value={option.id}
                  checked={selectedOptions.includes(option.id)}
                  onChange={() => handleOptionChange(option.id)}
                  className="option-input"
                />
                <span className="option-label">
                  <span className="option-id">{option.id}.</span>
                  <span className="option-text">{option.text}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="choice-submission">
        <h2>提交答案</h2>
        <form onSubmit={handleSubmit}>
          <div className="selected-options">
            <p>已选择的选项: {selectedOptions.length > 0 ? selectedOptions.join(', ') : '无'}</p>
          </div>
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={submitting || selectedOptions.length === 0}
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

export default ChoiceProblemDetailPage;

//代码提交页面组件：
//提供表单输入题目 ID、选择语言（Python/C++）、输入代码。
//提交表单时调用 API 发送代码，展示提交 ID 和结果查询链接。
//处理加载状态（提交中禁用按钮）。

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { submitCode } from '../services/api';
import './SubmitPage.css';

const SubmitPage = () => {
  const { problemId } = useParams();
  const [form, setForm] = useState({
    problem_id: '',
    code: '',
    language: 'python'
  });
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (problemId) {
      setForm(prev => ({ ...prev, problem_id: Number(problemId) }));
    }
  }, [problemId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const payload = { ...form, problem_id: Number(form.problem_id) };
      const result = await submitCode(payload);
      setSubmission(result);
      console.log('提交成功:', result);
    } catch (error) {
      console.error('提交失败:', error);
      setError(error.response?.data?.error || '提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="submit-container">
      <h1>提交代码</h1>
      
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
      
      {submission ? (
        <div className="submission-success">
          <h2>✅ 提交成功！</h2>
          <div className="submission-info">
            <p><strong>提交ID:</strong> {submission.submission_id}</p>
            <p><strong>状态:</strong> <span className="status-pending">{submission.status}</span></p>
            <p><strong>消息:</strong> {submission.message}</p>
          </div>
          <div className="submission-actions">
            <a href={`/result/${submission.submission_id}`} className="view-result-btn">
              查看判题结果
            </a>
            <button 
              onClick={() => {
                setSubmission(null);
                setForm({ problem_id: problemId ? Number(problemId) : '', code: '', language: 'python' });
                setError('');
              }}
              className="submit-again-btn"
            >
              再次提交
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="submit-form">
          {problemId ? (
            <div className="form-group readonly-field">
              <label>题目ID:</label>
              <div className="readonly-value">{form.problem_id}</div>
            </div>
          ) : (
            <div className="form-group">
              <label>题目ID:</label>
              <input 
                type="number" 
                value={form.problem_id}
                onChange={(e) => setForm({...form, problem_id: e.target.value})}
                placeholder="请输入题目ID"
                required
                min="1"
              />
            </div>
          )}
          
          <div className="form-group">
            <label>编程语言:</label>
            <select
              value={form.language}
              onChange={(e) => setForm({...form, language: e.target.value})}
              className="language-select"
            >
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>代码:</label>
            <textarea
              rows={15}
              value={form.code}
              onChange={(e) => setForm({...form, code: e.target.value})}
              placeholder="请在此输入您的代码..."
              required
              className="code-textarea"
            />
          </div>
          
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? '提交中...' : '提交代码'}
          </button>
        </form>
      )}
    </div>
  );
};

export default SubmitPage;
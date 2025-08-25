import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getProblem, submitCode } from '../services/api';
import './ProblemDetailPage.css';

const ProblemDetailPage = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [isTestMode, setIsTestMode] = useState(false);
  
  // 选择题相关状态
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [options, setOptions] = useState([]);
  
  // 判断题相关状态
  const [judgeAnswer, setJudgeAnswer] = useState('');
  
  // 简答题相关状态
  const [shortAnswer, setShortAnswer] = useState('');
  
  // 编程题相关状态
  const [form, setForm] = useState({
    code: '',
    language: 'python'
  });

  useEffect(() => {
    // 检查是否是从测试页面来的
    if (location.state && location.state.problem) {
      setProblem(location.state.problem);
      setIsTestMode(true);
      setLoading(false);
      
      // 根据题目类型初始化相关状态
      if (location.state.problem.type === 'choice') {
        initializeChoiceOptions(location.state.problem);
      }
    } else {
      fetchProblem();
    }
  }, [problemId, location.state]);

  const fetchProblem = async () => {
    try {
      setLoading(true);
      const result = await getProblem(problemId);
      setProblem(result);
      
      // 根据题目类型初始化相关状态
      if (result.type === 'choice') {
        initializeChoiceOptions(result);
      }
    } catch (error) {
      setError('获取题目信息失败');
      console.error('Error fetching problem:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化选择题选项
  const initializeChoiceOptions = (problemData) => {
    console.log('=== 初始化选择题选项 ===');
    console.log('完整题目数据:', problemData);
    console.log('choice_options 字段:', problemData.choice_options);
    console.log('choice_options 类型:', typeof problemData.choice_options);
    console.log('choice_options 长度:', problemData.choice_options ? problemData.choice_options.length : 'null');
    
    // 尝试多种方式获取选项数据
    let optionsData = null;
    
    // 方法1: 优先使用 choice_options 字段（选择题专用）
    if (problemData.choice_options) {
      optionsData = problemData.choice_options;
      console.log('方法1: 使用 choice_options 字段');
    }
    
    // 方法2: 回退到 test_cases 字段（兼容旧数据）
    if (!optionsData && problemData.test_cases) {
      optionsData = problemData.test_cases;
      console.log('方法2: 使用 test_cases 字段（兼容）');
    }
    
    // 方法3: 尝试使用 options 字段（如果存在）
    if (!optionsData && problemData.options) {
      optionsData = problemData.options;
      console.log('方法3: 使用 options 字段');
    }
    
    // 方法4: 尝试使用 choices 字段（如果存在）
    if (!optionsData && problemData.choices) {
      optionsData = problemData.choices;
      console.log('方法4: 使用 choices 字段');
    }
    
    // 方法5: 尝试使用 answer_options 字段（如果存在）
    if (!optionsData && problemData.answer_options) {
      optionsData = problemData.answer_options;
      console.log('方法5: 使用 answer_options 字段');
    }
    
    if (optionsData) {
      // 如果optionsData是字符串，尝试解析
      if (typeof optionsData === 'string') {
        const optionsStr = optionsData.trim();
        console.log('处理后的选项字符串:', optionsStr);
        
        if (optionsStr.length === 0) {
          console.log('选项字符串为空');
          setOptions([]);
          return;
        }
        
        try {
          // 首先尝试解析为JSON格式
          const parsedOptions = JSON.parse(optionsStr);
          console.log('JSON解析成功:', parsedOptions);
          if (Array.isArray(parsedOptions) && parsedOptions.length > 0) {
            setOptions(parsedOptions);
            return;
          } else {
            console.log('JSON解析结果不是有效数组');
          }
        } catch (e) {
          console.log('JSON解析失败:', e.message);
        }
        
        // 如果不是JSON格式，尝试解析为普通文本
        console.log('尝试文本解析...');
        const lines = optionsStr
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        console.log('解析后的行:', lines);
        console.log('有效行数:', lines.length);
        
        if (lines.length > 0) {
          const parsedOptions = lines.map((line, index) => {
            // 移除行首的字母标识符（如 "A.", "B." 等）
            const cleanText = line.replace(/^[A-Z]\.\s*/, '').trim();
            return {
              id: String.fromCharCode(65 + index), // A, B, C, D...
              text: cleanText,
              value: cleanText
            };
          });
          
          console.log('生成的选项:', parsedOptions);
          setOptions(parsedOptions);
          return;
        } else {
          console.log('没有有效的文本行');
        }
      } else if (Array.isArray(optionsData)) {
        // 如果optionsData已经是数组
        console.log('选项数据已经是数组:', optionsData);
        setOptions(optionsData);
        return;
      } else {
        console.log('选项数据不是字符串也不是数组:', optionsData);
      }
    } else {
      console.log('没有找到任何选项数据字段');
    }
    
    // 如果所有解析方法都失败，设置空选项
    console.log('所有解析方法都失败，设置空选项');
    setOptions([]);
  };

  // 处理选择题选项变化
  const handleOptionChange = (optionId) => {
    if (problem.is_multiple_choice) {
      // 多选题：可以选择多个选项
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          return prev.filter(id => id !== optionId);
        } else {
          return [...prev, optionId];
        }
      });
    } else {
      // 单选题：只能选择一个选项
      setSelectedOptions([optionId]);
    }
    
    // 更新选项的选中状态样式
    const optionElements = document.querySelectorAll('.option-item');
    optionElements.forEach(element => {
      const input = element.querySelector('input');
      if (input.checked) {
        element.classList.add('selected');
      } else {
        element.classList.remove('selected');
      }
    });
  };

  // 处理判断题答案变化
  const handleJudgeAnswerChange = (answer) => {
    setJudgeAnswer(answer);
  };

  // 处理简答题答案变化
  const handleShortAnswerChange = (e) => {
    setShortAnswer(e.target.value);
  };

  // 处理编程题代码变化
  const handleCodeChange = (e) => {
    setForm({...form, code: e.target.value});
  };

  // 处理编程题语言变化
  const handleLanguageChange = (e) => {
    setForm({...form, language: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let submissionData = {
      problem_id: parseInt(problemId),
      language: 'text'
    };

    // 根据题目类型准备提交数据
    switch (problem.type) {
      case 'choice':
        if (selectedOptions.length === 0) {
          setError('请选择答案');
          return;
        }
        submissionData.code = selectedOptions.join(',');
        submissionData.language = 'choice';
        break;
        
      case 'judge':
        if (!judgeAnswer) {
          setError('请选择答案');
          return;
        }
        submissionData.code = judgeAnswer;
        submissionData.language = 'judge';
        break;
        
      case 'short_answer':
        if (!shortAnswer.trim()) {
          setError('请输入答案');
          return;
        }
        submissionData.code = shortAnswer;
        submissionData.language = 'short_answer';
        break;
        
      case 'programming':
        if (!form.code.trim()) {
          setError('请输入代码');
          return;
        }
        submissionData.code = form.code;
        submissionData.language = form.language;
        break;
        
      default:
        setError('不支持的题目类型');
        return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      const result = await submitCode(submissionData);
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

  const getTypeText = (type) => {
    switch (type) {
      case 'programming': return '编程题';
      case 'choice': return '选择题';
      case 'judge': return '判断题';
      case 'short_answer': return '简答题';
      default: return '未知类型';
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
      {/* 测试模式下的返回按钮 */}
      {isTestMode && (
        <div className="test-mode-header">
          <button 
            onClick={() => navigate('/test')} 
            className="back-to-test-btn"
          >
            ← 返回测试页面
          </button>
          <div className="test-mode-badge">测试模式</div>
        </div>
      )}

      <div className="problem-header">
        <div className="problem-title-section">
          <h1>{problem.id}. {problem.title}</h1>
          <div className="problem-badges">
            <span 
              className="type-badge"
              style={{ backgroundColor: '#1890ff' }}
            >
              {getTypeText(problem.type)}
            </span>
            <span 
              className="difficulty-badge"
              style={{ backgroundColor: getDifficultyColor(problem.difficulty) }}
            >
              {getDifficultyText(problem.difficulty)}
            </span>
          </div>
        </div>
        
        {problem.type === 'programming' && (
          <div className="problem-meta">
            <div className="meta-item">
              <span className="meta-label">时间限制:</span>
              <span className="meta-value">{problem.time_limit}ms</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">内存限制:</span>
              <span className="meta-value">{problem.memory_limit}MB</span>
            </div>
          </div>
        )}
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

        {/* 根据题目类型显示不同的内容 */}
        {problem.type === 'programming' && (
          <div className="problem-examples">
            <h2>输入输出示例</h2>
            {problem.test_cases && (
              <div className="example-section">
                <h3>输入:</h3>
                <pre className="example-code">{problem.test_cases}</pre>
              </div>
            )}
            {problem.expected_output && (
              <div className="example-section">
                <h3>期望输出:</h3>
                <pre className="example-code">{problem.expected_output}</pre>
              </div>
            )}
          </div>
        )}

        {problem.type === 'choice' && (
          <div className="problem-options">
            <h2>选项</h2>
            <div className="options-list">
              {options.length > 0 ? (
                options.map((option) => (
                  <label key={option.id} className="option-item">
                    <input
                      type={problem.is_multiple_choice ? "checkbox" : "radio"}
                      name="choice"
                      value={option.id}
                      checked={selectedOptions.includes(option.id)}
                      onChange={() => handleOptionChange(option.id)}
                    />
                    <span className="option-text">
                      <strong>{option.id}.</strong> {option.text}
                    </span>
                  </label>
                ))
              ) : (
                <div className="no-options">
                  <p>暂无选项</p>
                </div>
              )}
            </div>
            {problem.is_multiple_choice && (
              <p className="multiple-choice-hint">注意：本题为多选题，可以选择多个答案</p>
            )}
          </div>
        )}

        {problem.type === 'judge' && (
          <div className="problem-judge">
            <h2>请选择答案</h2>
            <div className="judge-options">
              <label className="judge-option">
                <input
                  type="radio"
                  name="judge"
                  value="A"
                  checked={judgeAnswer === "A"}
                  onChange={() => handleJudgeAnswerChange("A")}
                />
                <span className="judge-text">正确</span>
              </label>
              <label className="judge-option">
                <input
                  type="radio"
                  name="judge"
                  value="B"
                  checked={judgeAnswer === "B"}
                  onChange={() => handleJudgeAnswerChange("B")}
                />
                <span className="judge-text">错误</span>
              </label>
            </div>
          </div>
        )}

        {problem.type === 'short_answer' && (
          <div className="problem-short-answer">
            <h2>请输入答案</h2>
            <textarea
              value={shortAnswer}
              onChange={handleShortAnswerChange}
              placeholder="在这里输入你的答案..."
              rows={8}
              className="short-answer-editor"
            />
          </div>
        )}
      </div>

      {/* 根据题目类型显示不同的提交区域 */}
      {problem.type === 'programming' ? (
        <div className="code-submission">
          <h2>提交代码</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>编程语言:</label>
              <select
                value={form.language}
                onChange={handleLanguageChange}
                className="language-select"
              >
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>
            
            <div className="form-row">
              <label>代码:</label>
              <textarea
                value={form.code}
                onChange={handleCodeChange}
                placeholder="在这里输入你的代码..."
                rows={20}
                className="code-editor"
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={submitting}
              >
                {submitting ? '提交中...' : '提交代码'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="answer-submission">
          <h2>提交答案</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={submitting}
              >
                {submitting ? '提交中...' : '提交答案'}
              </button>
            </div>
          </form>
        </div>
      )}

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

export default ProblemDetailPage;

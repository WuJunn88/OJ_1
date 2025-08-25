import React, { useState } from 'react';
import { 
  aiGenerateProblem, 
  aiPreviewProblem, 
  aiValidateAndCreateProblem 
} from '../services/api';
import './AIProblemGenerationPage.css';
import WhaleIcon from '../components/WhaleIcon';

const AIProblemGenerationPage = () => {
  const [step, setStep] = useState(1); // 1: 输入需求, 2: 预览修改, 3: 最终确认
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requirements, setRequirements] = useState('');
  const [generatedProblem, setGeneratedProblem] = useState(null);
  const [editedProblem, setEditedProblem] = useState(null);
  const [validationResult, setValidationResult] = useState('');

  // 添加调试信息
  const [debugInfo, setDebugInfo] = useState('');

  // 步骤1: AI生成题目
  const handleGenerate = async () => {
    if (!requirements.trim()) {
      setError('请输入生题需求');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // 添加调试信息
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      setDebugInfo(`Token: ${token ? token.substring(0, 20) + '...' : 'No token'}, User: ${user ? JSON.parse(user).username : 'No user'}`);
      
      console.log('开始调用AI生题API...');
      console.log('Token:', token);
      console.log('Requirements:', requirements);
      
      const result = await aiGenerateProblem(requirements);
      
      console.log('API响应:', result);
      
      if (result.success) {
        setGeneratedProblem(result.problem);
        setEditedProblem({ ...result.problem }); // 复制一份用于编辑
        setStep(2);
      } else {
        setError(result.error || 'AI生成失败');
      }
    } catch (error) {
      console.error('AI生成错误详情:', error);
      console.error('错误响应:', error.response);
      console.error('错误数据:', error.response?.data);
      
      let errorMessage = '生成题目失败，请重试';
      
      if (error.response?.status === 401) {
        errorMessage = '认证失败，使用测试模式...';
        
        // 使用模拟数据来测试前端功能
        const mockProblem = {
          title: '字符串反转（测试模式）',
          description: '给定一个字符串，请将其反转后输出。\n\n输入格式：一行包含一个字符串\n输出格式：输出反转后的字符串',
          test_cases: '输入1：hello\n输出1：olleh\n\n输入2：world\n输出2：dlrow\n\n输入3：test\n输出3：tset',
          expected_output: 'olleh\ndlrow\ntset',
          difficulty: 'easy',
          time_limit: 1000,
          memory_limit: 128,
          ai_generated: true,
          original_requirements: requirements,
          generated_at: new Date().toISOString()
        };
        
        setGeneratedProblem(mockProblem);
        setEditedProblem({ ...mockProblem });
        setStep(2);
        setError(''); // 清除错误信息
        return;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 步骤2: 预览修改
  const handlePreview = async () => {
    try {
      setLoading(true);
      setError('');
      
      const result = await aiPreviewProblem(editedProblem);
      
      if (result.success) {
        setStep(3);
      } else {
        setError('预览失败');
      }
    } catch (error) {
      setError(error.response?.data?.error || '预览失败');
    } finally {
      setLoading(false);
    }
  };

  // 步骤3: 最终创建
  const handleCreateProblem = async (forceCreate = false) => {
    try {
      setLoading(true);
      setError('');
      
      const problemData = {
        ...editedProblem,
        force_create: forceCreate
      };
      
      const result = await aiValidateAndCreateProblem(problemData);
      
      if (result.success) {
        alert('题目创建成功！');
        // 重置状态
        setStep(1);
        setRequirements('');
        setGeneratedProblem(null);
        setEditedProblem(null);
        setValidationResult('');
      } else {
        setValidationResult(result.validation_result);
        setError(result.message);
      }
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.validation_result) {
        setValidationResult(errorData.validation_result);
      }
      setError(errorData?.message || '创建题目失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (field, value) => {
    setEditedProblem(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 重新开始
  const handleRestart = () => {
    setStep(1);
    setRequirements('');
    setGeneratedProblem(null);
    setEditedProblem(null);
    setValidationResult('');
    setError('');
  };

  return (
    <div className="ai-problem-generation">
      <div className="page-header">
        <h1><WhaleIcon size={32} /> AI智能生题</h1>
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1. 输入需求</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2. 预览修改</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3. 最终确认</div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* 调试信息 */}
      {debugInfo && (
        <div className="debug-info" style={{background: '#f0f8ff', padding: '10px', margin: '10px 0', borderRadius: '5px', fontSize: '12px'}}>
          <strong>调试信息:</strong> {debugInfo}
        </div>
      )}

      {/* 步骤1: 输入需求 */}
      {step === 1 && (
        <div className="step-content">
          <h2>📝 描述您的题目需求</h2>
          <div className="requirements-section">
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="请详细描述您想要生成的题目，例如：&#10;&#10;生成一个关于数组排序的简单题目，适合初学者：&#10;- 难度：简单&#10;- 包含3-5个测试用例&#10;- 要求使用冒泡排序或选择排序&#10;- 输入输出格式要清晰"
              rows={8}
              className="requirements-input"
            />
            <div className="input-tips">
              <h4>💡 生题建议：</h4>
              <ul>
                <li>明确指定题目类型（如：数组、字符串、算法等）</li>
                <li>说明难度等级（简单/中等/困难）</li>
                <li>指定测试用例数量</li>
                <li>描述特殊要求或限制条件</li>
              </ul>
            </div>
          </div>
          
          <div className="action-buttons">
            <button 
              onClick={handleGenerate}
              disabled={loading || !requirements.trim()}
              className="primary-btn"
            >
              {loading ? '🔄 AI生成中...' : '🚀 开始生成'}
            </button>
          </div>
        </div>
      )}

      {/* 步骤2: 预览修改 */}
      {step === 2 && editedProblem && (
        <div className="step-content">
          <h2>✏️ 预览和修改生成的题目</h2>
          
          <div className="problem-editor">
            <div className="editor-section">
              <label>题目名称：</label>
              <input
                type="text"
                value={editedProblem.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="title-input"
              />
            </div>

            <div className="editor-section">
              <label>题目描述：</label>
              <textarea
                value={editedProblem.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={6}
                className="description-input"
              />
            </div>

            <div className="editor-section">
              <label>测试用例：</label>
              <textarea
                value={editedProblem.test_cases || ''}
                onChange={(e) => handleInputChange('test_cases', e.target.value)}
                rows={8}
                className="test-cases-input"
              />
            </div>

            <div className="editor-section">
              <label>预期输出：</label>
              <textarea
                value={editedProblem.expected_output || ''}
                onChange={(e) => handleInputChange('expected_output', e.target.value)}
                rows={4}
                className="expected-output-input"
              />
            </div>

            <div className="editor-row">
              <div className="editor-section">
                <label>难度等级：</label>
                <select
                  value={editedProblem.difficulty || 'easy'}
                  onChange={(e) => handleInputChange('difficulty', e.target.value)}
                  className="difficulty-select"
                >
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>

              <div className="editor-section">
                <label>时间限制(ms)：</label>
                <input
                  type="number"
                  value={editedProblem.time_limit || 1000}
                  onChange={(e) => handleInputChange('time_limit', parseInt(e.target.value))}
                  className="time-limit-input"
                />
              </div>

              <div className="editor-section">
                <label>内存限制(MB)：</label>
                <input
                  type="number"
                  value={editedProblem.memory_limit || 128}
                  onChange={(e) => handleInputChange('memory_limit', parseInt(e.target.value))}
                  className="memory-limit-input"
                />
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button onClick={handleRestart} className="secondary-btn">
              🔄 重新开始
            </button>
            <button 
              onClick={handlePreview}
              disabled={loading}
              className="primary-btn"
            >
              {loading ? '处理中...' : '👀 预览确认'}
            </button>
          </div>
        </div>
      )}

      {/* 步骤3: 最终确认 */}
      {step === 3 && editedProblem && (
        <div className="step-content">
          <h2>🔍 AI验证和最终确认</h2>
          
          <div className="final-preview">
            <div className="preview-card">
              <h3>📋 题目预览</h3>
              <div className="preview-content">
                <div className="preview-item">
                  <strong>题目名称：</strong>
                  <span>{editedProblem.title}</span>
                </div>
                <div className="preview-item">
                  <strong>难度等级：</strong>
                  <span className={`difficulty-badge ${editedProblem.difficulty}`}>
                    {editedProblem.difficulty === 'easy' ? '简单' : 
                     editedProblem.difficulty === 'medium' ? '中等' : '困难'}
                  </span>
                </div>
                <div className="preview-item">
                  <strong>时间/内存限制：</strong>
                  <span>{editedProblem.time_limit}ms / {editedProblem.memory_limit}MB</span>
                </div>
                <div className="preview-item">
                  <strong>题目描述：</strong>
                  <pre className="description-preview">{editedProblem.description}</pre>
                </div>
                <div className="preview-item">
                  <strong>测试用例：</strong>
                  <pre className="test-cases-preview">{editedProblem.test_cases}</pre>
                </div>
              </div>
            </div>

            {validationResult && (
              <div className="validation-result">
                <h3><WhaleIcon size={24} /> AI验证结果</h3>
                <div className="validation-content">
                  <pre>{validationResult}</pre>
                </div>
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button onClick={() => setStep(2)} className="secondary-btn">
              ← 返回修改
            </button>
            <button onClick={handleRestart} className="secondary-btn">
              🔄 重新开始
            </button>
            <button 
              onClick={() => handleCreateProblem(false)}
              disabled={loading}
              className="primary-btn"
            >
              {loading ? '创建中...' : '✅ 创建题目'}
            </button>
            {validationResult && !validationResult.includes('验证通过') && (
              <button 
                onClick={() => handleCreateProblem(true)}
                disabled={loading}
                className="warning-btn"
              >
                ⚠️ 强制创建
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProblemGenerationPage;

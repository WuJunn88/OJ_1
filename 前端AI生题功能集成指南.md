# 前端AI智能生题功能集成指南

## 概述

本指南将帮助你在现有的React前端中集成AI智能生题功能，包括完整的用户界面和API调用。

## 1. 更新API服务文件

首先需要在 `frontend/src/services/api.js` 中添加AI生题相关的API函数：

### 1.1 添加AI生题API函数

在 `api.js` 文件末尾添加以下代码：

```javascript
/**
 * AI智能生题相关API
 */

// AI生成题目
export const aiGenerateProblem = async (requirements) => {
  const response = await api.post('/problems/ai-generate', { requirements });
  return response.data;
};

// 预览AI生成的题目
export const aiPreviewProblem = async (problemData) => {
  const response = await api.post('/problems/ai-preview', problemData);
  return response.data;
};

// AI验证并创建题目
export const aiValidateAndCreateProblem = async (problemData) => {
  const response = await api.post('/problems/ai-validate', problemData);
  return response.data;
};

// 获取AI生成历史
export const getAiHistory = async () => {
  const response = await api.get('/problems/ai-history');
  return response.data;
};
```

## 2. 创建AI生题组件

### 2.1 创建AI生题页面组件

创建新文件 `frontend/src/pages/AIProblemGenerationPage.js`：

```javascript
import React, { useState } from 'react';
import { 
  aiGenerateProblem, 
  aiPreviewProblem, 
  aiValidateAndCreateProblem 
} from '../services/api';
import './AIProblemGenerationPage.css';

const AIProblemGenerationPage = () => {
  const [step, setStep] = useState(1); // 1: 输入需求, 2: 预览修改, 3: 最终确认
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requirements, setRequirements] = useState('');
  const [generatedProblem, setGeneratedProblem] = useState(null);
  const [editedProblem, setEditedProblem] = useState(null);
  const [validationResult, setValidationResult] = useState('');

  // 步骤1: AI生成题目
  const handleGenerate = async () => {
    if (!requirements.trim()) {
      setError('请输入生题需求');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const result = await aiGenerateProblem(requirements);
      
      if (result.success) {
        setGeneratedProblem(result.problem);
        setEditedProblem({ ...result.problem }); // 复制一份用于编辑
        setStep(2);
      } else {
        setError(result.error || 'AI生成失败');
      }
    } catch (error) {
      setError(error.response?.data?.error || '生成题目失败，请重试');
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
        <h1>🤖 AI智能生题</h1>
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
                <h3>🤖 AI验证结果</h3>
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
```

### 2.2 创建AI生题页面样式

创建新文件 `frontend/src/pages/AIProblemGenerationPage.css`：

```css
.ai-problem-generation {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 15px;
  color: white;
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
}

.page-header h1 {
  margin: 0 0 20px 0;
  font-size: 2.5em;
  font-weight: 700;
}

.step-indicator {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-top: 20px;
}

.step {
  padding: 10px 20px;
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  transition: all 0.3s ease;
}

.step.active {
  background: rgba(255, 255, 255, 0.9);
  color: #667eea;
  font-weight: 700;
  transform: scale(1.05);
}

.step-content {
  background: white;
  border-radius: 15px;
  padding: 30px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.step-content h2 {
  color: #2d3748;
  margin-bottom: 25px;
  font-size: 1.8em;
  border-bottom: 3px solid #667eea;
  padding-bottom: 10px;
}

.error-message {
  background: #fed7d7;
  color: #c53030;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-left: 4px solid #c53030;
}

.error-icon {
  font-size: 1.2em;
}

/* 需求输入区域 */
.requirements-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.requirements-input {
  width: 100%;
  padding: 20px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 16px;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.3s ease;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.requirements-input:focus {
  border-color: #667eea;
  outline: none;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-tips {
  background: #f7fafc;
  padding: 20px;
  border-radius: 10px;
  border-left: 4px solid #48bb78;
}

.input-tips h4 {
  color: #2d3748;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-tips ul {
  margin: 0;
  padding-left: 20px;
}

.input-tips li {
  margin-bottom: 8px;
  color: #4a5568;
  line-height: 1.5;
}

/* 题目编辑器 */
.problem-editor {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-section label {
  font-weight: 600;
  color: #2d3748;
  font-size: 16px;
}

.editor-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}

.title-input, .description-input, .test-cases-input, 
.expected-output-input, .difficulty-select, 
.time-limit-input, .memory-limit-input {
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.title-input:focus, .description-input:focus, 
.test-cases-input:focus, .expected-output-input:focus,
.difficulty-select:focus, .time-limit-input:focus, 
.memory-limit-input:focus {
  border-color: #667eea;
  outline: none;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.description-input, .test-cases-input, .expected-output-input {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.5;
  resize: vertical;
}

/* 最终预览 */
.final-preview {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.preview-card {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 25px;
}

.preview-card h3 {
  color: #2d3748;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item strong {
  color: #4a5568;
  font-size: 14px;
}

.preview-item span, .preview-item pre {
  background: white;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.difficulty-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.difficulty-badge.easy {
  background: #c6f6d5;
  color: #22543d;
}

.difficulty-badge.medium {
  background: #feebc8;
  color: #c05621;
}

.difficulty-badge.hard {
  background: #fed7d7;
  color: #c53030;
}

.description-preview, .test-cases-preview {
  white-space: pre-wrap;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.validation-result {
  background: #edf2f7;
  border: 2px solid #cbd5e0;
  border-radius: 12px;
  padding: 25px;
}

.validation-result h3 {
  color: #2d3748;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.validation-content pre {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  white-space: pre-wrap;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  color: #2d3748;
}

/* 按钮样式 */
.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
  flex-wrap: wrap;
}

.primary-btn, .secondary-btn, .warning-btn {
  padding: 12px 30px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  justify-content: center;
}

.primary-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.primary-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.secondary-btn {
  background: #e2e8f0;
  color: #4a5568;
  border: 2px solid #cbd5e0;
}

.secondary-btn:hover:not(:disabled) {
  background: #cbd5e0;
  transform: translateY(-1px);
}

.warning-btn {
  background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(245, 101, 101, 0.4);
}

.warning-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 101, 101, 0.6);
}

.primary-btn:disabled, .secondary-btn:disabled, .warning-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .ai-problem-generation {
    padding: 10px;
  }

  .requirements-section {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .editor-row {
    grid-template-columns: 1fr;
  }

  .step-indicator {
    flex-direction: column;
    gap: 10px;
  }

  .action-buttons {
    flex-direction: column;
    align-items: center;
  }

  .primary-btn, .secondary-btn, .warning-btn {
    width: 100%;
    max-width: 300px;
  }
}
```

## 3. 更新教师控制台

### 3.1 修改TeacherDashboardPage.js

在现有的 `TeacherDashboardPage.js` 中添加AI生题标签页：

```javascript
// 在现有的导入语句中添加
import AIProblemGenerationPage from './AIProblemGenerationPage';

// 在renderProblemsTab函数中替换为：
const renderProblemsTab = () => (
  <div className="tab-content">
    <div className="section-header">
      <h2>题目管理</h2>
      <div className="problem-actions">
        <button 
          className="action-btn primary"
          onClick={() => setActiveTab('ai-generate')}
        >
          🤖 AI智能生题
        </button>
        <button 
          className="action-btn secondary"
          onClick={() => setActiveTab('manual-create')}
        >
          ✏️ 手动创建题目
        </button>
      </div>
    </div>
    <p>选择创建题目的方式...</p>
  </div>
);

// 添加AI生题标签页渲染函数
const renderAIGenerateTab = () => (
  <div className="tab-content full-width">
    <AIProblemGenerationPage />
  </div>
);

// 在标签按钮区域添加AI生题按钮
<button 
  className={`tab-btn ${activeTab === 'ai-generate' ? 'active' : ''}`}
  onClick={() => setActiveTab('ai-generate')}
>
  🤖 AI生题
</button>

// 在内容渲染区域添加
{activeTab === 'ai-generate' && renderAIGenerateTab()}
```

### 3.2 更新TeacherDashboardPage.css

在 `TeacherDashboardPage.css` 中添加相关样式：

```css
.problem-actions {
  display: flex;
  gap: 15px;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
}

.action-btn.secondary {
  background: #f7fafc;
  color: #4a5568;
  border: 2px solid #e2e8f0;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.tab-content.full-width {
  padding: 0;
  background: transparent;
  box-shadow: none;
}
```

## 4. 更新应用路由

### 4.1 修改App.js

如果你的应用使用了React Router，需要在 `App.js` 中添加路由：

```javascript
import AIProblemGenerationPage from './pages/AIProblemGenerationPage';

// 在路由配置中添加
<Route path="/ai-generate" component={AIProblemGenerationPage} />
```

## 5. 测试功能

### 5.1 启动前端开发服务器

```bash
cd frontend
npm start
```

### 5.2 功能测试流程

1. **登录教师账户**
2. **进入教师控制台**
3. **点击"题目管理"标签**
4. **选择"AI智能生题"**
5. **按照三步流程测试**：
   - 输入生题需求
   - 预览和修改
   - 最终确认创建

### 5.3 测试用例

可以使用以下测试需求：

```
生成一个关于数组排序的简单题目：
- 难度：简单
- 包含3个测试用例
- 要求对整数数组进行升序排序
- 输入输出格式要清晰
- 适合编程初学者
```

## 6. 高级功能扩展

### 6.1 添加题目模板功能

可以预设一些常用的题目模板，让教师快速选择：

```javascript
const PROBLEM_TEMPLATES = [
  {
    name: "数组排序",
    requirements: "生成一个关于数组排序的题目，包含3-5个测试用例，适合初学者"
  },
  {
    name: "字符串处理",
    requirements: "生成一个字符串处理题目，涉及字符串反转、查找或替换操作"
  },
  {
    name: "数学计算",
    requirements: "生成一个数学计算题目，包含基础的加减乘除或数学公式应用"
  }
];
```

### 6.2 添加历史记录功能

可以保存用户的生成历史，方便重复使用：

```javascript
const [history, setHistory] = useState([]);

// 保存到历史记录
const saveToHistory = (problem) => {
  const historyItem = {
    id: Date.now(),
    timestamp: new Date(),
    requirements,
    problem
  };
  setHistory(prev => [historyItem, ...prev.slice(0, 9)]); // 保留最近10条
  localStorage.setItem('ai_generation_history', JSON.stringify(history));
};
```

## 7. 注意事项

### 7.1 错误处理

- 网络请求失败
- AI服务不可用
- 输入验证失败
- 权限验证失败

### 7.2 用户体验优化

- 添加加载动画
- 提供操作提示
- 支持键盘快捷键
- 响应式设计

### 7.3 性能优化

- 组件懒加载
- 防抖输入处理
- 缓存常用数据
- 优化重新渲染

## 8. 部署注意事项

### 8.1 环境变量

确保在生产环境中正确配置：
- API基础URL
- DeepSeek API密钥
- 其他敏感配置

### 8.2 构建优化

```bash
npm run build
```

确保构建产物正确包含新增的组件和样式文件。

---

通过以上步骤，你就可以在前端完整地使用AI智能生题功能了！🎉

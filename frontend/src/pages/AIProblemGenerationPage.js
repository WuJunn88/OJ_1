import React, { useState } from 'react';
import { 
  aiGenerateProblem, 
  aiPreviewProblem, 
  aiValidateAndCreateProblem,
  getProblems
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

  // 测试用例管理
  const [testCases, setTestCases] = useState([{ input: '', output: '' }]);
  
  // 格式模板弹窗状态
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [activeFormatTab, setActiveFormatTab] = useState('testcase');
  const [isClosingModal, setIsClosingModal] = useState(false);

  // 解析测试用例（从AI生成的格式转换为结构化格式）
  const parseGeneratedTestCases = (testCasesText, expectedOutputText) => {
    if (!testCasesText || !expectedOutputText) return [{ input: '', output: '' }];
    
    // 添加调试日志
    console.log('开始解析测试用例:');
    console.log('testCasesText:', testCasesText);
    console.log('expectedOutputText:', expectedOutputText);
    
    try {
      // 尝试解析为JSON格式
      const parsed = JSON.parse(testCasesText);
      if (Array.isArray(parsed)) {
        console.log('成功解析为JSON格式');
        return parsed.map(tc => ({
          input: tc.input || '',
          output: tc.output || ''
        }));
      }
    } catch (e) {
      // 如果不是JSON，尝试解析文本格式
      console.log('解析为JSON失败，尝试解析文本格式');
    }

    // 策略1：识别结构化格式（输入1：xxx 输出1：xxx）
    console.log('尝试识别结构化格式');
    const structuredResult = parseStructuredFormat(testCasesText);
    if (structuredResult.length > 0) {
      console.log('成功解析为结构化格式');
      return structuredResult;
    }

    // 策略2：智能行分割（基于内容特征）
    console.log('尝试智能行分割');
    const lines = testCasesText.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const smartResult = smartLineSplit(lines);
      if (smartResult.length > 0) {
        console.log('使用智能行分割成功');
        return smartResult;
      }
    }

    // 策略3：回退到简化解析逻辑
    console.log('使用简化解析逻辑');
    
    // 尝试从testCasesText中提取输入和输出
    let inputContent = '';
    let outputContent = '';
    
    // 如果AI生成了包含"输入："和"输出："的格式，尝试提取
    if (testCasesText.includes('输入：') && testCasesText.includes('输出：')) {
      const parts = testCasesText.split('输出：');
      if (parts.length >= 2) {
        inputContent = parts[0].replace('输入：', '').trim();
        outputContent = parts[1].trim();
      }
    } else {
      // 如果没有明确标记，尝试智能分割
      const lines = testCasesText.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        // 假设前一半是输入，后一半是输出
        const midPoint = Math.ceil(lines.length / 2);
        inputContent = lines.slice(0, midPoint).join('\n');
        outputContent = lines.slice(midPoint).join('\n');
      }
    }
    
    // 如果从testCasesText没有提取到内容，尝试从expectedOutputText
    if (!inputContent && !outputContent && expectedOutputText) {
      outputContent = expectedOutputText.trim();
    }
    
    console.log('提取的输入内容:', inputContent);
    console.log('提取的输出内容:', outputContent);
    
    // 返回一个包含提取内容的测试用例，让教师手动调整
    if (inputContent || outputContent) {
      return [{
        input: inputContent,
        output: outputContent,
        _needsManualReview: true // 标记需要手动检查
      }];
    }
    
    // 如果什么都没提取到，返回空的测试用例
    return [{ input: '', output: '' }];
  };

  // 解析结构化格式的函数
  const parseStructuredFormat = (testCasesText) => {
    const result = [];
    
    // 策略1：匹配新格式：测试用例X: 输入：xxx 输出：xxx
    const newFormatPattern = /测试用例(\d+):\s*\n输入：\s*([\s\S]*?)(?=\n输出：|$)\n输出：\s*([\s\S]*?)(?=\n测试用例\d+:|$)/g;
    
    let match;
    while ((match = newFormatPattern.exec(testCasesText)) !== null) {
      const index = parseInt(match[1]);
      const input = match[2].trim();
      const output = match[3].trim();
      
      result.push({
        input: input,
        output: output,
        _needsManualReview: false
      });
    }
    
    if (result.length > 0) {
      console.log(`新格式解析到 ${result.length} 个测试用例`);
      return result;
    }
    
    // 策略2：匹配旧格式：输入1：[内容] 输出1：[内容] 输入2：[内容] 输出2：[内容] ...
    const inputPattern = /输入(\d+)[：:]\s*([\s\S]*?)(?=输出\1[：:]|输入\d+[：:]|$)/g;
    const outputPattern = /输出(\d+)[：:]\s*([\s\S]*?)(?=输入\d+[：:]|输出\d+[：:]|$)/g;
    
    const inputs = {};
    const outputs = {};
    
    // 提取所有输入
    while ((match = inputPattern.exec(testCasesText)) !== null) {
      const index = parseInt(match[1]);
      inputs[index] = match[2].trim();
    }
    
    // 提取所有输出
    while ((match = outputPattern.exec(testCasesText)) !== null) {
      const index = parseInt(match[1]);
      outputs[index] = match[2].trim();
    }
    
    // 如果找到结构化格式，按索引匹配
    if (Object.keys(inputs).length > 0 || Object.keys(outputs).length > 0) {
      const maxIndex = Math.max(
        ...Object.keys(inputs).map(k => parseInt(k)),
        ...Object.keys(outputs).map(k => parseInt(k))
      );
      
      for (let i = 1; i <= maxIndex; i++) {
        result.push({
          input: inputs[i] || '',
          output: outputs[i] || '',
          _needsManualReview: !inputs[i] || !outputs[i] // 如果缺少输入或输出，标记需要检查
        });
      }
      
      console.log(`旧格式解析到 ${result.length} 个测试用例`);
      return result;
    }
    
    return [];
  };

  // 智能行分割函数
  const smartLineSplit = (lines) => {
    const result = [];
    let currentInput = [];
    let currentOutput = [];
    let inInputSection = true;
    let testCaseIndex = 1;
    
    // 预处理：识别可能的输入输出模式
    const hasInputOutputPattern = lines.some(line => 
      line.toLowerCase().includes('输入') || line.toLowerCase().includes('输出')
    );
    
    // 如果没有明确的输入输出标记，尝试基于内容特征分割
    if (!hasInputOutputPattern) {
      return splitByContentFeatures(lines);
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 检测输入输出分界点
      if (isInputOutputBoundary(line, lines, i)) {
        // 保存当前的测试用例
        if (currentInput.length > 0 || currentOutput.length > 0) {
          result.push({
            input: currentInput.join('\n'),
            output: currentOutput.join('\n'),
            _needsManualReview: currentInput.length === 0 || currentOutput.length === 0
          });
          testCaseIndex++;
        }
        
        // 重置当前测试用例
        currentInput = [];
        currentOutput = [];
        inInputSection = !inInputSection;
      }
      
      // 根据当前状态添加到输入或输出
      if (inInputSection) {
        currentInput.push(line);
      } else {
        currentOutput.push(line);
      }
    }
    
    // 添加最后一个测试用例
    if (currentInput.length > 0 || currentOutput.length > 0) {
      result.push({
        input: currentInput.join('\n'),
        output: currentOutput.join('\n'),
        _needsManualReview: currentInput.length === 0 || currentOutput.length === 0
      });
    }
    
    console.log(`智能行分割得到 ${result.length} 个测试用例`);
    return result;
  };

  // 基于内容特征的分割函数
  const splitByContentFeatures = (lines) => {
    const result = [];
    
    // 尝试找到输入输出的分界点
    let splitPoint = findOptimalSplitPoint(lines);
    
    if (splitPoint > 0) {
      const inputLines = lines.slice(0, splitPoint);
      const outputLines = lines.slice(splitPoint);
      
      // 尝试进一步分割为多个测试用例
      const testCases = splitIntoMultipleTestCases(inputLines, outputLines);
      
      if (testCases.length > 1) {
        return testCases;
      } else {
        return [{
          input: inputLines.join('\n'),
          output: outputLines.join('\n'),
          _needsManualReview: false
        }];
      }
    }
    
    // 如果找不到分界点，使用简单的前后分割
    const midPoint = Math.ceil(lines.length / 2);
    return [{
      input: lines.slice(0, midPoint).join('\n'),
      output: lines.slice(midPoint).join('\n'),
      _needsManualReview: true
    }];
  };

  // 找到最优分割点
  const findOptimalSplitPoint = (lines) => {
    // 策略1：寻找明显的分隔符
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '---' || line === '===' || line === '***' || line === '') {
        // 检查前后是否有内容
        const hasContentBefore = i > 0 && lines[i-1].trim() !== '';
        const hasContentAfter = i < lines.length - 1 && lines[i+1].trim() !== '';
        
        if (hasContentBefore && hasContentAfter) {
          return i;
        }
      }
    }
    
    // 策略2：基于数字模式识别
    for (let i = 1; i < lines.length; i++) {
      const prevLine = lines[i-1].trim();
      const currentLine = lines[i].trim();
      
      // 如果前一行是单个数字，当前行也是数字，可能是新测试用例
      if (/^\d+$/.test(prevLine) && /^\d+/.test(currentLine)) {
        return i;
      }
    }
    
    // 策略3：基于空行分隔
    for (let i = 1; i < lines.length - 1; i++) {
      if (lines[i].trim() === '' && lines[i-1].trim() !== '' && lines[i+1].trim() !== '') {
        return i + 1;
      }
    }
    
    return -1;
  };

  // 关闭弹窗函数（带动画）
  const closeFormatModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowFormatModal(false);
      setIsClosingModal(false);
    }, 300); // 等待动画完成
  };

  // 复制到剪贴板函数
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加一个简单的提示
      alert('格式已复制到剪贴板！');
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('格式已复制到剪贴板！');
    }
  };

  // 分割为多个测试用例
  const splitIntoMultipleTestCases = (inputLines, outputLines) => {
    const result = [];
    
    // 尝试识别测试用例的数量
    const inputNumbers = inputLines.filter(line => /^\d+$/.test(line.trim()));
    const outputNumbers = outputLines.filter(line => /^\d+$/.test(line.trim()));
    
    if (inputNumbers.length === outputNumbers.length && inputNumbers.length > 1) {
      // 按数字分组
      let currentInput = [];
      let currentOutput = [];
      let currentIndex = 0;
      
      for (let i = 0; i < inputLines.length; i++) {
        const line = inputLines[i];
        if (/^\d+$/.test(line.trim())) {
          // 保存前一个测试用例
          if (currentInput.length > 0 || currentOutput.length > 0) {
            result.push({
              input: currentInput.join('\n'),
              output: currentOutput.join('\n'),
              _needsManualReview: false
            });
          }
          
          currentInput = [line];
          currentOutput = [];
          currentIndex++;
        } else {
          currentInput.push(line);
        }
      }
      
      // 添加最后一个测试用例
      if (currentInput.length > 0) {
        result.push({
          input: currentInput.join('\n'),
          output: currentOutput.join('\n'),
          _needsManualReview: false
        });
      }
      
      return result;
    }
    
    // 如果无法识别多个测试用例，返回单个
    return [{
      input: inputLines.join('\n'),
      output: outputLines.join('\n'),
      _needsManualReview: false
    }];
  };

  // 检测输入输出分界点的函数
  const isInputOutputBoundary = (line, allLines, currentIndex) => {
    const lineLower = line.toLowerCase();
    
    // 检测明显的分隔符
    if (lineLower.includes('---') || lineLower.includes('===') || lineLower.includes('***')) {
      return true;
    }
    
    // 检测数字编号（如 "1." "2." 等）
    if (/^\d+\./.test(line.trim())) {
      return true;
    }
    
    // 检测"输入X："或"输出X："格式
    if (/^(输入|输出)\d+[：:]/.test(line.trim())) {
      return true;
    }
    
    // 检测空行后的新测试用例开始
    if (currentIndex > 0 && allLines[currentIndex - 1].trim() === '') {
      const nextLines = allLines.slice(currentIndex + 1, currentIndex + 3);
      if (nextLines.some(l => l.toLowerCase().includes('输入') || l.toLowerCase().includes('输出'))) {
        return true;
      }
    }
    
    // 检测连续空行（可能表示测试用例分隔）
    if (currentIndex > 0 && currentIndex < allLines.length - 1) {
      const prevLine = allLines[currentIndex - 1].trim();
      const nextLine = allLines[currentIndex + 1].trim();
      if (prevLine === '' && nextLine === '' && line.trim() === '') {
        return true;
      }
    }
    
    return false;
  };

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
        
        // 解析测试用例
        const parsedCases = parseGeneratedTestCases(result.problem.test_cases, result.problem.expected_output);
        setTestCases(parsedCases);
        
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
        
        // 解析测试用例
        const parsedCases = parseGeneratedTestCases(mockProblem.test_cases, mockProblem.expected_output);
        setTestCases(parsedCases);
        
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
      
      // 将测试用例转换为字符串格式，保持向后兼容
      const testCasesText = testCases.map(tc => 
        `输入：${tc.input}\n输出：${tc.output}`
      ).join('\n\n');
      
      const expectedOutputText = testCases.map(tc => tc.output).join('\n');
      
      const updatedProblem = {
        ...editedProblem,
        test_cases: testCasesText,
        expected_output: expectedOutputText
      };
      
      setEditedProblem(updatedProblem);
      
      const result = await aiPreviewProblem(updatedProblem);
      
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
      
      // 将测试用例转换为JSON格式
      const testCasesJson = JSON.stringify(testCases.map(tc => ({
        input: tc.input || '',
        output: tc.output || ''
      })));
      
      const problemData = {
        ...editedProblem,
        test_cases: testCasesJson,
        expected_output: testCases.map(tc => tc.output || '').join('\n'), // 保持向后兼容
        force_create: forceCreate
      };
      
      const result = await aiValidateAndCreateProblem(problemData);
      
      if (result.success) {
        alert('题目创建成功！');
        
        // 尝试刷新题目列表
        try {
          const problemsData = await getProblems(1, 9, '', true);  // 获取所有题目
          console.log('题目创建成功，新题目数据:', problemsData);
          
          // 尝试通过多种方式通知父组件刷新
          // 方法1: localStorage标记
          localStorage.setItem('refreshProblems', 'true');
          localStorage.setItem('lastProblemCreated', new Date().toISOString());
          
          // 方法2: 自定义事件
          window.dispatchEvent(new CustomEvent('problemCreated', { 
            detail: { problemData: problemsData } 
          }));
          
          // 方法3: 如果当前页面在iframe中，通知父页面
          if (window.parent && window.parent !== window) {
            try {
              window.parent.postMessage({ 
                type: 'PROBLEM_CREATED', 
                data: problemsData 
              }, '*');
            } catch (e) {
              console.log('无法通知父页面:', e);
            }
          }
          
        } catch (error) {
          console.warn('无法刷新题目列表:', error);
        }
        
        // 重置状态
        setStep(1);
        setRequirements('');
        setGeneratedProblem(null);
        setEditedProblem(null);
        setValidationResult('');
        setTestCases([{ input: '', output: '' }]);
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
    setTestCases([{ input: '', output: '' }]);
  };

  // 测试用例管理
  const addTestCase = () => {
    setTestCases([...testCases, { input: '', output: '' }]);
  };

  const removeTestCase = (index) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const updateTestCase = (index, field, value) => {
    const newTestCases = [...testCases];
    newTestCases[index][field] = value;
    setTestCases(newTestCases);
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
              placeholder="请详细描述您想要生成的题目，例如：&#10;&#10;生成一个关于数组排序的简单题目，适合初学者：&#10;- 难度：简单&#10;- 包含3-5个测试用例&#10;- 要求使用冒泡排序或选择排序&#10;&#10;💡 为了提高AI生成质量，建议在描述中明确指定：&#10;• 测试用例数量（如：3-5个）&#10;• 输入输出格式要求（如：每行一个数字、空格分隔等）&#10;• 边界情况（如：空数组、单个元素、大量数据等）&#10;• 特殊要求（如：时间限制、内存限制等）&#10;&#10;AI会按照规范格式生成测试用例，系统会自动识别和分割，减少手动调整工作。"
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
                <li><strong>工作流程：</strong></li>
                <li style={{marginLeft: '20px'}}>• AI生成基本的输入输出样例</li>
                <li style={{marginLeft: '20px'}}>• 教师在预览阶段手动调整测试用例</li>
                <li style={{marginLeft: '20px'}}>• 支持多行输入和输出</li>
                <li style={{marginLeft: '20px'}}>• 支持空输入（如排序题目）</li>
              </ul>
              
              <div className="format-template">
                <h4>📋 格式模板参考：</h4>
                <p>点击下方按钮查看详细的格式模板和测试用例格式要求</p>
                <button 
                  type="button" 
                  onClick={() => setShowFormatModal(true)}
                  className="format-modal-btn"
                >
                  📋 查看格式模板
                </button>
              </div>
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
              <label>测试用例管理：</label>
              <div className="test-case-manager">
                <div className="test-case-header">
                  <span>测试用例列表</span>
                  <button 
                    type="button" 
                    onClick={addTestCase}
                    className="add-test-case-btn"
                  >
                    + 添加测试用例
                  </button>
                </div>
                
                {testCases.length === 0 ? (
                  <div className="no-test-cases">
                    <p>暂无测试用例，请点击"添加测试用例"按钮添加</p>
                  </div>
                ) : (
                  <>
                    {/* 智能提示区域 */}
                    {testCases.some(tc => tc._needsManualReview) && (
                      <div className="parsing-warnings">
                        <h4>⚠️ 检测到以下问题，请检查：</h4>
                        <ul>
                          {testCases.map((tc, idx) => {
                            if (tc._needsManualReview) {
                              if (!tc.input && !tc.output) {
                                return <li key={idx}>测试用例 {idx + 1} 输入和输出都为空，请补充</li>;
                              } else if (!tc.input) {
                                return <li key={idx}>测试用例 {idx + 1} 缺少输入数据</li>;
                              } else if (!tc.output) {
                                return <li key={idx}>测试用例 {idx + 1} 缺少期望输出</li>;
                              } else if (tc.input.includes('输出') || tc.output.includes('输入')) {
                                return <li key={idx}>测试用例 {idx + 1} 可能存在输入输出混淆，请检查</li>;
                              }
                            }
                            return null;
                          })}
                        </ul>
                      </div>
                    )}
                    
                    <div className="test-cases-list">
                      {testCases.map((testCase, index) => (
                        <div key={index} className={`test-case-item ${testCase._needsManualReview ? 'needs-review' : ''}`}>
                          <div className="test-case-header-row">
                            <span className="test-case-number">
                              测试用例 {index + 1}
                              {testCase._needsManualReview && <span className="review-badge">⚠️ 需检查</span>}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeTestCase(index)}
                              className="remove-test-case-btn"
                              title="删除此测试用例"
                            >
                              ×
                            </button>
                          </div>
                          <div className="test-case-content">
                            <div className="input-section">
                              <label>输入：</label>
                              <textarea
                                value={testCase.input}
                                onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                                placeholder="输入数据（可以为空）"
                                rows={2}
                                className="test-case-input"
                              />
                            </div>
                            <div className="output-section">
                              <label>期望输出：</label>
                              <textarea
                                value={testCase.output}
                                onChange={(e) => updateTestCase(index, 'output', e.target.value)}
                                placeholder="期望输出"
                                rows={2}
                                className="test-case-output"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

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

            <div className="editor-row">
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
                  <div className="test-cases-preview">
                    {testCases.map((tc, index) => (
                      <div key={index} className="preview-test-case">
                        <div className="preview-test-case-header">
                          <strong>测试用例 {index + 1}:</strong>
                        </div>
                        <div className="preview-test-case-content">
                          <div><strong>输入:</strong> {tc.input || '(无输入)'}</div>
                          <div><strong>期望输出:</strong> {tc.output}</div>
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* 格式模板弹窗 */}
      {showFormatModal && (
        <div className={`format-modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={closeFormatModal}>
          <div className="format-modal" onClick={(e) => e.stopPropagation()}>
            <div className="format-modal-header">
              <h3>📋 格式模板参考</h3>
              <button 
                className="close-btn"
                onClick={closeFormatModal}
              >
                ×
              </button>
            </div>
            
            <div className="format-modal-content">
              <div className="format-tabs">
                <button 
                  className={`format-tab ${activeFormatTab === 'full' ? 'active' : ''}`}
                  onClick={() => setActiveFormatTab('full')}
                >
                  完整模板
                </button>
                <button 
                  className={`format-tab ${activeFormatTab === 'testcase' ? 'active' : ''}`}
                  onClick={() => setActiveFormatTab('testcase')}
                >
                  测试用例格式
                </button>
              </div>
              
              {activeFormatTab === 'full' && (
                <div className="format-tab-content">
                  <h4>📝 完整题目生成模板</h4>
                  <div className="template-examples">
                    <div className="template-example">
                      <h5>数组排序题目</h5>
                      <pre>{`生成一个数组排序题目，要求：
- 难度：简单
- 测试用例：3-5个
- 输入格式：第一行数字n，第二行n个整数
- 输出格式：排序后的数组
- 边界情况：包含空数组、单个元素、重复元素
- 特殊要求：时间复杂度O(n²)`}</pre>
                    </div>
                    
                    <div className="template-example">
                      <h5>字符串处理题目</h5>
                      <pre>{`生成一个字符串反转题目，要求：
- 难度：简单  
- 测试用例：4个
- 输入格式：每行一个字符串
- 输出格式：反转后的字符串
- 边界情况：空字符串、单字符、长字符串
- 特殊要求：支持中文字符`}</pre>
                    </div>
                  </div>
                </div>
              )}
              
              {activeFormatTab === 'testcase' && (
                <div className="format-tab-content">
                  <h4>🧪 测试用例格式要求（可直接复制使用）</h4>
                  <div className="testcase-format">
                    <div className="format-section">
                      <h5>基础格式</h5>
                      <pre>{`测试用例1:
输入：[]
输出：[]

测试用例2:
输入：1
42
输出：42

测试用例3:
输入：3
3 1 2
输出：1 2 3`}</pre>
                      <button 
                        className="copy-btn"
                        onClick={() => copyToClipboard(`测试用例1:
输入：[]
输出：[]

测试用例2:
输入：1
42
输出：42

测试用例3:
输入：3
3 1 2
输出：1 2 3`)}
                      >
                        📋 复制格式
                      </button>
                    </div>
                    
                    <div className="format-section">
                      <h5>字符串格式</h5>
                      <pre>{`测试用例1:
输入：
输出：

测试用例2:
输入：a
输出：a

测试用例3:
输入：hello
输出：olleh`}</pre>
                      <button 
                        className="copy-btn"
                        onClick={() => copyToClipboard(`测试用例1:
输入：
输出：

测试用例2:
输入：a
输出：a

测试用例3:
输入：hello
输出：olleh`)}
                      >
                        📋 复制格式
                      </button>
                    </div>
                    
                    <div className="format-section">
                      <h5>数学计算格式</h5>
                      <pre>{`测试用例1:
输入：0 0
输出：0

测试用例2:
输入：1 2
输出：3

测试用例3:
输入：-5 3
输出：-2`}</pre>
                      <button 
                        className="copy-btn"
                        onClick={() => copyToClipboard(`测试用例1:
输入：0 0
输出：0

测试用例2:
输入：1 2
输出：3

测试用例3:
输入：-5 3
输出：-2`)}
                      >
                        📋 复制格式
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProblemGenerationPage;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './TestPage.css';

const TestPage = () => {
  const [selectedType, setSelectedType] = useState('programming');

  const testProblems = [
    {
      id: 1,
      title: 'Hello World',
      type: 'programming',
      description: '编写一个程序，输出"Hello, World!"',
      test_cases: '无输入',
      expected_output: 'Hello, World!',
      difficulty: 'easy',
      time_limit: 1000,
      memory_limit: 128,
      is_multiple_choice: false
    },
    {
      id: 2,
      title: '选择题示例',
      type: 'choice',
      description: '以下哪个是编程语言？',
      choice_options: 'Python\nJava\nC++\nJavaScript',
      expected_output: 'A,B,C,D',
      difficulty: 'easy',
      is_multiple_choice: false
    },
    {
      id: 3,
      title: '判断题示例',
      type: 'judge',
      description: 'Python是一种解释型语言。',
      expected_output: '正确',
      difficulty: 'easy',
      is_multiple_choice: false
    },
    {
      id: 4,
      title: '简答题示例',
      type: 'short_answer',
      description: '请简述什么是面向对象编程？',
      expected_output: '封装,继承,多态',
      difficulty: 'medium',
      is_multiple_choice: false
    },
    {
      id: 5,
      title: '多选题示例',
      type: 'choice',
      description: '以下哪些是前端技术？（多选）',
      choice_options: 'HTML\nCSS\nJavaScript\nPython\nReact',
      expected_output: 'A,B,C,E',
      difficulty: 'medium',
      is_multiple_choice: true
    }
  ];

  const getTypeText = (type) => {
    switch (type) {
      case 'programming': return '编程题';
      case 'choice': return '选择题';
      case 'judge': return '判断题';
      case 'short_answer': return '简答题';
      default: return '未知类型';
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

  return (
    <div className="test-page">
      <div className="container">
        <h1>题目类型测试页面</h1>
        <p>这个页面用于测试不同题型的显示效果。点击下面的题目可以查看详情页。</p>
        
        <div className="problem-type-selector">
          <h3>选择题目类型查看：</h3>
          <div className="type-buttons">
            {['programming', 'choice', 'judge', 'short_answer'].map(type => (
              <button
                key={type}
                className={`type-btn ${selectedType === type ? 'active' : ''}`}
                onClick={() => setSelectedType(type)}
              >
                {getTypeText(type)}
              </button>
            ))}
          </div>
        </div>

        <div className="test-problems">
          <h3>测试题目列表：</h3>
          <div className="problems-grid">
            {testProblems
              .filter(problem => selectedType === 'all' || problem.type === selectedType)
              .map(problem => (
                <div key={problem.id} className="problem-card">
                  <div className="problem-header">
                    <h4>{problem.title}</h4>
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
                        {problem.difficulty === 'easy' ? '简单' : 
                         problem.difficulty === 'medium' ? '中等' : '困难'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="problem-description">
                    {problem.description}
                  </div>
                  
                  {problem.type === 'programming' && (
                    <div className="problem-meta">
                      <span>时间限制: {problem.time_limit}ms</span>
                      <span>内存限制: {problem.memory_limit}MB</span>
                    </div>
                  )}
                  
                  <div className="problem-actions">
                    <Link 
                      to={`/problem/${problem.id}`} 
                      className="view-btn"
                      state={{ problem: problem }}
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="test-instructions">
          <h3>测试说明：</h3>
          <ul>
            <li><strong>编程题</strong>：显示代码编辑器、语言选择、输入输出示例</li>
            <li><strong>选择题</strong>：显示选项列表，支持单选和多选</li>
            <li><strong>判断题</strong>：显示"正确"和"错误"两个选项</li>
            <li><strong>简答题</strong>：显示文本输入框，用于输入答案</li>
          </ul>
          
          <div className="note">
            <strong>注意：</strong> 这些是测试数据，实际使用时需要从数据库获取真实的题目信息。
            判题服务已经更新以支持所有题目类型。
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;

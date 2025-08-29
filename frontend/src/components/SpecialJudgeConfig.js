import React, { useState, useEffect } from 'react';
import './SpecialJudgeConfig.css';

const SpecialJudgeConfig = ({ problem, onSave, onCancel }) => {
    const [config, setConfig] = useState({
        enable_special_judge: false,
        special_judge_language: 'python',
        special_judge_timeout: 5000,
        special_judge_memory_limit: 256,
        judge_type: 'exact',
        judge_config: {}
    });

    const [customScript, setCustomScript] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        if (problem) {
            setConfig({
                enable_special_judge: problem.enable_special_judge || false,
                special_judge_language: problem.special_judge_language || 'python',
                special_judge_timeout: problem.special_judge_timeout || 5000,
                special_judge_memory_limit: problem.special_judge_memory_limit || 256,
                judge_type: 'exact',
                judge_config: {}
            });

            if (problem.judge_config) {
                try {
                    const parsed = JSON.parse(problem.judge_config);
                    setConfig(prev => ({
                        ...prev,
                        judge_type: parsed.type || 'exact',
                        judge_config: parsed
                    }));
                } catch (e) {
                    console.warn('Failed to parse judge config:', e);
                }
            }

            setCustomScript(problem.special_judge_script || '');
        }
    }, [problem]);

    const handleConfigChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleJudgeTypeChange = (type) => {
        let newConfig = {};
        
        switch (type) {
            case 'float':
                newConfig = {
                    type: 'float',
                    epsilon: 1e-6,
                    relative_error: 1e-6
                };
                break;
            case 'multiple_solutions':
                newConfig = {
                    type: 'multiple_solutions',
                    solutions: ['', '']
                };
                break;
            case 'format':
                newConfig = {
                    type: 'format',
                    line_count: true,
                    line_format: '^[0-9]+( [0-9]+)*$'
                };
                break;
            case 'partial':
                newConfig = {
                    type: 'partial',
                    scoring_rules: [
                        { type: 'exact', score: 10, description: '完全正确' },
                        { type: 'contains', score: 5, keywords: ['key'], description: '包含关键词' }
                    ]
                };
                break;
            default:
                newConfig = { type: 'exact' };
        }

        setConfig(prev => ({
            ...prev,
            judge_type: type,
            judge_config: newConfig
        }));
    };

    const handleSave = () => {
        const finalConfig = {
            ...config,
            special_judge_script: customScript,
            judge_config: JSON.stringify(config.judge_config)
        };
        onSave(finalConfig);
    };

    const renderFloatConfig = () => (
        <div className="judge-config-section">
            <h4>浮点数误差配置</h4>
            <div className="config-row">
                <label>绝对误差 (epsilon):</label>
                <input
                    type="number"
                    step="1e-9"
                    value={config.judge_config.epsilon || 1e-6}
                    onChange={(e) => {
                        const newConfig = { ...config.judge_config, epsilon: parseFloat(e.target.value) };
                        setConfig(prev => ({ ...prev, judge_config: newConfig }));
                    }}
                />
            </div>
            <div className="config-row">
                <label>相对误差:</label>
                <input
                    type="number"
                    step="1e-9"
                    value={config.judge_config.relative_error || 1e-6}
                    onChange={(e) => {
                        const newConfig = { ...config.judge_config, relative_error: parseFloat(e.target.value) };
                        setConfig(prev => ({ ...prev, judge_config: newConfig }));
                    }}
                />
            </div>
        </div>
    );

    const renderMultipleSolutionsConfig = () => (
        <div className="judge-config-section">
            <h4>多解配置</h4>
            <div className="solutions-list">
                {config.judge_config.solutions?.map((solution, index) => (
                    <div key={index} className="solution-item">
                        <input
                            type="text"
                            value={solution}
                            placeholder={`解 ${index + 1}`}
                            onChange={(e) => {
                                const newSolutions = [...config.judge_config.solutions];
                                newSolutions[index] = e.target.value;
                                const newConfig = { ...config.judge_config, solutions: newSolutions };
                                setConfig(prev => ({ ...prev, judge_config: newConfig }));
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newSolutions = config.judge_config.solutions.filter((_, i) => i !== index);
                                const newConfig = { ...config.judge_config, solutions: newSolutions };
                                setConfig(prev => ({ ...prev, judge_config: newConfig }));
                            }}
                        >
                            删除
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        const newSolutions = [...(config.judge_config.solutions || []), ''];
                        const newConfig = { ...config.judge_config, solutions: newSolutions };
                        setConfig(prev => ({ ...prev, judge_config: newConfig }));
                    }}
                >
                    添加解
                </button>
            </div>
        </div>
    );

    const renderFormatConfig = () => (
        <div className="judge-config-section">
            <h4>格式要求配置</h4>
            <div className="config-row">
                <label>
                    <input
                        type="checkbox"
                        checked={config.judge_config.line_count || false}
                        onChange={(e) => {
                            const newConfig = { ...config.judge_config, line_count: e.target.checked };
                            setConfig(prev => ({ ...prev, judge_config: newConfig }));
                        }}
                    />
                    检查行数
                </label>
            </div>
            <div className="config-row">
                <label>行格式正则表达式:</label>
                <input
                    type="text"
                    value={config.judge_config.line_format || ''}
                    placeholder="^[0-9]+( [0-9]+)*$"
                    onChange={(e) => {
                        const newConfig = { ...config.judge_config, line_format: e.target.value };
                        setConfig(prev => ({ ...prev, judge_config: newConfig }));
                    }}
                />
            </div>
        </div>
    );

    const renderPartialConfig = () => (
        <div className="judge-config-section">
            <h4>部分正确配置</h4>
            <div className="scoring-rules">
                {config.judge_config.scoring_rules?.map((rule, index) => (
                    <div key={index} className="scoring-rule">
                        <div className="rule-header">
                            <span>规则 {index + 1}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const newRules = config.judge_config.scoring_rules.filter((_, i) => i !== index);
                                    const newConfig = { ...config.judge_config, scoring_rules: newRules };
                                    setConfig(prev => ({ ...prev, judge_config: newConfig }));
                                }}
                            >
                                删除
                            </button>
                        </div>
                        <div className="rule-content">
                            <select
                                value={rule.type}
                                onChange={(e) => {
                                    const newRules = [...config.judge_config.scoring_rules];
                                    newRules[index] = { ...rule, type: e.target.value };
                                    const newConfig = { ...config.judge_config, scoring_rules: newRules };
                                    setConfig(prev => ({ ...prev, judge_config: newConfig }));
                                }}
                            >
                                <option value="exact">精确匹配</option>
                                <option value="contains">包含关键词</option>
                                <option value="pattern">正则匹配</option>
                            </select>
                            <input
                                type="number"
                                placeholder="分数"
                                value={rule.score || 0}
                                onChange={(e) => {
                                    const newRules = [...config.judge_config.scoring_rules];
                                    newRules[index] = { ...rule, score: parseInt(e.target.value) };
                                    const newConfig = { ...config.judge_config, scoring_rules: newRules };
                                    setConfig(prev => ({ ...prev, judge_config: newConfig }));
                                }}
                            />
                            <input
                                type="text"
                                placeholder="描述"
                                value={rule.description || ''}
                                onChange={(e) => {
                                    const newRules = [...config.judge_config.scoring_rules];
                                    newRules[index] = { ...rule, description: e.target.value };
                                    const newConfig = { ...config.judge_config, scoring_rules: newRules };
                                    setConfig(prev => ({ ...prev, judge_config: newConfig }));
                                }}
                            />
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        const newRule = { type: 'exact', score: 10, description: '新规则' };
                        const newRules = [...(config.judge_config.scoring_rules || []), newRule];
                        const newConfig = { ...config.judge_config, scoring_rules: newRules };
                        setConfig(prev => ({ ...prev, judge_config: newConfig }));
                    }}
                >
                    添加评分规则
                </button>
            </div>
        </div>
    );

    return (
        <div className="special-judge-config">
            <h3>Special Judge 配置</h3>
            
            <div className="config-section">
                <label>
                    <input
                        type="checkbox"
                        checked={config.enable_special_judge}
                        onChange={(e) => handleConfigChange('enable_special_judge', e.target.checked)}
                    />
                    启用特殊判题
                </label>
            </div>

            {config.enable_special_judge && (
                <>
                    <div className="config-section">
                        <h4>基本配置</h4>
                        <div className="config-row">
                            <label>判题脚本语言:</label>
                            <select
                                value={config.special_judge_language}
                                onChange={(e) => handleConfigChange('special_judge_language', e.target.value)}
                            >
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                                <option value="java">Java</option>
                            </select>
                        </div>
                        <div className="config-row">
                            <label>超时时间 (ms):</label>
                            <input
                                type="number"
                                value={config.special_judge_timeout}
                                onChange={(e) => handleConfigChange('special_judge_timeout', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="config-row">
                            <label>内存限制 (MB):</label>
                            <input
                                type="number"
                                value={config.special_judge_memory_limit}
                                onChange={(e) => handleConfigChange('special_judge_memory_limit', parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="config-section">
                        <h4>判题类型</h4>
                        <div className="judge-type-selector">
                            <button
                                type="button"
                                className={config.judge_type === 'exact' ? 'active' : ''}
                                onClick={() => handleJudgeTypeChange('exact')}
                            >
                                精确匹配
                            </button>
                            <button
                                type="button"
                                className={config.judge_type === 'float' ? 'active' : ''}
                                onClick={() => handleJudgeTypeChange('float')}
                            >
                                浮点数比较
                            </button>
                            <button
                                type="button"
                                className={config.judge_type === 'multiple_solutions' ? 'active' : ''}
                                onClick={() => handleJudgeTypeChange('multiple_solutions')}
                            >
                                多解验证
                            </button>
                            <button
                                type="button"
                                className={config.judge_type === 'format' ? 'active' : ''}
                                onClick={() => handleJudgeTypeChange('format')}
                            >
                                格式要求
                            </button>
                            <button
                                type="button"
                                className={config.judge_type === 'partial' ? 'active' : ''}
                                onClick={() => handleJudgeTypeChange('partial')}
                            >
                                部分正确
                            </button>
                        </div>

                        {config.judge_type === 'float' && renderFloatConfig()}
                        {config.judge_type === 'multiple_solutions' && renderMultipleSolutionsConfig()}
                        {config.judge_type === 'format' && renderFormatConfig()}
                        {config.judge_type === 'partial' && renderPartialConfig()}
                    </div>

                    <div className="config-section">
                        <h4>自定义判题脚本</h4>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            {showAdvanced ? '隐藏' : '显示'} 高级选项
                        </button>
                        
                        {showAdvanced && (
                            <div className="script-editor">
                                <textarea
                                    value={customScript}
                                    onChange={(e) => setCustomScript(e.target.value)}
                                    placeholder="输入自定义判题脚本..."
                                    rows={10}
                                />
                                <div className="script-help">
                                    <p>脚本需要实现以下接口：</p>
                                    <ul>
                                        <li>输入：user_output, expected_output, input_data</li>
                                        <li>输出：JSON格式的判题结果</li>
                                        <li>格式：{"result": "ACCEPTED", "message": "说明", "score": 1.0}</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="config-actions">
                <button type="button" onClick={handleSave} className="save-btn">
                    保存配置
                </button>
                <button type="button" onClick={onCancel} className="cancel-btn">
                    取消
                </button>
            </div>
        </div>
    );
};

export default SpecialJudgeConfig;

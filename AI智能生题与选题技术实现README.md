# AI智能生题与选题系统技术实现文档

## 📖 项目概述

本系统实现了基于大语言模型（DeepSeek）的AI智能生题和智能选题功能，为编程教育提供智能化的题目管理解决方案。

## 🏗️ 系统架构

### 整体架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端界面      │    │   后端API       │    │   DeepSeek API  │
│                 │    │                 │    │                 │
│ • 生题页面      │◄──►│ • 生题接口      │◄──►│ • 大语言模型    │
│ • 选题页面      │    │ • 选题接口      │    │ • 智能分析      │
│ • 预览编辑      │    │ • 数据解析      │    │ • 内容生成      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 技术栈
- **前端**: React.js + CSS3
- **后端**: Python Flask + SQLAlchemy
- **AI服务**: DeepSeek API (deepseek-chat模型)
- **数据库**: SQLite
- **认证**: JWT Token

## 🎯 AI智能生题功能

### 功能描述
根据教师输入的自然语言需求，自动生成完整的编程题目，包括题目描述、测试用例、预期输出等。

### 核心实现

#### 1. 前端界面 (`AIProblemGenerationPage.js`)
```javascript
// 主要状态管理
const [step, setStep] = useState(1); // 1: 输入需求, 2: 预览修改, 3: 最终确认
const [requirements, setRequirements] = useState('');
const [generatedProblem, setGeneratedProblem] = useState(null);
const [editedProblem, setEditedProblem] = useState(null);

// AI生题调用
const handleGenerate = async () => {
  const result = await aiGenerateProblem(requirements);
  if (result.success) {
    setGeneratedProblem(result.problem);
    setStep(2);
  }
};
```

#### 2. 后端API实现 (`app.py`)
```python
@app.route('/problems/ai-generate', methods=['POST'])
@teacher_required
def ai_generate_problem(current_user):
    """根据用户需求使用AI生成题目"""
    data = request.json
    requirements = data.get('requirements', '')
    
    # 生成提示词
    prompt = generate_problem_prompt(requirements)
    
    # 调用AI模型
    ai_response = call_ai_model(prompt)
    
    # 解析AI返回的内容
    parsed_problem = parse_ai_generated_problem(ai_response)
    
    return jsonify({
        'success': True,
        'problem': parsed_problem,
        'message': '题目生成成功，请审阅并修改'
    }), 200
```

#### 3. AI模型调用 (`call_ai_model`)
```python
def call_ai_model(prompt, max_tokens=2000):
    """直接调用DeepSeek API生成内容"""
    url = f"{DEEPSEEK_API_BASE}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "你是一个专业的编程题目生成助手..."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.7
    }
    
    response = requests.post(url, headers=headers, json=data, timeout=AI_REQUEST_TIMEOUT)
    return response.json()['choices'][0]['message']['content'].strip()
```

#### 4. 内容解析 (`parse_ai_generated_problem`)
```python
def parse_ai_generated_problem(ai_response):
    """解析AI生成的题目内容"""
    # 使用正则表达式解析结构化内容
    title_match = re.search(r'题目名称[：:]\s*(.+)', ai_response)
    description_match = re.search(r'题目描述[：:]\s*(.*?)(?=测试用例|$)', ai_response, re.DOTALL)
    test_cases_match = re.search(r'测试用例[：:]\s*(.*?)(?=预期输出|$)', ai_response, re.DOTALL)
    expected_output_match = re.search(r'预期输出[：:]\s*(.*?)(?=难度|$)', ai_response, re.DOTALL)
    difficulty_match = re.search(r'难度[：:]\s*(.+)', ai_response)
    
    return {
        'title': title_match.group(1).strip() if title_match else '未指定题目名称',
        'description': description_match.group(1).strip() if description_match else '未指定题目描述',
        'test_cases': test_cases_match.group(1).strip() if test_cases_match else '未指定测试用例',
        'expected_output': expected_output_match.group(1).strip() if expected_output_match else '未指定预期输出',
        'difficulty': difficulty_match.group(1).strip() if difficulty_match else 'easy'
    }
```

### 生题流程
1. **需求输入**: 教师输入自然语言描述
2. **AI生成**: 调用DeepSeek API生成题目内容
3. **内容解析**: 解析AI返回的结构化内容
4. **预览编辑**: 教师预览并修改生成的题目
5. **最终确认**: 验证题目信息并创建到系统

## 🎯 AI智能选题功能

### 功能描述
根据教师的教学需求和课程特点，从现有题目库中智能选择最合适的题目组合。

### 核心实现

#### 1. 前端界面 (`TeacherDashboardPage.js`)
```javascript
// AI选题状态管理
const [aiSelectionForm, setAiSelectionForm] = useState({
  requirements: '',
  problem_count: 3
});
const [aiSelectedProblems, setAiSelectedProblems] = useState([]);
const [isAiSelecting, setIsAiSelecting] = useState(false);

// AI选题处理
const handleAiSelectProblems = async () => {
  const result = await aiSelectProblems({
    requirements: aiSelectionForm.requirements,
    course_id: editingCourse.id,
    problem_count: aiSelectionForm.problem_count
  });
  
  setAiSelectedProblems(result.selected_problems || []);
  
  // 自动将AI选择的题目添加到作业表单中
  const selectedProblemIds = result.selected_problems.map(p => p.problem_id);
  setAssignmentForm(prev => ({
    ...prev,
    problem_ids: [...new Set([...prev.problem_ids, ...selectedProblemIds])]
  }));
};
```

#### 2. 后端API实现 (`app.py`)
```python
@app.route('/ai/select-problems', methods=['POST'])
@token_required
def ai_select_problems(current_user):
    """AI智能选题接口"""
    data = request.get_json()
    requirements = data['requirements']
    course_id = data['course_id']
    problem_count = data['problem_count']
    
    # 获取所有可用的题目
    available_problems = Problem.query.filter_by(is_active=True).all()
    
    # 构建题目信息用于AI分析
    problem_info = []
    for problem in available_problems:
        problem_info.append({
            'id': problem.id,
            'title': problem.title,
            'description': problem.description,
            'difficulty': problem.difficulty,
            'tags': problem.tags if hasattr(problem, 'tags') else []
        })
    
    # 调用DeepSeek API进行智能选题
    selected_problems = call_ai_problem_selection(
        requirements, problem_info, problem_count
    )
    
    return jsonify({
        'message': 'AI智能选题成功',
        'selected_problems': selected_problems,
        'total_count': len(selected_problems)
    }), 200
```

#### 3. AI选题逻辑 (`call_ai_problem_selection`)
```python
def call_ai_problem_selection(requirements, problem_info, problem_count):
    """调用DeepSeek API进行智能选题"""
    # 构建AI提示词
    prompt = f"""
你是一个专业的编程教育专家，需要根据教师的要求从题目库中选择合适的编程题目。

教师选题需求：
{requirements}

需要选择的题目数量：{problem_count}题

可用题目库：
{json.dumps(problem_info, ensure_ascii=False, indent=2)}

请根据教师的需求，从题目库中选择最合适的{problem_count}道题目。选择标准：
1. 题目难度要适合课程要求
2. 题目内容要符合教师描述的需求
3. 题目类型要多样化，覆盖不同的编程概念
4. 题目难度要有梯度，从简单到困难

请严格按照以下JSON格式返回结果：
{{
    "selected_problems": [
        {{
            "problem_id": 题目ID,
            "reason": "选择理由",
            "difficulty_level": "难度等级",
            "concept_coverage": "覆盖的编程概念"
        }}
    ],
    "selection_summary": "选题总结说明"
}}
"""
    
    # 调用DeepSeek API
    response = requests.post(url, headers=headers, json=data, timeout=AI_REQUEST_TIMEOUT)
    ai_response = response.json()['choices'][0]['message']['content']
    
    # 解析AI返回的JSON
    ai_result = json.loads(ai_response)
    selected_problems = ai_result.get('selected_problems', [])
    
    return selected_problems[:problem_count]
```

#### 4. 备用选题方案 (`fallback_problem_selection`)
```python
def fallback_problem_selection(requirements, problem_info, problem_count):
    """备用选题方案：基于关键词匹配的简单选题"""
    # 按难度分组题目
    easy_problems = [p for p in problem_info if p.get('difficulty', '').lower() in ['easy', '简单', '初级']]
    medium_problems = [p for p in problem_info if p.get('difficulty', '').lower() in ['medium', '中等', '中级']]
    hard_problems = [p for p in problem_info if p.get('difficulty', '').lower() in ['hard', '困难', '高级']]
    
    # 根据需求数量分配不同难度的题目
    if problem_count >= 3:
        # 选择1个简单题，1个中等题，1个困难题
        if easy_problems:
            selected_problems.append({
                'problem_id': easy_problems[0]['id'],
                'reason': '基于难度梯度选择：简单题目',
                'difficulty_level': '简单',
                'concept_coverage': '基础编程概念'
            })
        # ... 其他难度选择逻辑
```

### 选题流程
1. **需求分析**: 教师输入选题需求和数量
2. **题目库分析**: 系统收集所有可用题目信息
3. **AI智能选择**: 调用DeepSeek API分析需求并选择题目
4. **结果展示**: 显示选中的题目及选择理由
5. **自动应用**: 将选中的题目自动添加到作业中

## 🔧 技术特点

### 1. 容错机制
- **API调用失败回退**: 当DeepSeek API调用失败时，自动回退到模拟模式
- **JSON解析容错**: 当AI返回格式不正确时，使用备用选题方案
- **网络超时处理**: 设置合理的超时时间，避免长时间等待

### 2. 数据标准化
- **字段名统一**: 处理不同来源数据的字段名差异
- **格式转换**: 自动转换AI生成的内容为系统标准格式
- **默认值处理**: 为缺失字段提供合理的默认值

### 3. 用户体验优化
- **分步操作**: 生题过程分为输入、预览、确认三个步骤
- **实时反馈**: 提供加载状态和错误提示
- **智能预览**: 支持题目内容的实时编辑和修改

### 4. 安全性保障
- **权限控制**: 只有教师和管理员可以使用AI功能
- **输入验证**: 严格验证用户输入和AI返回内容
- **资源限制**: 设置合理的API调用频率和超时限制

## 📊 性能优化

### 1. 缓存策略
- **AI响应缓存**: 缓存常用的AI生成结果
- **题目信息缓存**: 缓存题目库信息，减少重复查询

### 2. 异步处理
- **非阻塞调用**: AI API调用不阻塞用户界面
- **后台处理**: 复杂的AI分析在后台进行

### 3. 资源管理
- **连接池**: 复用HTTP连接，减少连接开销
- **内存优化**: 及时释放不需要的数据结构

## 🚀 部署配置

### 环境变量配置
```bash
# DeepSeek API配置
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_API_BASE=https://api.deepseek.com/v1

# AI功能开关
USE_MOCK_AI_FLAG=false
USE_MOCK_AI_ON_ERROR=true
AI_REQUEST_TIMEOUT=60

# 模拟模式配置
MOCK_AI_RESPONSE_DELAY=1
```

### 依赖安装
```bash
# 后端依赖
pip install flask flask-sqlalchemy requests

# 前端依赖
npm install react axios
```

## 📝 使用示例

### AI生题示例
```javascript
// 前端调用
const requirements = "生成一道关于数组排序的题目，难度中等，适合大二学生";
const result = await aiGenerateProblem(requirements);

// 返回结果
{
  "success": true,
  "problem": {
    "title": "数组排序",
    "description": "给定一个整数数组，请将其按升序排列...",
    "test_cases": "输入1：3\n3 1 2\n输出1：1 2 3...",
    "expected_output": "1 2 3\n1 2 5 8 9\n42",
    "difficulty": "medium"
  }
}
```

### AI选题示例
```javascript
// 前端调用
const selectionData = {
  requirements: "需要3道关于数组和循环的题目，难度从简单到困难",
  course_id: 1,
  problem_count: 3
};
const result = await aiSelectProblems(selectionData);

// 返回结果
{
  "message": "AI智能选题成功",
  "selected_problems": [
    {
      "problem_id": 15,
      "reason": "基础数组操作，适合初学者",
      "difficulty_level": "简单",
      "concept_coverage": "数组遍历、基本循环"
    },
    // ... 其他选中的题目
  ],
  "total_count": 3
}
```

## 🔮 未来扩展

### 1. 功能增强
- **多语言支持**: 支持英文、日文等多种语言的题目生成
- **题目类型扩展**: 支持选择题、判断题等其他题型
- **个性化推荐**: 基于学生学习历史推荐合适的题目

### 2. 技术优化
- **模型微调**: 针对编程教育场景微调大语言模型
- **本地部署**: 支持本地部署AI模型，提高响应速度
- **智能评估**: 自动评估生成题目的质量和难度

### 3. 集成扩展
- **LMS集成**: 与主流学习管理系统集成
- **代码评测**: 集成在线代码评测系统
- **学习分析**: 提供学习数据分析和可视化

## 📚 相关文档

- [API接口文档](./API_DOCS.md)
- [前端组件说明](./FRONTEND_COMPONENTS.md)
- [后端服务架构](./BACKEND_ARCHITECTURE.md)
- [AI模型配置](./AI_MODEL_CONFIG.md)

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

本项目采用MIT许可证，详见[LICENSE](./LICENSE)文件。

---

*最后更新时间: 2025年1月*
*维护者: OJ系统开发团队*

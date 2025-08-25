# AI智能生题功能 API 文档

## 概述

本文档描述了AI智能生题功能的API接口，该功能允许教师使用大模型生成编程题目，支持预览、修改和验证等完整流程。

## 环境配置

### 环境变量

在使用AI生题功能前，需要配置以下环境变量：

```bash
# DeepSeek API配置
DEEPSEEK_API_KEY=your-deepseek-api-key-here
DEEPSEEK_API_BASE=https://api.deepseek.com/v1  # 可选，默认为DeepSeek官方API
```

### 依赖安装

确保安装了所需依赖：

```bash
pip install -r requirements.txt
```

## API 接口

### 1. AI生成题目

**接口地址：** `POST /problems/ai-generate`

**权限要求：** 教师权限

**请求头：**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**请求参数：**
```json
{
  "requirements": "生成一个关于数组排序的简单题目，适合初学者，包含3个测试用例"
}
```

**响应示例：**
```json
{
  "success": true,
  "problem": {
    "title": "数组排序",
    "description": "给定一个整数数组，请将其按升序排列。\n\n输入格式：\n第一行包含一个整数n，表示数组长度\n第二行包含n个整数，表示数组元素\n\n输出格式：\n输出排序后的数组，元素间用空格分隔",
    "test_cases": "输入1：\n3\n3 1 2\n输出1：\n1 2 3\n\n输入2：\n5\n5 2 8 1 9\n输出2：\n1 2 5 8 9\n\n输入3：\n1\n42\n输出3：\n42",
    "expected_output": "1 2 3\n1 2 5 8 9\n42",
    "difficulty": "easy",
    "ai_generated": true,
    "original_requirements": "生成一个关于数组排序的简单题目，适合初学者，包含3个测试用例",
    "ai_raw_response": "题目名称：数组排序\n\n题目描述：...",
    "generated_at": "2024-01-01T12:00:00.000Z"
  },
  "message": "题目生成成功，请审阅并修改"
}
```

### 2. 题目预览

**接口地址：** `POST /problems/ai-preview`

**权限要求：** 教师权限

**功能说明：** 用于预览教师修改后的题目内容

**请求参数：**
```json
{
  "title": "修改后的题目标题",
  "description": "修改后的题目描述",
  "test_cases": "修改后的测试用例",
  "expected_output": "修改后的预期输出",
  "difficulty": "medium",
  "time_limit": 2000,
  "memory_limit": 256,
  "ai_generated": true,
  "original_requirements": "原始需求"
}
```

**响应示例：**
```json
{
  "success": true,
  "preview": {
    "title": "修改后的题目标题",
    "description": "修改后的题目描述",
    "test_cases": "修改后的测试用例",
    "expected_output": "修改后的预期输出",
    "difficulty": "medium",
    "time_limit": 2000,
    "memory_limit": 256,
    "ai_generated": true,
    "original_requirements": "原始需求",
    "modified_at": "2024-01-01T12:05:00.000Z"
  },
  "message": "题目预览成功"
}
```

### 3. AI验证并创建题目

**接口地址：** `POST /problems/ai-validate`

**权限要求：** 教师权限

**功能说明：** 使用AI验证题目的正确性，然后创建题目到数据库

**请求参数：**
```json
{
  "title": "数组排序",
  "description": "题目描述内容",
  "test_cases": "测试用例内容",
  "expected_output": "预期输出内容",
  "difficulty": "easy",
  "time_limit": 1000,
  "memory_limit": 128,
  "skip_validation": false,  // 可选：跳过AI验证
  "force_create": false      // 可选：强制创建（即使验证失败）
}
```

**成功响应（验证通过）：**
```json
{
  "success": true,
  "problem": {
    "id": 123,
    "title": "数组排序",
    "description": "题目描述内容",
    "test_cases": "测试用例内容",
    "expected_output": "预期输出内容",
    "difficulty": "easy",
    "time_limit": 1000,
    "memory_limit": 128,
    "created_by": 1,
    "created_at": "2024-01-01T12:10:00.000Z",
    "is_active": true
  },
  "validation_result": "验证通过",
  "message": "题目创建成功"
}
```

**验证失败响应：**
```json
{
  "success": false,
  "validation_result": "发现以下问题：\n1. 测试用例2的预期输出不正确\n2. 题目描述中缺少输入格式说明\n\n建议修改：\n1. 检查测试用例2的计算结果\n2. 补充完整的输入输出格式说明",
  "message": "AI验证发现问题，请根据建议修改后重新提交",
  "can_force_create": true
}
```

### 4. 获取AI生成历史

**接口地址：** `GET /problems/ai-history`

**权限要求：** 教师权限

**功能说明：** 获取该教师的AI生成题目历史记录（当前版本返回空列表）

**响应示例：**
```json
{
  "history": [],
  "message": "暂无AI生成历史记录"
}
```

## 使用流程

### 完整的AI生题流程

1. **生成题目**
   ```bash
   curl -X POST http://localhost:5000/problems/ai-generate \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"requirements": "生成一个关于字符串反转的中等难度题目"}'
   ```

2. **预览修改**（可选）
   ```bash
   curl -X POST http://localhost:5000/problems/ai-preview \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "字符串反转",
       "description": "修改后的描述...",
       "test_cases": "修改后的测试用例...",
       "expected_output": "修改后的预期输出..."
     }'
   ```

3. **验证并创建**
   ```bash
   curl -X POST http://localhost:5000/problems/ai-validate \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "字符串反转",
       "description": "最终的题目描述...",
       "test_cases": "最终的测试用例...",
       "expected_output": "最终的预期输出...",
       "difficulty": "medium"
     }'
   ```

## 错误处理

### 常见错误码

- `400` - 请求参数错误
- `401` - 认证失败
- `403` - 权限不足（非教师用户）
- `500` - 服务器内部错误（AI API调用失败等）

### 错误响应格式

```json
{
  "error": "错误描述信息"
}
```

### AI API调用失败处理

当AI模型调用失败时，会返回具体的错误信息：

```json
{
  "error": "生成题目失败: DeepSeek模型调用失败: API rate limit exceeded"
}
```

## 配置说明

### 支持的大模型

当前使用DeepSeek AI模型，可以通过修改`DEEPSEEK_API_BASE`环境变量来使用其他兼容的服务：

- DeepSeek Chat（推荐）
- 其他OpenAI兼容的API服务

### 模型参数调整

在`app.py`中的`call_ai_model`函数中可以调整以下参数：

- `model`: 使用的模型名称（默认：deepseek-chat）
- `max_tokens`: 最大生成token数（默认：2000）
- `temperature`: 生成的随机性（默认：0.7）

## 安全注意事项

1. **API密钥安全**：确保DeepSeek API密钥安全存储，不要在代码中硬编码
2. **权限控制**：只有教师权限的用户才能使用AI生题功能
3. **输入验证**：所有用户输入都经过验证，防止注入攻击
4. **速率限制**：建议在生产环境中添加API调用速率限制

## 扩展功能

### 未来可能的扩展

1. **生成历史存储**：将AI生成的题目历史存储到数据库
2. **批量生成**：支持一次生成多个题目
3. **模板支持**：支持基于模板生成特定类型的题目
4. **多语言支持**：支持生成不同编程语言的题目

### 自定义大模型

如需使用其他大模型服务，可以修改`call_ai_model`函数中的API调用逻辑。

## 示例代码

### JavaScript前端调用示例

```javascript
// 生成题目
async function generateProblem(requirements, token) {
  const response = await fetch('/problems/ai-generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requirements })
  });
  
  return await response.json();
}

// 验证并创建题目
async function validateAndCreateProblem(problemData, token) {
  const response = await fetch('/problems/ai-validate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(problemData)
  });
  
  return await response.json();
}
```

### Python客户端示例

```python
import requests

class ProblemGenerator:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def generate_problem(self, requirements):
        response = requests.post(
            f'{self.base_url}/problems/ai-generate',
            headers=self.headers,
            json={'requirements': requirements}
        )
        return response.json()
    
    def validate_and_create(self, problem_data):
        response = requests.post(
            f'{self.base_url}/problems/ai-validate',
            headers=self.headers,
            json=problem_data
        )
        return response.json()

# 使用示例
generator = ProblemGenerator('http://localhost:5000', 'your-jwt-token')
result = generator.generate_problem('生成一个关于链表的题目')
print(result)
```

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持AI生成题目
- 支持题目预览和修改
- 支持AI验证和创建题目
- 添加基本的错误处理和权限控制

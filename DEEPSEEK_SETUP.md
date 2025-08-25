# DeepSeek API 配置指南

## 获取DeepSeek API密钥

1. 访问 [DeepSeek开放平台](https://platform.deepseek.com/)
2. 注册账户并登录
3. 进入控制台，创建API密钥
4. 复制API密钥备用

## 环境变量配置

在启动应用前，设置以下环境变量：

### macOS/Linux
```bash
export DEEPSEEK_API_KEY="your-deepseek-api-key-here"
export DEEPSEEK_API_BASE="https://api.deepseek.com/v1"  # 可选，默认值
```

### Windows
```cmd
set DEEPSEEK_API_KEY=your-deepseek-api-key-here
set DEEPSEEK_API_BASE=https://api.deepseek.com/v1
```

## 测试API连接

你可以使用curl命令测试DeepSeek API是否正常工作：

```bash
curl -X POST https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "max_tokens": 100
  }'
```

## 模型选择

DeepSeek提供以下模型：

- `deepseek-chat`: 主要的对话模型（推荐用于题目生成）
- `deepseek-coder`: 专门的代码模型（可用于更专业的编程题目）

可以在 `app.py` 的 `call_ai_model` 函数中修改模型名称。

## 使用流程

1. 设置环境变量
2. 启动Flask应用
3. 使用AI生题功能

## 注意事项

1. **API密钥安全**: 不要将API密钥硬编码在代码中
2. **速率限制**: DeepSeek API有调用频率限制，注意控制请求频率
3. **网络连接**: 确保服务器能够访问 `api.deepseek.com`
4. **超时设置**: 当前设置为30秒超时，可根据需要调整

## 错误处理

常见错误及解决方案：

### 401 Unauthorized
- 检查API密钥是否正确
- 确认API密钥是否已激活

### 429 Too Many Requests
- 降低请求频率
- 检查是否超出配额限制

### 网络连接错误
- 检查网络连接
- 确认防火墙设置
- 验证API端点URL是否正确

## 自定义配置

如果需要使用其他兼容的API端点，可以修改环境变量：

```bash
export DEEPSEEK_API_BASE="https://your-custom-endpoint.com/v1"
```

这样可以支持私有部署或其他兼容的API服务。

# OJ在线评测系统

一个功能完整的在线评测系统，支持多种编程语言，包含学生端和教师端功能。

## 功能特性

### 学生端功能
- **用户认证**: 学生登录、注册、密码找回
- **题目浏览**: 查看题目列表、题目详情、难度筛选
- **代码提交**: 支持Python、C++、Java、JavaScript等语言
- **实时判题**: 代码在沙箱环境中安全执行，实时返回结果
- **提交历史**: 查看个人提交记录和判题结果

### 教师端功能
- **学生管理**: 注册学生账号、批量导入、编辑删除学生信息
- **组织架构**: 支持学校-专业-班级三级管理结构
- **题目管理**: 创建、编辑、删除题目
- **权限控制**: 基于角色的访问控制

### 技术特性
- **安全沙箱**: 代码在隔离环境中执行，防止恶意代码
- **资源限制**: 支持时间限制和内存限制
- **消息队列**: 使用RabbitMQ实现异步判题
- **实时更新**: 判题状态实时反馈

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端界面      │    │   主服务        │    │   判题服务      │
│   (React)       │◄──►│   (Flask)       │◄──►│   (Python)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                       │
                              ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   数据库        │    │   沙箱环境      │
                       │   (MySQL)       │    │   (Docker)      │
                       └─────────────────┘    └─────────────────┘
```

## 环境要求

- Python 3.8+
- Node.js 16+
- MySQL 8.0+
- RabbitMQ 3.8+
- Docker (可选，用于沙箱环境)

## 安装步骤

### 1. 准备项目
```bash
# 如果你已经有项目文件，直接进入项目目录
cd Judger_1

# 或者如果你想要版本控制，可以初始化Git仓库
git init
git add .
git commit -m "Initial commit"
```

### 2. 后端设置

#### 安装Python依赖
```bash
cd backend/main-service
pip install -r requirements.txt

cd ../judge-service
pip install -r requirements.txt
```

#### 配置数据库
1. 创建MySQL数据库
```sql
CREATE DATABASE oj_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 修改数据库连接配置
编辑 `backend/main-service/app.py` 中的数据库连接字符串：
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://用户名:密码@localhost:3306/oj_system?charset=utf8mb4'
```

#### 配置RabbitMQ
确保RabbitMQ服务正在运行，默认配置为localhost:5672

### 3. 前端设置

#### 安装Node.js依赖
```bash
cd frontend
npm install
```

#### 配置API地址
编辑 `frontend/src/services/api.js` 中的API基础URL：
```javascript
const API_BASE_URL = 'http://localhost:5000';
```

## 运行系统

### 1. 启动后端服务

#### 启动主服务
```bash
cd backend/main-service
python app.py
```
主服务将在 http://localhost:5000 启动

#### 启动判题服务
```bash
cd backend/judge-service
python judge.py
```

### 2. 启动前端服务
```bash
cd frontend
npm start
```
前端将在 http://localhost:3000 启动

### 3. 访问系统
- 前端界面: http://localhost:3000
- 后端API: http://localhost:5000

## 使用说明

### 首次使用
1. 访问系统首页，点击"注册账号"
2. 注册一个教师账号
3. 使用教师账号登录，进入管理控制台
4. 创建学校、专业、班级信息
5. 批量导入学生账号或手动创建
6. 创建题目

### 学生使用
1. 使用教师提供的账号登录
2. 浏览题目列表
3. 选择题目，查看详情
4. 编写代码并提交
5. 查看判题结果

### 教师管理
1. 登录教师账号
2. 进入管理控制台
3. 管理学生账号
4. 创建和管理题目
5. 查看提交统计

## 支持的编程语言

- **Python**: 使用python3执行
- **C++**: 使用g++编译，支持C++11标准
- **Java**: 使用javac编译，java执行
- **JavaScript**: 使用Node.js执行

## 安全特性

- **代码隔离**: 每个提交在独立的沙箱环境中执行
- **资源限制**: 限制执行时间和内存使用
- **权限控制**: 基于角色的访问控制
- **输入验证**: 严格的输入验证和过滤

## 配置说明

### 沙箱环境配置
编辑 `backend/judge-service/sandbox.py` 中的资源限制：
```python
def set_resource_limits(memory_limit_mb: int, time_limit_ms: int):
    # 设置内存限制
    memory_limit_kb = memory_limit_mb * 1024
    resource.setrlimit(resource.RLIMIT_AS, (memory_limit_kb * 1024, memory_limit_kb * 1024))
    
    # 设置CPU时间限制
    time_limit_sec = time_limit_ms / 1000
    resource.setrlimit(resource.RLIMIT_CPU, (time_limit_sec, time_limit_sec))
```

### JWT配置
编辑 `backend/main-service/app.py` 中的JWT密钥：
```python
app.config['JWT_SECRET_KEY'] = 'your-jwt-secret-key-here'
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否运行
   - 验证数据库连接字符串
   - 确认数据库用户权限

2. **RabbitMQ连接失败**
   - 检查RabbitMQ服务状态
   - 验证连接参数
   - 确认队列权限

3. **判题服务无响应**
   - 检查判题服务是否启动
   - 验证沙箱环境配置
   - 查看错误日志

4. **前端无法连接后端**
   - 检查CORS配置
   - 验证API地址
   - 确认后端服务状态

### 日志查看
- 主服务日志: 控制台输出
- 判题服务日志: 控制台输出
- 数据库日志: MySQL错误日志

## 开发说明

### 添加新的编程语言支持
1. 在 `backend/judge-service/sandbox.py` 中添加新的运行函数
2. 在 `backend/shared/models.py` 中更新语言选项
3. 在前端界面中添加语言选择

### 扩展用户权限
1. 在 `backend/shared/models.py` 中添加新的角色
2. 在 `backend/main-service/app.py` 中添加权限装饰器
3. 在前端路由中添加权限控制

### 自定义判题逻辑
1. 修改 `backend/judge-service/judge.py` 中的判题逻辑
2. 添加更多的测试用例支持
3. 实现部分正确判断

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

本项目采用MIT许可证，详见LICENSE文件。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交Issue
- 发送邮件
- 参与讨论

---

**注意**: 本系统仅用于教育和学习目的，请勿用于生产环境。在生产环境中使用前，请进行充分的安全测试和配置优化。

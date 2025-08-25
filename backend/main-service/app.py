#Flask 应用的主入口，配置数据库，初始化 RabbitMQ 连接，
# 提供提交代码、获取结果、管理题目的 API 接口。
# 提交代码时会创建 Submission 记录，发送消息到 RabbitMQ 队列，供判题服务处理。
import os, sys
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir)
if backend_root not in sys.path:
    sys.path.append(backend_root)
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from database import db
from models import Problem, Submission, Course, CourseStudent
from models.user import User, SchoolModel, MajorModel, ClassModel, DepartmentModel
from models.assignment import Assignment, AssignmentProblem
import pika
import json
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import quote_plus
import requests
import re

app = Flask(__name__)
# 优先读取环境变量中的数据库URL，否则使用SQLite数据库
db_uri = os.getenv('DATABASE_URL')
if not db_uri:
    # 如果设置了MySQL相关环境变量，使用MySQL
    if os.getenv('DB_USER') and os.getenv('DB_PASSWORD'):
        db_user = os.getenv('DB_USER')
        db_pass = os.getenv('DB_PASSWORD')
        db_host = os.getenv('DB_HOST', '127.0.0.1')
        db_port = os.getenv('DB_PORT', '3306')
        db_name = os.getenv('DB_NAME', 'oj_system')
        db_uri = f'mysql+pymysql://{quote_plus(db_user)}:{quote_plus(db_pass)}@{db_host}:{db_port}/{db_name}?charset=utf8mb4&auth_plugin=mysql_native_password'
    else:
        # 否则使用SQLite数据库
        db_path = os.path.join(os.path.dirname(os.path.dirname(current_dir)), 'judger.db')
        db_uri = f"sqlite:///{db_path}"
        print(f"使用SQLite数据库: {db_path}")
app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
app.config['JWT_SECRET_KEY'] = 'your-jwt-secret-key-here'  # JWT密钥
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', 'your-deepseek-api-key-here')
DEEPSEEK_API_BASE = os.getenv('DEEPSEEK_API_BASE', 'https://api.deepseek.com/v1')  # DeepSeek API端点

# AI 请求配置
AI_REQUEST_TIMEOUT = int(os.getenv('AI_REQUEST_TIMEOUT', '60'))  # 默认超时 60s
USE_MOCK_AI_FLAG = os.getenv('USE_MOCK_AI', 'false').lower() == 'true'
USE_MOCK_AI_ON_ERROR = os.getenv('USE_MOCK_AI_ON_ERROR', 'true').lower() == 'true'

CORS(app)
db.init_app(app)

# RabbitMQ连接
RABBITMQ_HOST = 'localhost'
RABBITMQ_PORT = 5673  # 修复：使用正确的RabbitMQ端口
QUEUE_NAME = 'judge_queue'

def create_rabbitmq_channel():
    connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_HOST, RABBITMQ_PORT))
    return connection.channel()

# ============ AI 题目生成相关函数 ============
def call_ai_model(prompt, max_tokens=2000):
    """直接调用DeepSeek API生成内容"""
    # 检查是否启用模拟模式
    if USE_MOCK_AI_FLAG:
        return _mock_ai_response(prompt)
    
    try:
        url = f"{DEEPSEEK_API_BASE}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }
        
        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "你是一个专业的编程题目生成助手，能够根据用户需求生成高质量的编程题目。请用中文回答，并严格按照指定格式输出。"},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7,
            "stream": False
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=AI_REQUEST_TIMEOUT)
        
        if response.status_code != 200:
            # 如果是余额不足错误，提供友好提示
            if "Insufficient Balance" in response.text:
                raise Exception("DeepSeek账户余额不足，请充值后重试。临时可设置 USE_MOCK_AI=true 使用模拟模式测试。")
            raise Exception(f"API请求失败，状态码: {response.status_code}, 响应: {response.text}")
        
        result = response.json()
        
        if 'error' in result:
            if result['error'].get('message') == 'Insufficient Balance':
                raise Exception("DeepSeek账户余额不足，请充值后重试。临时可设置 USE_MOCK_AI=true 使用模拟模式测试。")
            raise Exception(f"API错误: {result['error'].get('message', '未知错误')}")
        
        if 'choices' not in result or len(result['choices']) == 0:
            raise Exception(f"API返回格式错误: {result}")
            
        return result['choices'][0]['message']['content'].strip()
        
    except requests.exceptions.Timeout:
        # 请求超时回退到模拟模式（可通过环境变量关闭）
        if USE_MOCK_AI_ON_ERROR:
            return _mock_ai_response(prompt)
        raise Exception("网络请求超时")
    except requests.exceptions.ConnectionError as e:
        # 连接错误回退到模拟模式（可通过环境变量关闭）
        if USE_MOCK_AI_ON_ERROR:
            return _mock_ai_response(prompt)
        raise Exception(f"网络连接失败: {str(e)}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"网络请求失败: {str(e)}")
    except json.JSONDecodeError as e:
        raise Exception(f"JSON解析失败: {str(e)}")
    except Exception as e:
        # 其他异常也尝试回退（例如未知API错误）
        if USE_MOCK_AI_ON_ERROR:
            return _mock_ai_response(prompt)
        raise Exception(f"DeepSeek模型调用失败: {str(e)}")

def _mock_ai_response(prompt):
    """模拟AI响应，用于测试"""
    if "数组排序" in prompt or "排序" in prompt:
        return """题目名称：数组排序

题目描述：给定一个整数数组，请将其按升序排列。

输入格式：
第一行包含一个整数n，表示数组长度
第二行包含n个整数，表示数组元素

输出格式：
输出排序后的数组，元素间用空格分隔

测试用例：
输入1：
3
3 1 2
输出1：
1 2 3

输入2：
5
5 2 8 1 9
输出2：
1 2 5 8 9

输入3：
1
42
输出3：
42

预期输出：1 2 3
1 2 5 8 9
42

难度：easy"""
    else:
        return """题目名称：字符串反转

题目描述：给定一个字符串，请将其反转后输出。

输入格式：
一行包含一个字符串

输出格式：
输出反转后的字符串

测试用例：
输入1：
hello
输出1：
olleh

输入2：
world
输出2：
dlrow

预期输出：olleh
dlrow

难度：easy"""

def parse_ai_generated_problem(ai_response):
    """解析AI生成的题目内容"""
    try:
        # 使用正则表达式解析AI返回的结构化内容
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
            'difficulty': difficulty_match.group(1).strip().lower() if difficulty_match else 'easy'
        }
    except Exception as e:
        raise Exception(f"解析AI生成内容失败: {str(e)}")

def generate_problem_prompt(requirements):
    """生成题目生成的提示词"""
    base_prompt = """请根据以下需求生成一个编程题目，要求格式如下：

题目名称：[题目的简洁名称]

题目描述：[详细的题目描述，包括问题背景、输入输出格式说明]

测试用例：[提供3-5个测试用例，每个用例包含输入和输出，格式为：
输入1：[具体输入]
输出1：[具体输出]
输入2：[具体输入]
输出2：[具体输出]
...]

预期输出：[对于给定测试用例的完整预期输出]

难度：[easy/medium/hard]

用户需求："""
    
    return base_prompt + requirements

def validate_problem_with_ai(problem_data):
    """使用AI验证题目信息的完整性和正确性"""
    validation_prompt = f"""请检查以下编程题目信息是否完整、正确和合理：

题目名称：{problem_data.get('title', '')}
题目描述：{problem_data.get('description', '')}
测试用例：{problem_data.get('test_cases', '')}
预期输出：{problem_data.get('expected_output', '')}
难度：{problem_data.get('difficulty', '')}

请从以下几个方面进行检查：
1. 题目描述是否清晰完整
2. 测试用例是否覆盖了主要情况
3. 预期输出是否与测试用例匹配
4. 难度设置是否合理
5. 是否存在逻辑错误或矛盾

如果有问题，请指出具体问题和建议的修改方案。如果没有问题，请回复"验证通过"。"""
    
    try:
        return call_ai_model(validation_prompt, max_tokens=1000)
    except Exception as e:
        return f"验证失败: {str(e)}"
# ============ AI 题目生成相关函数 End ============

# ============ 测试辅助：无需登录的判题接口 ============
def ensure_test_user():
    """确保存在一个测试学生用户，返回其对象"""
    user = User.query.filter_by(username='test_student').first()
    if not user:
        user = User(
            username='test_student',
            name='Test Student',
            role='student',
            email=None,
            phone=None,
            is_active=True
        )
        try:
            # 可选设置密码
            user.set_password('test123')
        except Exception:
            pass
        db.session.add(user)
        db.session.commit()
    return user

# JWT测试端点
@app.route('/test/jwt', methods=['POST'])
def test_jwt():
    """测试JWT令牌验证"""
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': '缺少认证令牌'}), 401
    
    try:
        token = token.split(' ')[1]
        print(f"Debug: 测试JWT令牌: {token[:20]}...")
        print(f"Debug: JWT密钥: {app.config['JWT_SECRET_KEY']}")
        
        data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        print(f"Debug: JWT解码成功: {data}")
        
        return jsonify({
            'success': True,
            'decoded': data,
            'message': 'JWT验证成功'
        }), 200
        
    except Exception as e:
        print(f"Debug: JWT验证失败: {str(e)}")
        return jsonify({'error': f'JWT验证失败: {str(e)}'}), 401

@app.route('/test/problems', methods=['POST'])
def test_create_problem():
    """无需认证创建题目，便于本地测试判题流程"""
    data = request.json or {}
    required_fields = ['title', 'description', 'test_cases', 'expected_output']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400

    creator = ensure_test_user()
    try:
        problem = Problem(
            title=data['title'],
            description=data['description'],
            test_cases=data['test_cases'],
            expected_output=data['expected_output'],
            difficulty=data.get('difficulty', 'easy'),
            time_limit=data.get('time_limit', 1000),
            memory_limit=data.get('memory_limit', 128),
            created_by=creator.id,
            is_active=True
        )
        db.session.add(problem)
        db.session.commit()
        return jsonify(problem.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/test/submit', methods=['POST'])
def test_submit_code():
    """无需认证提交代码到判题队列，便于本地测试"""
    data = request.json or {}
    problem_id = data.get('problem_id')
    code = data.get('code')
    language = data.get('language', 'python')
    if not problem_id or not code:
        return jsonify({'error': 'problem_id 与 code 为必填'}), 400

    problem = Problem.query.get(problem_id)
    if not problem or not problem.is_active:
        return jsonify({'error': '题目不存在或未激活'}), 404

    test_user = ensure_test_user()
    submission = Submission(
        user_id=test_user.id,
        problem_id=problem_id,
        code=code,
        language=language,
        status='pending'
    )
    db.session.add(submission)
    db.session.commit()

    try:
        channel = create_rabbitmq_channel()
        channel.queue_declare(queue=QUEUE_NAME, durable=True)
        message = {
            'submission_id': submission.id,
            'problem_id': problem_id,
            'code': code,
            'language': language
        }
        channel.basic_publish(
            exchange='',
            routing_key=QUEUE_NAME,
            body=json.dumps(message),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        return jsonify({
            'submission_id': submission.id,
            'status': 'pending',
            'message': '判题任务已提交(测试)'
        }), 202
    except Exception as e:
        submission.status = 'failed'
        db.session.commit()
        return jsonify({'error': str(e)}), 500

@app.route('/test/result/<int:submission_id>', methods=['GET'])
def test_get_result(submission_id):
    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({'error': '提交记录不存在'}), 404
    return jsonify(submission.to_dict()), 200
# ============ 测试辅助 End ============

# JWT认证装饰器
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': '缺少认证令牌'}), 401
        
        try:
            token = token.split(' ')[1]  # Bearer token
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'error': '用户不存在'}), 401
        except:
            return jsonify({'error': '无效的认证令牌'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

# 教师权限装饰器
def teacher_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': '缺少认证令牌'}), 401
        
        try:
            token = token.split(' ')[1]
            print(f"Debug: 验证令牌: {token[:20]}...")  # 调试信息
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            print(f"Debug: 解码成功，用户ID: {data.get('user_id')}, 角色: {data.get('role')}")  # 调试信息
            current_user = User.query.get(data['user_id'])
            if not current_user:
                print(f"Debug: 用户不存在，ID: {data.get('user_id')}")  # 调试信息
                return jsonify({'error': '用户不存在'}), 401
            if current_user.role not in ['teacher', 'admin']:
                print(f"Debug: 权限不足，用户角色: {current_user.role}")  # 调试信息
                return jsonify({'error': '权限不足'}), 403
            print(f"Debug: 认证成功，用户: {current_user.username}")  # 调试信息
        except Exception as e:
            print(f"Debug: JWT验证失败: {str(e)}")  # 调试信息
            return jsonify({'error': '无效的认证令牌'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': '缺少认证令牌'}), 401
        try:
            token = token.split(' ')[1]
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user or current_user.role != 'admin':
                return jsonify({'error': '权限不足（需要管理员）'}), 403
        except:
            return jsonify({'error': '无效的认证令牌'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# 教师创建学生账号（取代公开注册）
@app.route('/auth/register/student', methods=['POST'])
@teacher_required
def register_student(current_user):
    data = request.json or {}
    # 学号、姓名、密码 必填；班级/专业/学校 可选
    required_fields = ['student_no', 'name', 'password']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'缺少必填字段: {field}'}), 400

    # 学生统一使用学号作为登录用户名，系统内部仍用 username 字段存储
    username = str(data['student_no']).strip()

    # 检查用户名(学号)是否已存在
    if User.query.filter_by(username=username).first():
        return jsonify({'error': '该学号已存在'}), 400

    # 检查邮箱是否已存在（如果提供）
    if data.get('email') and User.query.filter_by(email=data['email']).first():
        return jsonify({'error': '邮箱已存在'}), 400

    try:
        # 处理可选字段，空字符串设为None
        email = data.get('email')
        if email == '':
            email = None
            
        phone = data.get('phone')
        if phone == '':
            phone = None
            
        class_id = data.get('class_id')
        if class_id == '':
            class_id = None
            
        major_id = data.get('major_id')
        if major_id == '':
            major_id = None
            
        school_id = data.get('school_id')
        if school_id == '':
            school_id = None
            
        user = User(
            username=username,
            name=data['name'],
            email=email,
            phone=phone,
            role='student',
            class_id=class_id,
            major_id=major_id,
            school_id=school_id
        )
        user.set_password(data['password'])

        db.session.add(user)
        db.session.commit()

        return jsonify({'message': '学生账号创建成功', 'user_id': user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 管理员创建教师账号
@app.route('/auth/register/teacher', methods=['POST'])
@admin_required
def register_teacher(current_user):
    data = request.json or {}
    # 工号、姓名、密码、学校、院部 必填
    required_fields = ['job_no', 'name', 'password', 'school_id', 'department_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'缺少必填字段: {field}'}), 400

    username = str(data['job_no']).strip()
    if User.query.filter_by(username=username).first():
        return jsonify({'error': '该工号已存在'}), 400

    try:
        # 处理可选字段，空字符串设为None
        email = data.get('email')
        if email == '':
            email = None
            
        phone = data.get('phone')
        if phone == '':
            phone = None
            
        user = User(
            username=username,
            name=data['name'],
            role='teacher',
            school_id=data['school_id'],
            department_id=data['department_id'],
            class_id=None,
            email=email,
            phone=phone,
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        return jsonify({'message': '教师账号创建成功', 'user_id': user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# 密码找回
@app.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    phone = data.get('phone')
    
    if not email and not phone:
        return jsonify({'error': '请提供邮箱或手机号'}), 400
    
    # 查找用户
    if email:
        user = User.query.filter_by(email=email).first()
    else:
        user = User.query.filter_by(phone=phone).first()
    
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    
    # 这里应该发送重置密码的邮件或短信
    # 为了演示，我们直接返回成功消息
    return jsonify({'message': '重置密码链接已发送到您的邮箱/手机'}), 200

# 重置密码
@app.route('/auth/reset-password', methods=['POST'])
@token_required
def reset_password(current_user):
    data = request.json
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        return jsonify({'error': '旧密码和新密码不能为空'}), 400
    
    if not current_user.check_password(old_password):
        return jsonify({'error': '旧密码错误'}), 400
    
    current_user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': '密码修改成功'}), 200

# 用户登录
@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401
    
    if not user.is_active:
        return jsonify({'error': '账户已被禁用'}), 403
    
    # 生成JWT令牌
    token = jwt.encode(
        {
            'user_id': user.id,
            'username': user.username,
            'role': user.role,
            'exp': datetime.now(timezone.utc) + app.config['JWT_ACCESS_TOKEN_EXPIRES']
        },
        app.config['JWT_SECRET_KEY'],
        algorithm='HS256'
    )
    
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200

# 管理员自助注册（仅创建管理员账户，可根据需要限制条件）
@app.route('/auth/register/admin', methods=['POST'])
def register_admin():
    data = request.json or {}
    required_fields = ['username', 'name', 'password']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'缺少必填字段: {field}'}), 400

    # 若已存在管理员，这里可选择禁止再次自助注册（简单安全策略）
    # 仅允许管理员角色自助注册（开放多管理员）

    # 检查用户名是否已存在
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': '用户名已存在'}), 400

    try:
        # 处理可选字段，空字符串设为None
        email = data.get('email')
        if email == '':
            email = None
            
        phone = data.get('phone')
        if phone == '':
            phone = None
            
        # 处理school_name和major_name字段
        # 根据名称查找或创建对应的学校、院部记录
        
        school_id = None
        school_name = data.get('school_name')
        if school_name and school_name.strip():
            from models.user import SchoolModel
            existing_school = SchoolModel.query.filter_by(name=school_name.strip()).first()
            if existing_school:
                school_id = existing_school.id
            else:
                # 创建新的学校记录
                new_school = SchoolModel(name=school_name.strip())
                db.session.add(new_school)
                db.session.flush()  # 获取ID但不提交
                school_id = new_school.id
                
        major_id = None
        major_name = data.get('major_name')
        if major_name and major_name.strip():
            from models.user import MajorModel
            existing_major = MajorModel.query.filter_by(name=major_name.strip()).first()
            if existing_major:
                major_id = existing_major.id
            else:
                # 创建新的院部记录
                new_major = MajorModel(name=major_name.strip(), school_id=school_id)
                db.session.add(new_major)
                db.session.flush()  # 获取ID但不提交
                major_id = new_major.id
            
        user = User(
            username=data['username'],
            name=data['name'],
            role='admin',
            email=email,
            phone=phone,
            school_id=school_id,
            major_id=major_id
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        return jsonify({'message': '管理员注册成功', 'user_id': user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 获取题目列表
@app.route('/problems', methods=['GET'])
def get_problems():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    difficulty = request.args.get('difficulty')
    
    query = Problem.query.filter_by(is_active=True)
    
    if difficulty:
        query = query.filter_by(difficulty=difficulty)
    
    problems = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'problems': [problem.to_dict() for problem in problems.items],
        'total': problems.total,
        'pages': problems.pages,
        'current_page': page
    }), 200

# 获取题目详情
@app.route('/problems/<int:problem_id>', methods=['GET'])
def get_problem(problem_id):
    problem = Problem.query.get(problem_id)
    if not problem or not problem.is_active:
        return jsonify({'error': '题目不存在'}), 404
    return jsonify(problem.to_dict())

# 创建题目（需要教师权限）
@app.route('/problems', methods=['POST'])
@teacher_required
def create_problem(current_user):
    data = request.json
    required_fields = ['title', 'description', 'type']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    # 根据题目类型验证必填字段
    if data['type'] == 'programming':
        programming_fields = ['test_cases', 'expected_output']
        for field in programming_fields:
            if field not in data:
                return jsonify({'error': f'编程题缺少必填字段: {field}'}), 400
    elif data['type'] == 'choice':
        choice_fields = ['choice_options', 'expected_output']
        for field in choice_fields:
            if field not in data:
                return jsonify({'error': f'选择题缺少必填字段: {field}'}), 400
    
    try:
        problem = Problem(
            title=data['title'],
            description=data['description'],
            type=data['type'],
            test_cases=data.get('test_cases', ''),
            expected_output=data.get('expected_output', ''),
            choice_options=data.get('choice_options', ''),
            is_multiple_choice=data.get('is_multiple_choice', False),
            difficulty=data.get('difficulty', 'easy'),
            time_limit=data.get('time_limit', 1000),
            memory_limit=data.get('memory_limit', 128),
            created_by=current_user.id
        )
        
        db.session.add(problem)
        db.session.commit()
        
        return jsonify(problem.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 更新题目（需要教师权限）
@app.route('/problems/<int:problem_id>', methods=['PUT'])
@teacher_required
def update_problem(current_user, problem_id):
    problem = Problem.query.get(problem_id)
    if not problem:
        return jsonify({'error': '题目不存在'}), 404
    
    # 检查权限：只能更新自己创建的题目
    if problem.created_by != current_user.id and current_user.role != 'admin':
        return jsonify({'error': '只能更新自己创建的题目'}), 403
    
    data = request.json
    allowed_fields = ['title', 'description', 'type', 'test_cases', 'expected_output', 'choice_options', 'is_multiple_choice', 'difficulty', 'time_limit', 'memory_limit', 'is_active']
    
    for field in allowed_fields:
        if field in data:
            setattr(problem, field, data[field])
    
    try:
        db.session.commit()
        return jsonify({'message': '题目更新成功', 'problem': problem.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 删除题目（需要教师权限）
@app.route('/problems/<int:problem_id>', methods=['DELETE'])
@teacher_required
def delete_problem(current_user, problem_id):
    problem = Problem.query.get(problem_id)
    if not problem:
        return jsonify({'error': '题目不存在'}), 404
    
    # 检查权限：只能删除自己创建的题目
    if problem.created_by != current_user.id and current_user.role != 'admin':
        return jsonify({'error': '只能删除自己创建的题目'}), 403
    
    try:
        db.session.delete(problem)
        db.session.commit()
        return jsonify({'message': '题目删除成功'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ============ AI 智能生成题目相关API ============

# AI生成题目测试端点（无需认证）
@app.route('/test/ai-generate', methods=['POST'])
def test_ai_generate_problem():
    """测试AI生题功能，无需认证"""
    data = request.json
    requirements = data.get('requirements', '')
    
    if not requirements:
        return jsonify({'error': '请提供生题需求'}), 400
    
    try:
        # 生成提示词
        prompt = generate_problem_prompt(requirements)
        
        # 调用AI模型
        ai_response = call_ai_model(prompt)
        
        # 解析AI返回的内容
        parsed_problem = parse_ai_generated_problem(ai_response)
        
        # 添加生成信息
        parsed_problem['ai_generated'] = True
        parsed_problem['original_requirements'] = requirements
        parsed_problem['ai_raw_response'] = ai_response
        parsed_problem['generated_at'] = datetime.now(timezone.utc).isoformat()
        
        return jsonify({
            'success': True,
            'problem': parsed_problem,
            'message': '题目生成成功，请审阅并修改'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'生成题目失败: {str(e)}'}), 500

# AI生成题目
@app.route('/problems/ai-generate', methods=['POST'])
@teacher_required
def ai_generate_problem(current_user):
    """根据用户需求使用AI生成题目"""
    data = request.json
    requirements = data.get('requirements', '')
    
    if not requirements:
        return jsonify({'error': '请提供生题需求'}), 400
    
    try:
        # 生成提示词
        prompt = generate_problem_prompt(requirements)
        
        # 调用AI模型
        ai_response = call_ai_model(prompt)
        
        # 解析AI返回的内容
        parsed_problem = parse_ai_generated_problem(ai_response)
        
        # 添加生成信息
        parsed_problem['ai_generated'] = True
        parsed_problem['original_requirements'] = requirements
        parsed_problem['ai_raw_response'] = ai_response
        parsed_problem['generated_at'] = datetime.now(timezone.utc).isoformat()
        
        return jsonify({
            'success': True,
            'problem': parsed_problem,
            'message': '题目生成成功，请审阅并修改'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'生成题目失败: {str(e)}'}), 500

# 预览和修改AI生成的题目
@app.route('/problems/ai-preview', methods=['POST'])
@teacher_required
def ai_preview_problem(current_user):
    """预览AI生成的题目，支持教师修改"""
    data = request.json
    
    # 验证必要字段
    required_fields = ['title', 'description', 'test_cases', 'expected_output']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    try:
        # 构建题目预览数据
        preview_data = {
            'title': data['title'],
            'description': data['description'],
            'test_cases': data['test_cases'],
            'expected_output': data['expected_output'],
            'difficulty': data.get('difficulty', 'easy'),
            'time_limit': data.get('time_limit', 1000),
            'memory_limit': data.get('memory_limit', 128),
            'ai_generated': data.get('ai_generated', False),
            'original_requirements': data.get('original_requirements', ''),
                         'modified_at': datetime.now(timezone.utc).isoformat()
        }
        
        return jsonify({
            'success': True,
            'preview': preview_data,
            'message': '题目预览成功'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'预览失败: {str(e)}'}), 500

# AI验证并确认题目
@app.route('/problems/ai-validate', methods=['POST'])
@teacher_required
def ai_validate_and_create_problem(current_user):
    """使用AI验证题目信息的正确性，然后创建题目"""
    data = request.json
    
    # 验证必要字段
    required_fields = ['title', 'description', 'test_cases', 'expected_output']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    try:
        # 使用AI验证题目
        validation_result = validate_problem_with_ai(data)
        
        # 如果用户选择跳过验证或验证通过，则创建题目
        skip_validation = data.get('skip_validation', False)
        force_create = data.get('force_create', False)
        
        if skip_validation or force_create or "验证通过" in validation_result:
            # 创建题目
            problem = Problem(
                title=data['title'],
                description=data['description'],
                test_cases=data['test_cases'],
                expected_output=data['expected_output'],
                difficulty=data.get('difficulty', 'easy'),
                time_limit=data.get('time_limit', 1000),
                memory_limit=data.get('memory_limit', 128),
                created_by=current_user.id
            )
            
            db.session.add(problem)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'problem': problem.to_dict(),
                'validation_result': validation_result,
                'message': '题目创建成功'
            }), 201
        else:
            # 验证未通过，返回验证结果供用户参考
            return jsonify({
                'success': False,
                'validation_result': validation_result,
                'message': 'AI验证发现问题，请根据建议修改后重新提交',
                'can_force_create': True  # 允许用户强制创建
            }), 400
            
    except Exception as e:
        return jsonify({'error': f'验证或创建失败: {str(e)}'}), 500

# 获取AI生成历史（可选功能）
@app.route('/problems/ai-history', methods=['GET'])
@teacher_required
def get_ai_generation_history(current_user):
    """获取该教师的AI生成题目历史（如果需要存储的话）"""
    # 这里可以添加存储AI生成历史的逻辑
    # 目前返回空列表，可以根据需要扩展
    return jsonify({
        'history': [],
        'message': '暂无AI生成历史记录'
    }), 200

# ============ AI 智能生成题目相关API End ============

# 获取学校列表
@app.route('/schools', methods=['GET'])
def get_schools():
    schools = SchoolModel.query.all()
    return jsonify([school.to_dict() for school in schools])

# 获取院部列表
@app.route('/departments', methods=['GET'])
def get_departments():
    school_id = request.args.get('school_id', type=int)
    query = DepartmentModel.query
    
    if school_id:
        query = query.filter_by(school_id=school_id)
    
    departments = query.all()
    return jsonify([department.to_dict() for department in departments])

# 获取专业列表
@app.route('/majors', methods=['GET'])
def get_majors():
    school_id = request.args.get('school_id', type=int)
    query = MajorModel.query
    
    if school_id:
        query = query.filter_by(school_id=school_id)
    
    majors = query.all()
    return jsonify([major.to_dict() for major in majors])

# 获取班级列表
@app.route('/classes', methods=['GET'])
def get_classes():
    major_id = request.args.get('major_id', type=int)
    query = ClassModel.query
    
    if major_id:
        query = query.filter_by(major_id=major_id)
    
    classes = query.all()
    return jsonify([cls.to_dict() for cls in classes])

# 批量导入学生
@app.route('/users/batch-import', methods=['POST'])
@teacher_required
def batch_import_students(current_user):
    data = request.json
    students_data = data.get('students', [])
    
    if not students_data:
        return jsonify({'error': '学生数据不能为空'}), 400
    
    success_count = 0
    failed_count = 0
    errors = []
    
    for student_data in students_data:
        try:
            # 检查必填字段
            required_fields = ['username', 'password', 'name']
            for field in required_fields:
                if field not in student_data:
                    errors.append(f'学生 {student_data.get("name", "未知")}: 缺少字段 {field}')
                    failed_count += 1
                    continue
            
            # 检查用户名是否已存在
            if User.query.filter_by(username=student_data['username']).first():
                errors.append(f'学生 {student_data["name"]}: 用户名已存在')
                failed_count += 1
                continue
            
            # 创建学生用户
            student = User(
                username=student_data['username'],
                name=student_data['name'],
                email=student_data.get('email'),
                phone=student_data.get('phone'),
                role='student',
                class_id=student_data.get('class_id'),
                major_id=student_data.get('major_id'),
                school_id=student_data.get('school_id')
            )
            student.set_password(student_data['password'])
            
            db.session.add(student)
            success_count += 1
            
        except Exception as e:
            errors.append(f'学生 {student_data.get("name", "未知")}: {str(e)}')
            failed_count += 1
    
    try:
        db.session.commit()
        return jsonify({
            'message': f'批量导入完成: 成功 {success_count} 个, 失败 {failed_count} 个',
            'success_count': success_count,
            'failed_count': failed_count,
            'errors': errors
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'保存失败: {str(e)}'}), 500

# 批量导入学生（从Excel文件）
@app.route('/users/batch-import-excel', methods=['POST'])
@teacher_required
def batch_import_students_from_excel(current_user):
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        # 检查文件类型
        allowed_extensions = {'.xlsx', '.xls', '.csv'}
        file_ext = '.' + file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
        if file_ext not in allowed_extensions:
            return jsonify({'error': f'不支持的文件格式。支持格式: {", ".join(allowed_extensions)}'}), 400
        
        # 获取表单数据
        school_id = request.form.get('school_id')
        department_id = request.form.get('department_id')
        major_id = request.form.get('major_id')
        class_id = request.form.get('class_id')
        
        if not all([school_id, department_id, major_id, class_id]):
            return jsonify({'error': '请提供完整的学校、院部、专业、班级信息'}), 400
        
        # 读取Excel文件
        import openpyxl
        from io import BytesIO
        
        if file_ext in {'.xlsx', '.xls'}:
            # 读取Excel文件
            workbook = openpyxl.load_workbook(BytesIO(file.read()))
            worksheet = workbook.active
            
            # 获取数据行
            students_data = []
            for row in worksheet.iter_rows(min_row=2, values_only=True):  # 跳过标题行
                if row[0] and row[1] and row[2]:  # 学号、姓名、密码都不为空
                    students_data.append({
                        'username': str(row[0]).strip(),
                        'name': str(row[1]).strip(),
                        'password': str(row[2]).strip()
                    })
        else:
            # 处理CSV文件
            import csv
            from io import StringIO
            
            content = file.read().decode('utf-8')
            csv_reader = csv.reader(StringIO(content))
            next(csv_reader)  # 跳过标题行
            
            students_data = []
            for row in csv_reader:
                if len(row) >= 3 and row[0] and row[1] and row[2]:
                    students_data.append({
                        'username': row[0].strip(),
                        'name': row[1].strip(),
                        'password': row[2].strip()
                    })
        
        if not students_data:
            return jsonify({'error': 'Excel文件中没有有效的学生数据'}), 400
        
        success_count = 0
        failed_count = 0
        errors = []
        
        # 处理每个学生数据
        for student_data in students_data:
            try:
                # 检查用户名是否已存在
                if User.query.filter_by(username=student_data['username']).first():
                    errors.append(f'学生 {student_data["name"]}: 学号 {student_data["username"]} 已存在')
                    failed_count += 1
                    continue
                
                # 创建学生用户
                student = User(
                    username=student_data['username'],
                    name=student_data['name'],
                    role='student',
                    school_id=school_id,
                    department_id=department_id,
                    major_id=major_id,
                    class_id=class_id
                )
                student.set_password(student_data['password'])
                
                db.session.add(student)
                success_count += 1
                
            except Exception as e:
                errors.append(f'学生 {student_data.get("name", "未知")}: {str(e)}')
                failed_count += 1
        
        # 提交事务
        db.session.commit()
        
        return jsonify({
            'message': f'批量导入完成: 成功 {success_count} 个, 失败 {failed_count} 个',
            'success_count': success_count,
            'failed_count': failed_count,
            'errors': errors
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

# 获取用户列表（教师权限）
@app.route('/users', methods=['GET'])
@teacher_required
def get_users(current_user):
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    role = request.args.get('role')
    class_id = request.args.get('class_id', type=int)
    username = request.args.get('username')  # 支持按学号(用户名)搜索
    name = request.args.get('name')  # 支持按姓名搜索
    
    query = User.query
    
    if role:
        query = query.filter_by(role=role)
    if class_id:
        query = query.filter_by(class_id=class_id)
    if username:
        query = query.filter(User.username == username)
    if name:
        query = query.filter(User.name.like(f"%{name}%"))
    
    users = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'users': [user.to_dict(include_relations=True) for user in users.items],
        'total': users.total,
        'pages': users.pages,
        'current_page': page
    }), 200

# 更新用户信息
@app.route('/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    
    data = request.json
    
    # 权限：
    # - 管理员：可更新任意教师/学生的 email/phone/class_id/department_id/school_id/is_active；不可改 username/name
    # - 教师：可更新学生的 email/phone/class_id/department_id/school_id/is_active；不可改 username/name
    # - 学生本人：可更新 email/phone/class_id/department_id/school_id；可修改密码；不可改 username/name/is_active
    if current_user.role == 'admin':
        allowed_fields = ['email', 'phone', 'class_id', 'department_id', 'school_id', 'is_active']
        for field in allowed_fields:
            if field in data:
                # 处理空字符串，设为None
                value = data[field]
                if value == '':
                    value = None
                setattr(user, field, value)
        if 'new_password' in data and data['new_password']:
            user.set_password(data['new_password'])
    elif current_user.role == 'teacher':
        allowed_fields = ['email', 'phone', 'class_id', 'department_id', 'school_id', 'is_active']
        for field in allowed_fields:
            if field in data:
                # 处理空字符串，设为None
                value = data[field]
                if value == '':
                    value = None
                setattr(user, field, value)
        if 'new_password' in data and data['new_password']:
            user.set_password(data['new_password'])
    else:
        # 学生：只能修改自己的信息
        if current_user.id != user.id:
            return jsonify({'error': '权限不足'}), 403
        allowed_fields = ['email', 'phone', 'class_id', 'department_id', 'school_id']
        for field in allowed_fields:
            if field in data:
                # 处理空字符串，设为None
                value = data[field]
                if value == '':
                    value = None
                setattr(user, field, value)
        if 'new_password' in data and data['new_password']:
            user.set_password(data['new_password'])
    
    try:
        db.session.commit()
        return jsonify({'message': '用户信息更新成功', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 删除用户
@app.route('/users/<int:user_id>', methods=['DELETE'])
@teacher_required
def delete_user(current_user, user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    
    if user.role == 'admin':
        return jsonify({'error': '不能删除管理员账户'}), 403
    
    try:
        # 如果是教师，需要先处理相关的课程
        if user.role == 'teacher':
            # 导入所有需要的模型类
            from models.course_student import Course, CourseStudent
            from models.assignment import Assignment, AssignmentProblem
            
            # 查找该教师的所有课程
            teacher_courses = Course.query.filter_by(teacher_id=user_id).all()
            
            if teacher_courses:
                print(f"开始删除教师 {user.username} 的 {len(teacher_courses)} 门课程")
                
                for course in teacher_courses:
                    course_id = course.id
                    print(f"删除课程 {course.name} (ID: {course_id})")
                    
                    # 1. 先删除作业题目关联 (assignment_problems)
                    # 获取该课程的所有作业ID
                    course_assignment_ids = [a.id for a in Assignment.query.filter_by(course_id=course_id).all()]
                    if course_assignment_ids:
                        assignment_problems = AssignmentProblem.query.filter(
                            AssignmentProblem.assignment_id.in_(course_assignment_ids)
                        ).all()
                        for ap in assignment_problems:
                            db.session.delete(ap)
                            print(f"删除作业题目关联 {ap.id}")
                    
                    # 2. 删除作业 (assignments)
                    assignments = Assignment.query.filter_by(course_id=course_id).all()
                    for assignment in assignments:
                        print(f"删除作业 {assignment.name} (ID: {assignment.id})")
                        db.session.delete(assignment)
                    
                    # 3. 删除课程学生关联 (course_students)
                    course_students = CourseStudent.query.filter_by(course_id=course_id).all()
                    for cs in course_students:
                        print(f"删除课程学生关联 {cs.id}")
                        db.session.delete(cs)
                    
                    # 4. 最后删除课程本身
                    print(f"删除课程 {course.name}")
                    db.session.delete(course)
                
                # 提交所有删除操作
                db.session.commit()
                print(f"成功删除教师 {user.username} 的所有相关数据")
        
        # 删除用户
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': '用户删除成功'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"删除用户失败: {str(e)}")
        return jsonify({'error': f'删除用户失败: {str(e)}'}), 500

#接收用户代码提交，创建Submission记录并发送判题任务到 RabbitMQ 队列。
# 提交成功后返回提交记录 ID 和状态，失败则返回错误信息。
@app.route('/submit', methods=['POST'])
@token_required
def submit_code(current_user):
    data = request.json
    problem_id = data['problem_id']
    code = data['code']
    language = data['language']
    
    # 检查题目是否存在
    problem = Problem.query.get(problem_id)
    if not problem or not problem.is_active:
        return jsonify({'error': '题目不存在'}), 404
    
    # 创建提交记录
    submission = Submission(
        user_id=current_user.id,
        problem_id=problem_id,
        code=code,
        language=language,
        status='pending'
    )
    db.session.add(submission)
    db.session.commit()
    
    # 尝试发送判题任务到消息队列
    rabbitmq_success = False
    try:
        channel = create_rabbitmq_channel()
        channel.queue_declare(queue=QUEUE_NAME, durable=True)
        message = {
            'submission_id': submission.id,
            'problem_id': problem_id,
            'code': code,
            'language': language
        }
        channel.basic_publish(
            exchange='',
            routing_key=QUEUE_NAME,
            body=json.dumps(message),
            properties=pika.BasicProperties(delivery_mode=2)  # 持久化
        )
        rabbitmq_success = True
        channel.close()
    except Exception as e:
        print(f"RabbitMQ连接失败: {str(e)}")
        # 不因RabbitMQ失败而让整个提交失败
        # 代码已保存到数据库，状态为pending
    
    if rabbitmq_success:
        return jsonify({
            'submission_id': submission.id,
            'status': 'pending',
            'message': '判题任务已提交到队列'
        }), 202
    else:
        return jsonify({
            'submission_id': submission.id,
            'status': 'pending',
            'message': '代码已提交，但判题队列暂时不可用，请稍后查看结果'
        }), 202

#查询指定提交的判题结果。
# 提交存在时返回提交信息，不存在则返回错误。
@app.route('/result/<int:submission_id>', methods=['GET'])
@token_required
def get_result(current_user, submission_id):
    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({'error': '提交记录不存在'}), 404
    
    # 检查权限：只能查看自己的提交或教师可以查看所有
    if submission.user_id != current_user.id and current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    return jsonify(submission.to_dict())

# 获取用户的提交历史
@app.route('/submissions', methods=['GET'])
@token_required
def get_submissions(current_user):
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    problem_id = request.args.get('problem_id', type=int)
    
    query = Submission.query
    
    # 学生只能查看自己的提交，教师可以查看所有
    if current_user.role == 'student':
        query = query.filter_by(user_id=current_user.id)
    
    if problem_id:
        query = query.filter_by(problem_id=problem_id)
    
    submissions = query.order_by(Submission.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'submissions': [submission.to_dict() for submission in submissions.items],
        'total': submissions.total,
        'pages': submissions.pages,
        'current_page': page
    }), 200

# ============ 课程管理相关API ============

# 获取课程列表
@app.route('/courses', methods=['GET'])
@token_required
def get_courses(current_user):
    # 根据用户角色过滤课程
    if current_user.role == 'teacher':
        # 教师只能看到自己的课程
        courses = Course.query.filter_by(teacher_id=current_user.id).all()
    elif current_user.role == 'admin':
        # 管理员可以看到所有课程
        courses = Course.query.all()
    else:
        return jsonify({'error': '权限不足'}), 403
    
    return jsonify({
        'courses': [course.to_dict() for course in courses]
    }), 200

# 获取所有课程（管理员权限）
@app.route('/courses/all', methods=['GET'])
@token_required
def get_all_courses(current_user):
    if current_user.role != 'admin':
        return jsonify({'error': '权限不足'}), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    # 分页查询所有课程
    courses = Course.query.paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'courses': [course.to_dict() for course in courses.items],
        'total': courses.total,
        'pages': courses.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

# 创建课程
@app.route('/courses', methods=['POST'])
@token_required
def create_course(current_user):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    data = request.get_json()
    required_fields = ['name', 'class_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    # 检查教学班是否存在
    class_info = ClassModel.query.get(data['class_id'])
    if not class_info:
        return jsonify({'error': '教学班不存在'}), 404
    
    # 确定教师ID
    if current_user.role == 'admin':
        # 管理员必须指定教师
        if not data.get('teacher_id'):
            return jsonify({'error': '管理员创建课程必须指定教师'}), 400
        
        # 检查指定的教师是否存在且是教师角色
        teacher = User.query.get(data['teacher_id'])
        if not teacher or teacher.role != 'teacher':
            return jsonify({'error': '指定的教师不存在或不是教师角色'}), 400
        
        teacher_id = data['teacher_id']
    else:
        # 教师创建课程时使用自己的ID
        teacher_id = current_user.id
    
    course = Course(
        name=data['name'],
        description=data.get('description', ''),
        teacher_id=teacher_id,
        class_id=data['class_id']
    )
    
    db.session.add(course)
    db.session.commit()
    
    return jsonify(course.to_dict()), 201

# 获取课程详情
@app.route('/courses/<int:course_id>', methods=['GET'])
@token_required
def get_course(current_user, course_id):
    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    
    # 检查权限：教师只能查看自己的课程，管理员可以查看所有
    if current_user.role == 'teacher' and course.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    return jsonify(course.to_dict()), 200

# 更新课程
@app.route('/courses/<int:course_id>', methods=['PUT'])
@token_required
def update_course(current_user, course_id):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    
    # 检查权限：教师只能更新自己的课程
    if current_user.role == 'teacher' and course.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    data = request.get_json()
    if 'name' in data:
        course.name = data['name']
    if 'description' in data:
        course.description = data['description']
    if 'class_id' in data:
        course.class_id = data['class_id']
    if 'teacher_id' in data:
        course.teacher_id = data['teacher_id']
    
    db.session.commit()
    return jsonify(course.to_dict()), 200

# 删除课程
@app.route('/courses/<int:course_id>', methods=['DELETE'])
@token_required
def delete_course(current_user, course_id):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    
    # 检查权限：教师只能删除自己的课程
    if current_user.role == 'teacher' and course.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    # 删除相关的学生-课程关联关系
    CourseStudent.query.filter_by(course_id=course_id).delete()
    
    db.session.delete(course)
    db.session.commit()
    
    return jsonify({'message': '课程删除成功'}), 200

# ============ 学生-课程关联关系管理API ============

# 获取课程的学生列表
@app.route('/courses/<int:course_id>/students', methods=['GET'])
@token_required
def get_course_students(current_user, course_id):
    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    
    # 检查权限：教师只能查看自己课程的学生，管理员可以查看所有
    if current_user.role == 'teacher' and course.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    # 获取该课程的所有学生
    course_students = CourseStudent.query.filter_by(course_id=course_id).all()
    
    return jsonify([cs.to_dict() for cs in course_students]), 200

# 添加学生到课程
@app.route('/courses/<int:course_id>/students', methods=['POST'])
@token_required
def add_student_to_course(current_user, course_id):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    
    # 检查权限：教师只能向自己的课程添加学生
    if current_user.role == 'teacher' and course.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    data = request.get_json()
    required_fields = ['student_id', 'class_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    # 检查学生是否已经在该课程中
    existing_enrollment = CourseStudent.query.filter_by(
        course_id=course_id,
        student_id=data['student_id']
    ).first()
    
    if existing_enrollment:
        return jsonify({'error': '该学生已经在该课程中'}), 400
    
    # 检查学生是否存在
    student = User.query.get(data['student_id'])
    if not student or student.role != 'student':
        return jsonify({'error': '学生不存在'}), 404
    
    # 创建学生-课程关联关系
    course_student = CourseStudent(
        course_id=course_id,
        student_id=data['student_id'],
        class_id=data['class_id']
    )
    
    db.session.add(course_student)
    db.session.commit()
    
    return jsonify(course_student.to_dict()), 201

# 从课程中移除学生
@app.route('/courses/<int:course_id>/students/<int:student_id>', methods=['DELETE'])
@token_required
def remove_student_from_course(current_user, course_id, student_id):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    
    # 检查权限：教师只能从自己的课程中移除学生
    if current_user.role == 'teacher' and course.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    # 查找并删除学生-课程关联关系
    course_student = CourseStudent.query.filter_by(
        course_id=course_id,
        student_id=student_id
    ).first()
    
    if not course_student:
        return jsonify({'error': '该学生不在该课程中'}), 404
    
    db.session.delete(course_student)
    db.session.commit()
    
    return jsonify({'message': '学生已从课程中移除'}), 200

# ============ 作业管理相关API ============

# 获取课程的作业列表
@app.route('/assignments', methods=['GET'])
@token_required
def get_assignments(current_user):
    course_id = request.args.get('course_id', type=int)
    
    if course_id:
        # 获取特定课程的作业
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': '课程不存在'}), 404
        
        # 检查权限：教师只能查看自己课程的作业，管理员可以查看所有
        if current_user.role == 'teacher' and course.teacher_id != current_user.id:
            return jsonify({'error': '权限不足'}), 403
        
        assignments = Assignment.query.filter_by(course_id=course_id).all()
    else:
        # 获取所有作业（根据用户角色过滤）
        if current_user.role == 'teacher':
            assignments = Assignment.query.filter_by(teacher_id=current_user.id).all()
        elif current_user.role == 'admin':
            assignments = Assignment.query.all()
        else:
            return jsonify({'error': '权限不足'}), 403
    
    # 获取每个作业的题目信息
    result = []
    for assignment in assignments:
        assignment_data = assignment.to_dict()
        # 获取作业包含的题目
        assignment_problems = AssignmentProblem.query.filter_by(assignment_id=assignment.id).all()
        assignment_data['problem_ids'] = [ap.problem_id for ap in assignment_problems]
        result.append(assignment_data)
    
    return jsonify({'assignments': result}), 200

# 创建作业
@app.route('/assignments', methods=['POST'])
@token_required
def create_assignment(current_user):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    data = request.get_json()
    required_fields = ['name', 'description', 'requirements', 'due_date', 'course_id']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    # 检查课程是否存在
    course = Course.query.get(data['course_id'])
    if not course:
        return jsonify({'error': '课程不存在'}), 404
    
    # 检查权限：教师只能为自己的课程创建作业
    if current_user.role == 'teacher' and course.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    try:
        # 创建作业
        assignment = Assignment(
            name=data['name'],
            description=data['description'],
            requirements=data['requirements'],
            due_date=datetime.fromisoformat(data['due_date']),
            course_id=data['course_id'],
            teacher_id=current_user.id
        )
        db.session.add(assignment)
        db.session.flush()  # 获取assignment.id
        
        # 添加作业-题目关联
        if data.get('problem_ids'):
            for i, problem_id in enumerate(data['problem_ids']):
                assignment_problem = AssignmentProblem(
                    assignment_id=assignment.id,
                    problem_id=problem_id,
                    order=i
                )
                db.session.add(assignment_problem)
        
        db.session.commit()
        
        # 返回创建的作业信息
        result = assignment.to_dict()
        result['problem_ids'] = data.get('problem_ids', [])
        
        return jsonify(result), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'创建作业失败: {str(e)}'}), 500

# 更新作业
@app.route('/assignments/<int:assignment_id>', methods=['PUT'])
@token_required
def update_assignment(current_user, assignment_id):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return jsonify({'error': '作业不存在'}), 404
    
    # 检查权限：教师只能更新自己创建的作业
    if current_user.role == 'teacher' and assignment.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    data = request.get_json()
    
    try:
        # 更新作业基本信息
        if 'name' in data:
            assignment.name = data['name']
        if 'description' in data:
            assignment.description = data['description']
        if 'requirements' in data:
            assignment.requirements = data['requirements']
        if 'due_date' in data:
            assignment.due_date = datetime.fromisoformat(data['due_date'])
        
        # 更新作业-题目关联
        if 'problem_ids' in data:
            # 删除旧的关联
            AssignmentProblem.query.filter_by(assignment_id=assignment_id).delete()
            
            # 创建新的关联
            for i, problem_id in enumerate(data['problem_ids']):
                assignment_problem = AssignmentProblem(
                    assignment_id=assignment_id,
                    problem_id=problem_id,
                    order=i
                )
                db.session.add(assignment_problem)
        
        assignment.updated_at = datetime.utcnow()
        db.session.commit()
        
        # 返回更新后的作业信息
        result = assignment.to_dict()
        result['problem_ids'] = data.get('problem_ids', [])
        
        return jsonify(result), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'更新作业失败: {str(e)}'}), 500

# 删除作业
@app.route('/assignments/<int:assignment_id>', methods=['DELETE'])
@token_required
def delete_assignment(current_user, assignment_id):
    if current_user.role not in ['teacher', 'admin']:
        return jsonify({'error': '权限不足'}), 403
    
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return jsonify({'error': '作业不存在'}), 404
    
    # 检查权限：教师只能删除自己创建的作业
    if current_user.role == 'teacher' and assignment.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    try:
        # 删除作业-题目关联
        AssignmentProblem.query.filter_by(assignment_id=assignment_id).delete()
        
        # 删除作业
        db.session.delete(assignment)
        db.session.commit()
        
        return jsonify({'message': '作业已删除'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'删除作业失败: {str(e)}'}), 500

# 获取作业详情
@app.route('/assignments/<int:assignment_id>', methods=['GET'])
@token_required
def get_assignment_detail(current_user, assignment_id):
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return jsonify({'error': '作业不存在'}), 404
    
    # 检查权限：教师只能查看自己创建的作业，管理员可以查看所有
    if current_user.role == 'teacher' and assignment.teacher_id != current_user.id:
        return jsonify({'error': '权限不足'}), 403
    
    # 获取作业信息
    result = assignment.to_dict()
    
    # 获取作业包含的题目信息
    assignment_problems = AssignmentProblem.query.filter_by(assignment_id=assignment_id).all()
    result['problem_ids'] = [ap.problem_id for ap in assignment_problems]
    
    return jsonify(result), 200

# ============ 组织架构管理相关API ============

# 创建/更新学校
@app.route('/schools', methods=['POST'])
@admin_required
def create_school(current_user):
    data = request.json
    name = data.get('name')
    code = data.get('code')
    
    if not name:
        return jsonify({'error': '学校名称不能为空'}), 400
    
    try:
        school = SchoolModel(name=name, code=code)
        db.session.add(school)
        db.session.commit()
        
        return jsonify(school.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'创建学校失败: {str(e)}'}), 500

# 更新学校
@app.route('/schools/<int:school_id>', methods=['PUT'])
@admin_required
def update_school(current_user, school_id):
    school = SchoolModel.query.get(school_id)
    if not school:
        return jsonify({'error': '学校不存在'}), 404
    
    data = request.json
    try:
        if 'name' in data:
            school.name = data['name']
        if 'code' in data:
            school.code = data['code']
        
        db.session.commit()
        return jsonify(school.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'更新学校失败: {str(e)}'}), 500

# 删除学校
@app.route('/schools/<int:school_id>', methods=['DELETE'])
@admin_required
def delete_school(current_user, school_id):
    school = SchoolModel.query.get(school_id)
    if not school:
        return jsonify({'error': '学校不存在'}), 404
    
    try:
        # 检查是否有院部关联
        departments = DepartmentModel.query.filter_by(school_id=school_id).all()
        if departments:
            return jsonify({'error': '该学校下还有院部，无法删除'}), 400
        
        # 检查是否有用户关联
        users = User.query.filter_by(school_id=school_id).all()
        if users:
            return jsonify({'error': '该学校下还有用户，无法删除'}), 400
        
        # 检查是否有课程关联（通过班级关联）
        if departments:
            department_ids = [dept.id for dept in departments]
            majors = MajorModel.query.filter(MajorModel.department_id.in_(department_ids)).all()
            if majors:
                major_ids = [major.id for major in majors]
                classes = ClassModel.query.filter(ClassModel.major_id.in_(major_ids)).all()
                if classes:
                    class_ids = [cls.id for cls in classes]
                    courses = Course.query.filter(Course.class_id.in_(class_ids)).all()
                    if courses:
                        return jsonify({'error': '该学校下还有课程，无法删除'}), 400
        
        db.session.delete(school)
        db.session.commit()
        return jsonify({'message': '学校删除成功'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'删除学校失败: {str(e)}'}), 500

# 创建/更新院部
@app.route('/departments', methods=['POST'])
@admin_required
def create_department(current_user):
    data = request.json
    name = data.get('name')
    code = data.get('code')
    school_id = data.get('school_id')
    
    if not name:
        return jsonify({'error': '院部名称不能为空'}), 400
    
    if not school_id:
        return jsonify({'error': '所属学校不能为空'}), 400
    
    try:
        department = DepartmentModel(name=name, code=code, school_id=school_id)
        db.session.add(department)
        db.session.commit()
        
        return jsonify(department.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'创建院部失败: {str(e)}'}), 500

# 更新院部
@app.route('/departments/<int:department_id>', methods=['PUT'])
@admin_required
def update_department(current_user, department_id):
    department = DepartmentModel.query.get(department_id)
    if not department:
        return jsonify({'error': '院部不存在'}), 404
    
    data = request.json
    try:
        if 'name' in data:
            department.name = data['name']
        if 'code' in data:
            department.code = data['code']
        if 'school_id' in data:
            department.school_id = data['school_id']
        
        db.session.commit()
        return jsonify(department.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'更新院部失败: {str(e)}'}), 500

# 删除院部
@app.route('/departments/<int:department_id>', methods=['DELETE'])
@admin_required
def delete_department(current_user, department_id):
    department = DepartmentModel.query.get(department_id)
    if not department:
        return jsonify({'error': '院部不存在'}), 404
    
    try:
        # 检查是否有专业关联
        majors = MajorModel.query.filter_by(department_id=department_id).all()
        if majors:
            return jsonify({'error': '该院部下还有专业，无法删除'}), 400
        
        # 检查是否有用户关联
        users = User.query.filter_by(department_id=department_id).all()
        if users:
            return jsonify({'error': '该院部下还有用户，无法删除'}), 400
        
        # 检查是否有课程关联（通过班级关联）
        if majors:
            major_ids = [major.id for major in majors]
            classes = ClassModel.query.filter(ClassModel.major_id.in_(major_ids)).all()
            if classes:
                class_ids = [cls.id for cls in classes]
                courses = Course.query.filter(Course.class_id.in_(class_ids)).all()
                if courses:
                    return jsonify({'error': '该院部下还有课程，无法删除'}), 400
        
        db.session.delete(department)
        db.session.commit()
        return jsonify({'message': '院部删除成功'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'删除院部失败: {str(e)}'}), 500

# 创建/更新专业
@app.route('/majors', methods=['POST'])
@admin_required
def create_major(current_user):
    data = request.json
    name = data.get('name')
    code = data.get('code')
    department_id = data.get('department_id')
    school_id = data.get('school_id')
    
    if not name:
        return jsonify({'error': '专业名称不能为空'}), 400
    
    if not school_id:
        return jsonify({'error': '所属学校不能为空'}), 400
    
    try:
        major = MajorModel(name=name, code=code, department_id=department_id, school_id=school_id)
        db.session.add(major)
        db.session.commit()
        
        return jsonify(major.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'创建专业失败: {str(e)}'}), 500

# 更新专业
@app.route('/majors/<int:major_id>', methods=['PUT'])
@admin_required
def update_major(current_user, major_id):
    major = MajorModel.query.get(major_id)
    if not major:
        return jsonify({'error': '专业不存在'}), 404
    
    data = request.json
    try:
        if 'name' in data:
            major.name = data['name']
        if 'code' in data:
            major.code = data['code']
        if 'department_id' in data:
            major.department_id = data['department_id']
        if 'school_id' in data:
            major.school_id = data['school_id']
        
        db.session.commit()
        return jsonify(major.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'更新专业失败: {str(e)}'}), 500

# 删除专业
@app.route('/majors/<int:major_id>', methods=['DELETE'])
@admin_required
def delete_major(current_user, major_id):
    major = MajorModel.query.get(major_id)
    if not major:
        return jsonify({'error': '专业不存在'}), 404
    
    try:
        # 检查是否有班级关联
        classes = ClassModel.query.filter_by(major_id=major_id).all()
        if classes:
            return jsonify({'error': '该专业下还有班级，无法删除'}), 400
        
        # 检查是否有用户关联
        users = User.query.filter_by(major_id=major_id).all()
        if users:
            return jsonify({'error': '该专业下还有用户，无法删除'}), 400
        
        # 检查是否有课程关联（通过班级关联）
        if classes:
            class_ids = [cls.id for cls in classes]
            courses = Course.query.filter(Course.class_id.in_(class_ids)).all()
            if courses:
                return jsonify({'error': '该专业下还有课程，无法删除'}), 400
        
        db.session.delete(major)
        db.session.commit()
        return jsonify({'message': '专业删除成功'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'删除专业失败: {str(e)}'}), 500

# 创建/更新班级
@app.route('/classes', methods=['POST'])
@admin_required
def create_class(current_user):
    data = request.json
    name = data.get('name')
    grade = data.get('grade')
    major_id = data.get('major_id')
    department_id = data.get('department_id')
    
    if not name:
        return jsonify({'error': '班级名称不能为空'}), 400
    
    try:
        class_obj = ClassModel(name=name, grade=grade, major_id=major_id, department_id=department_id)
        db.session.add(class_obj)
        db.session.commit()
        
        return jsonify(class_obj.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'创建班级失败: {str(e)}'}), 500

# 更新班级
@app.route('/classes/<int:class_id>', methods=['PUT'])
@admin_required
def update_class(current_user, class_id):
    class_obj = ClassModel.query.get(class_id)
    if not class_obj:
        return jsonify({'error': '班级不存在'}), 404
    
    data = request.json
    try:
        if 'name' in data:
            class_obj.name = data['name']
        if 'grade' in data:
            class_obj.grade = data['grade']
        if 'major_id' in data:
            class_obj.major_id = data['major_id']
        if 'department_id' in data:
            class_obj.department_id = data['department_id']
        
        db.session.commit()
        return jsonify(class_obj.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'更新班级失败: {str(e)}'}), 500

# 删除班级
@app.route('/classes/<int:class_id>', methods=['DELETE'])
@admin_required
def delete_class(current_user, class_id):
    class_obj = ClassModel.query.get(class_id)
    if not class_obj:
        return jsonify({'error': '班级不存在'}), 404
    
    try:
        # 检查是否有用户关联
        users = User.query.filter_by(class_id=class_id).all()
        if users:
            return jsonify({'error': '该班级下还有学生，无法删除'}), 400
        
        # 检查是否有课程关联
        courses = Course.query.filter_by(class_id=class_id).all()
        if courses:
            return jsonify({'error': '该班级下还有课程，无法删除'}), 400
        
        db.session.delete(class_obj)
        db.session.commit()
        return jsonify({'message': '班级删除成功'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'删除班级失败: {str(e)}'}), 500

#启动时初始化数据库表，运行在 5000 端口。
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5001, debug=True)
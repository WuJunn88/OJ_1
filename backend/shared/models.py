# 定义了共享的数据库模型基类，Problem 和 Submission 的基本字段，
# 供主服务和判题服务继承，保持数据模型一致。

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

Base = declarative_base()

class Problem(Base):
    __tablename__ = 'problem'
    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    type = Column(String(20), default='programming')  # 题目类型：programming, choice, judge, short_answer
    test_cases = Column(Text, nullable=True)  # 对于非编程题可以为空
    expected_output = Column(Text, nullable=True)  # 对于非编程题可以为空
    # Special Judge 相关字段
    enable_special_judge = Column(Boolean, default=False)
    special_judge_script = Column(Text, nullable=True)
    special_judge_language = Column(String(20), default='python')
    special_judge_timeout = Column(Integer, default=5000)
    special_judge_memory_limit = Column(Integer, default=256)
    judge_config = Column(Text, nullable=True)
    # 其他字段
    difficulty = Column(String(20), default='easy')  # easy, medium, hard
    time_limit = Column(Integer, default=1000)  # 毫秒
    memory_limit = Column(Integer, default=128)  # MB
    created_by = Column(Integer, ForeignKey('user.id'))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True)  # 软删除时间

class Submission(Base):
    __tablename__ = 'submission'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    problem_id = Column(Integer, ForeignKey('problem.id'), nullable=False)
    code = Column(Text, nullable=False)
    language = Column(String(20), nullable=False)
    # 提交状态说明：
    # pending: 等待判题
    # judging: 判题中
    # accepted: 答案正确
    # wrong_answer: 答案错误
    # partially_correct: 部分正确（主要用于简答题）
    # error: 判题服务错误
    # time_limit_exceeded: 超时（编程题）
    # memory_limit_exceeded: 内存超限（编程题）
    status = Column(String(20), default='pending')
    result = Column(Text)  # 判题结果详情
    execution_time = Column(Float)  # 执行时间（秒），非编程题为0
    memory_used = Column(Float)  # 内存使用量（MB），非编程题为0
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class User(Base):
    __tablename__ = 'user'
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True)
    phone = Column(String(20))
    role = Column(String(20), default='student')  # student, teacher, admin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # 关联信息
    class_id = Column(Integer, ForeignKey('class.id'))
    major_id = Column(Integer, ForeignKey('major.id'))
    school_id = Column(Integer, ForeignKey('school.id'))

class School(Base):
    __tablename__ = 'school'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True)

class Major(Base):
    __tablename__ = 'major'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20))
    school_id = Column(Integer, ForeignKey('school.id'))

class Class(Base):
    __tablename__ = 'class'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    grade = Column(String(20))  # 年级
    major_id = Column(Integer, ForeignKey('major.id'))

from database import db
from datetime import datetime, timezone


class MSProblem(db.Model):
    __tablename__ = 'problem'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(20), default='programming')  # 题目类型：programming, choice, judge, short_answer
    test_cases = db.Column(db.Text, nullable=True)  # 对于非编程题可以为空
    expected_output = db.Column(db.Text, nullable=True)  # 对于非编程题可以为空
    # 选择题专用字段
    choice_options = db.Column(db.Text, nullable=True)  # 选择题选项，JSON格式或换行分隔
    is_multiple_choice = db.Column(db.Boolean, default=False)  # 是否为多选题
    # Special Judge 相关字段
    enable_special_judge = db.Column(db.Boolean, default=False)  # 是否启用特殊判题
    special_judge_script = db.Column(db.Text, nullable=True)  # 特殊判题脚本（Python代码）
    special_judge_language = db.Column(db.String(20), default='python')  # 判题脚本语言
    special_judge_timeout = db.Column(db.Integer, default=5000)  # 判题脚本超时时间(ms)
    special_judge_memory_limit = db.Column(db.Integer, default=256)  # 判题脚本内存限制(MB)
    # 判题参数配置
    judge_config = db.Column(db.Text, nullable=True)  # JSON格式的判题配置
    # 其他字段
    difficulty = db.Column(db.String(20), default='easy')
    time_limit = db.Column(db.Integer, default=1000)
    memory_limit = db.Column(db.Integer, default=128)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    deleted_at = db.Column(db.DateTime, nullable=True)  # 软删除时间

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'type': self.type,
            'test_cases': self.test_cases,
            'expected_output': self.expected_output,
            'choice_options': self.choice_options,
            'is_multiple_choice': self.is_multiple_choice,
            'enable_special_judge': self.enable_special_judge,
            'special_judge_script': self.special_judge_script,
            'special_judge_language': self.special_judge_language,
            'special_judge_timeout': self.special_judge_timeout,
            'special_judge_memory_limit': self.special_judge_memory_limit,
            'judge_config': self.judge_config,
            'difficulty': self.difficulty,
            'time_limit': self.time_limit,
            'memory_limit': self.memory_limit,
            'created_by': self.created_by,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'deleted_at': self.deleted_at.isoformat() if self.deleted_at else None
        }
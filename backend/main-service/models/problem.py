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
            'difficulty': self.difficulty,
            'time_limit': self.time_limit,
            'memory_limit': self.memory_limit,
            'created_by': self.created_by,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'deleted_at': self.deleted_at.isoformat() if self.deleted_at else None
        }
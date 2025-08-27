from database import db
from datetime import datetime

class Assignment(db.Model):
    """作业模型"""
    __tablename__ = 'assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, comment='作业名称')
    description = db.Column(db.Text, comment='作业描述')
    requirements = db.Column(db.Text, comment='作业要求')
    due_date = db.Column(db.DateTime, nullable=False, comment='截止时间')
    course_id = db.Column(db.Integer, db.ForeignKey('course.id', ondelete='CASCADE'), nullable=False, comment='所属课程ID')
    teacher_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, comment='布置教师ID')
    
    # 补交作业相关字段
    allow_overdue_submission = db.Column(db.Boolean, default=False, comment='是否允许补交作业')
    overdue_deadline = db.Column(db.DateTime, comment='补交截止时间')
    overdue_allow_user_ids = db.Column(db.Text, default='[]', comment='逾期提交白名单用户ID列表(JSON格式)')
    overdue_score_ratio = db.Column(db.Float, default=0.8, comment='逾期提交得分比例(0.0-1.0)')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment='更新时间')
    
    # 关联关系
    course = db.relationship('Course', backref='assignments')
    teacher = db.relationship('User', backref='created_assignments')
    
    def to_dict(self):
        """转换为字典格式"""
        # 动态计算作业状态：如果截止时间未到则为进行中，否则为已结束
        now = datetime.utcnow()
        is_active = self.due_date > now if self.due_date else False
        
        # 计算补交状态
        can_overdue = False
        if self.allow_overdue_submission and self.overdue_deadline:
            can_overdue = self.overdue_deadline > now
        
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'requirements': self.requirements,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'course_id': self.course_id,
            'teacher_id': self.teacher_id,
            
            # 补交相关字段
            'allow_overdue_submission': self.allow_overdue_submission,
            'overdue_deadline': self.overdue_deadline.isoformat() if self.overdue_deadline else None,
            'overdue_allow_user_ids': self.overdue_allow_user_ids,
            'overdue_score_ratio': self.overdue_score_ratio,
            'can_overdue': can_overdue,
            
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': is_active
        }

class AssignmentProblem(db.Model):
    """作业-题目关联模型"""
    __tablename__ = 'assignment_problems'
    
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id', ondelete='CASCADE'), nullable=False, comment='作业ID')
    problem_id = db.Column(db.Integer, db.ForeignKey('problem.id', ondelete='CASCADE'), nullable=False, comment='题目ID')
    order = db.Column(db.Integer, default=0, comment='题目顺序')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, comment='创建时间')
    
    # 关联关系 - 使用字符串引用避免循环导入
    assignment = db.relationship('Assignment', backref='assignment_problems')
    problem = db.relationship('MSProblem', backref='assignment_problems')
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'assignment_id': self.assignment_id,
            'problem_id': self.problem_id,
            'order': self.order,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

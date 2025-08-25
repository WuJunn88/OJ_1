from database import db
from datetime import datetime, timezone


class MSSubmission(db.Model):
    __tablename__ = 'submission'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    problem_id = db.Column(db.Integer, db.ForeignKey('problem.id'), nullable=False)
    code = db.Column(db.Text, nullable=False)
    language = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='pending')
    result = db.Column(db.Text)
    execution_time = db.Column(db.Float)
    memory_used = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'problem_id': self.problem_id,
            'code': self.code[:100] + '...' if len(self.code) > 100 else self.code,
            'language': self.language,
            'status': self.status,
            'result': self.result,
            'execution_time': self.execution_time,
            'memory_used': self.memory_used,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
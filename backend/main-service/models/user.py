from database import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, Float, DateTime, Boolean, ForeignKey


class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(20), default='student')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    class_id = db.Column(db.Integer, db.ForeignKey('class.id'), nullable=True)
    major_id = db.Column(db.Integer, db.ForeignKey('major.id'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    school_id = db.Column(db.Integer, db.ForeignKey('school.id'), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_relations=False):
        data = {
            'id': self.id,
            'username': self.username,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'is_active': self.is_active,
            'class_id': self.class_id,
            'major_id': self.major_id,
            'school_id': self.school_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_relations:
            # 添加学校名称
            if self.school_id:
                school = SchoolModel.query.get(self.school_id)
                data['school_name'] = school.name if school else None
            else:
                data['school_name'] = None
                
            # 添加院部名称
            if self.department_id:
                department = DepartmentModel.query.get(self.department_id)
                data['department_name'] = department.name if department else None
            else:
                data['department_name'] = None
                
            # 添加专业名称
            if self.major_id:
                major = MajorModel.query.get(self.major_id)
                data['major_name'] = major.name if major else None
            else:
                data['major_name'] = None
                
            # 添加班级名称
            if self.class_id:
                class_obj = ClassModel.query.get(self.class_id)
                data['class_name'] = class_obj.name if class_obj else None
            else:
                data['class_name'] = None
        
        return data


class SchoolModel(db.Model):
    __tablename__ = 'school'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code
        }


class DepartmentModel(db.Model):
    __tablename__ = 'department'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), nullable=True)
    school_id = db.Column(db.Integer, db.ForeignKey('school.id'), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'school_id': self.school_id
        }


class MajorModel(db.Model):
    __tablename__ = 'major'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)
    school_id = db.Column(db.Integer, db.ForeignKey('school.id'), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'department_id': self.department_id,
            'school_id': self.school_id
        }


class ClassModel(db.Model):
    __tablename__ = 'class'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    grade = db.Column(db.String(20), nullable=True)
    major_id = db.Column(db.Integer, db.ForeignKey('major.id'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'grade': self.grade,
            'major_id': self.major_id,
            'department_id': self.department_id
        }

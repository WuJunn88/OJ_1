from database import db
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey


class CourseStudent(db.Model):
    __tablename__ = 'course_student'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('class.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # 建立关系
    course = db.relationship('Course', backref='course_students')
    student = db.relationship('User', backref='course_enrollments')
    class_info = db.relationship('ClassModel', backref='enrolled_students')
    
    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'student_id': self.student_id,
            'class_id': self.class_id,
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'student_name': self.student.name if self.student else None,
            'student_no': self.student.username if self.student else None
        }


class Course(db.Model):
    __tablename__ = 'course'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('class.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # 建立关系
    teacher = db.relationship('User', backref='courses')
    class_info = db.relationship('ClassModel', backref='courses')
    
    def to_dict(self):
        # 基础信息
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'teacher_id': self.teacher_id,
            'class_id': self.class_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # 教师信息
            'teacher_name': self.teacher.name if self.teacher else None,
            'teacher_username': self.teacher.username if self.teacher else None,
        }
        
        # 计算学生数量
        try:
            from database import db
            from sqlalchemy import text
            
            student_count_query = text("""
                SELECT COUNT(*) as count
                FROM course_student cs
                WHERE cs.course_id = :course_id
            """)
            
            student_count_result = db.session.execute(student_count_query, {'course_id': self.id})
            student_count_row = student_count_result.fetchone()
            result['student_count'] = student_count_row.count if student_count_row else 0
            
        except Exception as e:
            print(f"Warning: Failed to get student count for course {self.id}: {e}")
            result['student_count'] = 0
        
        # 安全地添加院部和学校信息
        try:
            if self.class_id:
                # 使用原生SQL查询获取院部和学校信息，避免关系引用问题
                query = text("""
                    SELECT s.name as school_name, s.id as school_id, 
                           d.name as department_name, d.id as department_id,
                           m.name as major_name, m.id as major_id,
                           cl.name as class_name
                    FROM course c
                    LEFT JOIN class cl ON c.class_id = cl.id
                    LEFT JOIN major m ON cl.major_id = m.id
                    LEFT JOIN department d ON cl.department_id = d.id
                    LEFT JOIN school s ON d.school_id = s.id
                    WHERE c.id = :course_id
                """)
                
                result_set = db.session.execute(query, {'course_id': self.id})
                row = result_set.fetchone()
                
                if row:
                    result.update({
                        'school_id': row.school_id,
                        'school_name': row.school_name,
                        'department_id': row.department_id,
                        'department_name': row.department_name,
                        'major_id': row.major_id,
                        'major_name': row.major_name,
                        'class_name': row.class_name
                    })
                else:
                    result.update({
                        'school_id': None,
                        'school_name': None,
                        'department_id': None,
                        'department_name': None,
                        'major_id': None,
                        'major_name': None,
                        'class_name': None
                    })
            else:
                result.update({
                    'school_id': None,
                    'school_name': None,
                    'department_id': None,
                    'department_name': None,
                    'major_id': None,
                    'major_name': None,
                    'class_name': None
                })
        except Exception as e:
            # 如果查询失败，设置为None，确保不会影响基本功能
            print(f"Warning: Failed to get school/major info for course {self.id}: {e}")
            result.update({
                'school_id': None,
                'school_name': None,
                'department_id': None,
                'department_name': None,
                'major_id': None,
                'major_name': None,
                'class_name': None
            })
        
        return result

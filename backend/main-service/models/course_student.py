from database import db
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship


class CourseStudent(db.Model):
    __tablename__ = 'course_student'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id', ondelete='CASCADE'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('class.id', ondelete='CASCADE'), nullable=False)
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


class CourseStudentExclusion(db.Model):
    __tablename__ = 'course_student_exclusion'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id', ondelete='CASCADE'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    excluded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    course = db.relationship('Course', backref='student_exclusions')
    student = db.relationship('User', backref='course_exclusions')

    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'student_id': self.student_id,
            'excluded_at': self.excluded_at.isoformat() if self.excluded_at else None
        }


class Course(db.Model):
    __tablename__ = 'course'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('class.id'), nullable=True)
    teaching_class_name = db.Column(db.String(100), nullable=True)
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
            'teaching_class_name': self.teaching_class_name,
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
            
            # 查询原班级中的学生数量（仅在class_id存在时生效）
            class_student_count = 0
            if self.class_id:
                class_student_query = text("""
                    SELECT COUNT(*) as count
                    FROM user u
                    WHERE u.class_id = :class_id AND u.role = 'student'
                """)
                class_student_result = db.session.execute(class_student_query, {'class_id': self.class_id})
                class_student_row = class_student_result.fetchone()
                class_student_count = class_student_row.count if class_student_row else 0
            
            # 查询通过课程管理添加的学生数量
            course_student_query = text("""
                SELECT COUNT(*) as count
                FROM course_student cs
                WHERE cs.course_id = :course_id
            """)
            course_student_result = db.session.execute(course_student_query, {'course_id': self.id})
            course_student_row = course_student_result.fetchone()
            course_student_count = course_student_row.count if course_student_row else 0

            # 查询退课排除数量
            exclusions_count = 0
            if self.class_id:
                exclusions_count_query = text("""
                    SELECT COUNT(*) as count
                    FROM course_student_exclusion e
                    WHERE e.course_id = :course_id
                """)
                exclusions_result = db.session.execute(exclusions_count_query, {'course_id': self.id})
                exclusions_row = exclusions_result.fetchone()
                exclusions_count = exclusions_row.count if exclusions_row else 0
            
            total_student_count = max(0, class_student_count - exclusions_count) + course_student_count
            result['student_count'] = total_student_count
            
        except Exception as e:
            print(f"Warning: Failed to get student count for course {self.id}: {e}")
            result['student_count'] = 0
        
        # 安全地添加院部和学校信息
        try:
            if self.class_id:
                # 使用原生SQL查询获取院部和学校信息
                from sqlalchemy import text
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
            # 优先返回教学班名称用于显示
            result['display_class_name'] = self.teaching_class_name or result.get('class_name')
        except Exception as e:
            print(f"Warning: Failed to get school/major info for course {self.id}: {e}")
            result['school_id'] = None
            result['school_name'] = None
            result['department_id'] = None
            result['department_name'] = None
            result['major_id'] = None
            result['major_name'] = None
            result['class_name'] = None
            result['display_class_name'] = self.teaching_class_name
        
        return result

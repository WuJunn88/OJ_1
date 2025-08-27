#!/usr/bin/env python3
"""
数据库迁移脚本：添加级联删除约束
为课程相关的表添加 CASCADE DELETE 约束，实现级联删除功能
"""

import os
import sqlite3

DB_PATH = 'judger.db'

def table_exists(cursor, table_name):
    """检查表是否存在"""
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    return cursor.fetchone() is not None

def column_exists(cursor, table_name, column_name):
    """检查列是否存在"""
    cursor.execute("PRAGMA table_info(?)", (table_name,))
    columns = [col[1] for col in cursor.fetchall()]
    return column_name in columns

def get_foreign_key_info(cursor, table_name):
    """获取表的外键信息"""
    cursor.execute("PRAGMA foreign_key_list(?)", (table_name,))
    return cursor.fetchall()

def main():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.isolation_level = None  # autocommit
    cursor = conn.cursor()

    try:
        print("开始添加级联删除约束...")
        cursor.execute('PRAGMA foreign_keys=OFF')

        # 1. 重建 course_student 表，添加级联删除约束
        if table_exists(cursor, 'course_student'):
            print("重建 course_student 表，添加级联删除约束...")
            
            # 备份现有数据
            cursor.execute("SELECT * FROM course_student")
            existing_data = cursor.fetchall()
            print(f"备份了 {len(existing_data)} 条 course_student 记录")
            
            # 删除旧表
            cursor.execute("DROP TABLE course_student")
            
            # 创建新表，带级联删除约束
            cursor.execute("""
                CREATE TABLE course_student (
                    id INTEGER PRIMARY KEY,
                    course_id INTEGER NOT NULL,
                    student_id INTEGER NOT NULL,
                    class_id INTEGER NOT NULL,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
                    FOREIGN KEY (student_id) REFERENCES user(id) ON DELETE CASCADE,
                    FOREIGN KEY (class_id) REFERENCES class(id) ON DELETE CASCADE
                )
            """)
            
            # 恢复数据
            if existing_data:
                cursor.executemany("""
                    INSERT INTO course_student (id, course_id, student_id, class_id, added_at)
                    VALUES (?, ?, ?, ?, ?)
                """, existing_data)
                print(f"恢复了 {len(existing_data)} 条 course_student 记录")
            
            print("course_student 表重建完成")

        # 2. 重建 course_student_exclusion 表，添加级联删除约束
        if table_exists(cursor, 'course_student_exclusion'):
            print("重建 course_student_exclusion 表，添加级联删除约束...")
            
            # 备份现有数据
            cursor.execute("SELECT * FROM course_student_exclusion")
            existing_data = cursor.fetchall()
            print(f"备份了 {len(existing_data)} 条 course_student_exclusion 记录")
            
            # 删除旧表
            cursor.execute("DROP TABLE course_student_exclusion")
            
            # 创建新表，带级联删除约束
            cursor.execute("""
                CREATE TABLE course_student_exclusion (
                    id INTEGER PRIMARY KEY,
                    course_id INTEGER NOT NULL,
                    student_id INTEGER NOT NULL,
                    excluded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
                    FOREIGN KEY (student_id) REFERENCES user(id) ON DELETE CASCADE
                )
            """)
            
            # 恢复数据
            if existing_data:
                cursor.executemany("""
                    INSERT INTO course_student_exclusion (id, course_id, student_id, excluded_at)
                    VALUES (?, ?, ?, ?)
                """, existing_data)
                print(f"恢复了 {len(existing_data)} 条 course_student_exclusion 记录")
            
            print("course_student_exclusion 表重建完成")

        # 3. 重建 assignments 表，添加级联删除约束
        if table_exists(cursor, 'assignments'):
            print("重建 assignments 表，添加级联删除约束...")
            
            # 备份现有数据
            cursor.execute("SELECT * FROM assignments")
            existing_data = cursor.fetchall()
            print(f"备份了 {len(existing_data)} 条 assignments 记录")
            
            # 删除旧表
            cursor.execute("DROP TABLE assignments")
            
            # 创建新表，带级联删除约束
            cursor.execute("""
                CREATE TABLE assignments (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    description TEXT,
                    requirements TEXT,
                    due_date DATETIME NOT NULL,
                    course_id INTEGER NOT NULL,
                    teacher_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE,
                    FOREIGN KEY (teacher_id) REFERENCES user(id) ON DELETE CASCADE
                )
            """)
            
            # 恢复数据
            if existing_data:
                cursor.executemany("""
                    INSERT INTO assignments (id, name, description, requirements, due_date, course_id, teacher_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, existing_data)
                print(f"恢复了 {len(existing_data)} 条 assignments 记录")
            
            print("assignments 表重建完成")

        # 4. 重建 assignment_problems 表，添加级联删除约束
        if table_exists(cursor, 'assignment_problems'):
            print("重建 assignment_problems 表，添加级联删除约束...")
            
            # 备份现有数据
            cursor.execute("SELECT * FROM assignment_problems")
            existing_data = cursor.fetchall()
            print(f"备份了 {len(existing_data)} 条 assignment_problems 记录")
            
            # 删除旧表
            cursor.execute("DROP TABLE assignment_problems")
            
            # 创建新表，带级联删除约束
            cursor.execute("""
                CREATE TABLE assignment_problems (
                    id INTEGER PRIMARY KEY,
                    assignment_id INTEGER NOT NULL,
                    problem_id INTEGER NOT NULL,
                    order_num INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
                    FOREIGN KEY (problem_id) REFERENCES problem(id) ON DELETE CASCADE
                )
            """)
            
            # 恢复数据
            if existing_data:
                cursor.executemany("""
                    INSERT INTO assignment_problems (id, assignment_id, problem_id, order_num, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, existing_data)
                print(f"恢复了 {len(existing_data)} 条 assignment_problems 记录")
            
            print("assignment_problems 表重建完成")

        # 5. 重新启用外键约束
        cursor.execute('PRAGMA foreign_keys=ON')
        
        # 6. 完整性检查
        cursor.execute('PRAGMA integrity_check')
        res = cursor.fetchone()
        print(f"数据库完整性检查: {res[0]}")
        
        print("级联删除约束添加完成！")
        
    except Exception as e:
        print(f"迁移过程中出错: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()

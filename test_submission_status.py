#!/usr/bin/env python3
"""
测试提交状态和作业完成状态的脚本
"""

import sqlite3
import json
from datetime import datetime

def test_submission_status():
    """测试提交状态"""
    print("=== 测试提交状态 ===")
    
    # 连接到数据库
    conn = sqlite3.connect('judger.db')
    cursor = conn.cursor()
    
    try:
        # 检查提交表结构
        cursor.execute("PRAGMA table_info(submission)")
        columns = cursor.fetchall()
        print("提交表结构:")
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
        
        # 查看所有提交记录
        cursor.execute("""
            SELECT id, user_id, problem_id, status, result, created_at 
            FROM submission 
            ORDER BY created_at DESC 
            LIMIT 10
        """)
        submissions = cursor.fetchall()
        
        print(f"\n最近10条提交记录:")
        for sub in submissions:
            print(f"  提交ID: {sub[0]}, 用户ID: {sub[1]}, 题目ID: {sub[2]}, 状态: {sub[3]}, 结果: {sub[4]}, 时间: {sub[5]}")
        
        # 查看特定用户的提交记录
        cursor.execute("""
            SELECT s.id, s.problem_id, s.status, s.result, p.title, p.type
            FROM submission s
            JOIN problem p ON s.problem_id = p.id
            WHERE s.user_id = 1
            ORDER BY s.created_at DESC
        """)
        user_submissions = cursor.fetchall()
        
        print(f"\n用户ID=1的提交记录:")
        for sub in user_submissions:
            print(f"  提交ID: {sub[0]}, 题目ID: {sub[1]}, 状态: {sub[2]}, 结果: {sub[3]}, 题目: {sub[4]}, 类型: {sub[5]}")
        
    except Exception as e:
        print(f"查询提交状态时出错: {e}")
    finally:
        conn.close()

def test_assignment_completion():
    """测试作业完成状态计算"""
    print("\n=== 测试作业完成状态计算 ===")
    
    conn = sqlite3.connect('judger.db')
    cursor = conn.cursor()
    
    try:
        # 查看作业表
        cursor.execute("SELECT * FROM assignments")
        assignments = cursor.fetchall()
        print(f"作业表记录数: {len(assignments)}")
        
        # 查看作业-题目关联表
        cursor.execute("SELECT * FROM assignment_problems")
        assignment_problems = cursor.fetchall()
        print(f"作业-题目关联记录数: {len(assignment_problems)}")
        
        # 模拟作业完成状态计算逻辑
        cursor.execute("""
            SELECT 
                a.id as assignment_id,
                a.name as assignment_name,
                a.course_id,
                COUNT(ap.problem_id) as total_problems
            FROM assignments a
            LEFT JOIN assignment_problems ap ON a.id = ap.assignment_id
            GROUP BY a.id, a.name, a.course_id
        """)
        assignment_summary = cursor.fetchall()
        
        print(f"\n作业概览:")
        for ass in assignment_summary:
            assignment_id, name, course_id, total_problems = ass
            print(f"  作业ID: {assignment_id}, 名称: {name}, 课程ID: {course_id}, 题目数: {total_problems}")
            
            # 查看该作业的题目
            cursor.execute("""
                SELECT ap.problem_id, p.title, p.type
                FROM assignment_problems ap
                JOIN problem p ON ap.problem_id = p.id
                WHERE ap.assignment_id = ?
            """, (assignment_id,))
            problems = cursor.fetchall()
            
            print(f"    包含的题目:")
            for prob in problems:
                prob_id, title, prob_type = prob
                print(f"      题目ID: {prob_id}, 标题: {title}, 类型: {prob_type}")
                
                # 查看用户1对该题目的提交状态
                cursor.execute("""
                    SELECT status, result, created_at
                    FROM submission
                    WHERE user_id = 1 AND problem_id = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (prob_id,))
                latest_submission = cursor.fetchone()
                
                if latest_submission:
                    status, result, created_at = latest_submission
                    print(f"        最新提交状态: {status}, 结果: {result}, 时间: {created_at}")
                else:
                    print(f"        无提交记录")
        
    except Exception as e:
        print(f"查询作业完成状态时出错: {e}")
    finally:
        conn.close()

def test_course_student_relationship():
    """测试课程-学生关系"""
    print("\n=== 测试课程-学生关系 ===")
    
    conn = sqlite3.connect('judger.db')
    cursor = conn.cursor()
    
    try:
        # 查看课程表
        cursor.execute("SELECT * FROM course")
        courses = cursor.fetchall()
        print(f"课程表记录数: {len(courses)}")
        
        # 查看班级表
        cursor.execute("SELECT * FROM class")
        classes = cursor.fetchall()
        print(f"班级表记录数: {len(classes)}")
        
        # 查看用户表
        cursor.execute("SELECT id, username, name, role, class_id FROM user WHERE role = 'student'")
        students = cursor.fetchall()
        print(f"学生用户数: {len(students)}")
        
        for student in students:
            student_id, username, name, role, class_id = student
            print(f"  学生: {name} (ID: {student_id}), 班级ID: {class_id}")
            
            # 查看学生所在的班级和课程
            if class_id:
                cursor.execute("""
                    SELECT c.name as class_name, co.name as course_name, co.id as course_id
                    FROM class c
                    JOIN course co ON c.id = co.class_id
                    WHERE c.id = ?
                """, (class_id,))
                student_courses = cursor.fetchall()
                
                for course in student_courses:
                    class_name, course_name, course_id = course
                    print(f"    班级: {class_name}, 课程: {course_name} (ID: {course_id})")
        
    except Exception as e:
        print(f"查询课程-学生关系时出错: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    test_submission_status()
    test_assignment_completion()
    test_course_student_relationship()

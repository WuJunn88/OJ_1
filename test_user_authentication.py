#!/usr/bin/env python3
"""
测试用户认证和作业完成状态的关系
"""

import sqlite3
import json
from datetime import datetime

def test_user_authentication():
    """测试用户认证"""
    print("=== 测试用户认证 ===")
    
    conn = sqlite3.connect('judger.db')
    cursor = conn.cursor()
    
    try:
        # 查看所有用户
        cursor.execute("SELECT id, username, name, role, class_id FROM user")
        users = cursor.fetchall()
        print("所有用户:")
        for user in users:
            user_id, username, name, role, class_id = user
            print(f"  ID: {user_id}, 用户名: {username}, 姓名: {name}, 角色: {role}, 班级ID: {class_id}")
        
        # 查看用户4的详细信息
        cursor.execute("""
            SELECT u.id, u.username, u.name, u.role, u.class_id, c.name as class_name
            FROM user u
            LEFT JOIN class c ON u.class_id = c.id
            WHERE u.id = 4
        """)
        user4 = cursor.fetchone()
        if user4:
            user_id, username, name, role, class_id, class_name = user4
            print(f"\n用户4详细信息:")
            print(f"  ID: {user_id}, 用户名: {username}, 姓名: {name}, 角色: {role}, 班级ID: {class_id}, 班级: {class_name}")
        
        # 查看用户4的所有提交记录
        cursor.execute("""
            SELECT s.id, s.problem_id, s.status, s.result, p.title, p.type, s.created_at
            FROM submission s
            JOIN problem p ON s.problem_id = p.id
            WHERE s.user_id = 4
            ORDER BY s.created_at DESC
        """)
        user4_submissions = cursor.fetchall()
        
        print(f"\n用户4的所有提交记录:")
        for sub in user4_submissions:
            sub_id, prob_id, status, result, title, prob_type, created_at = sub
            print(f"  提交ID: {sub_id}, 题目ID: {prob_id}, 状态: {status}, 结果: {result}, 题目: {title}, 类型: {prob_type}, 时间: {created_at}")
        
        # 查看作业和题目的关系
        cursor.execute("""
            SELECT a.id as assignment_id, a.name as assignment_name, a.course_id,
                   ap.problem_id, p.title as problem_title, p.type as problem_type
            FROM assignments a
            JOIN assignment_problems ap ON a.id = ap.assignment_id
            JOIN problem p ON ap.problem_id = p.id
        """)
        assignment_problems = cursor.fetchall()
        
        print(f"\n作业-题目关系:")
        for ap in assignment_problems:
            ass_id, ass_name, course_id, prob_id, prob_title, prob_type = ap
            print(f"  作业ID: {ass_id}, 名称: {ass_name}, 课程ID: {course_id}, 题目ID: {prob_id}, 标题: {prob_title}, 类型: {prob_type}")
            
            # 查看用户4对该题目的提交状态
            cursor.execute("""
                SELECT status, result, created_at
                FROM submission
                WHERE user_id = 4 AND problem_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (prob_id,))
            latest_submission = cursor.fetchone()
            
            if latest_submission:
                status, result, created_at = latest_submission
                print(f"    用户4最新提交: 状态={status}, 结果={result}, 时间={created_at}")
                
                # 判断是否完成
                if status == 'accepted':
                    print(f"    ✅ 该题目已完成")
                else:
                    print(f"    ❌ 该题目未完成")
            else:
                print(f"    用户4无提交记录")
        
        # 模拟作业完成状态计算（针对用户4）
        print(f"\n=== 模拟作业完成状态计算（用户4） ===")
        
        for ap in assignment_problems:
            ass_id, ass_name, course_id, prob_id, prob_title, prob_type = ap
            print(f"\n作业: {ass_name} (ID: {ass_id})")
            
            # 获取该作业的所有题目
            cursor.execute("""
                SELECT ap2.problem_id, p2.title
                FROM assignment_problems ap2
                JOIN problem p2 ON ap2.problem_id = p2.id
                WHERE ap2.assignment_id = ?
            """, (ass_id,))
            all_problems = cursor.fetchall()
            
            total_problems = len(all_problems)
            completed_problems = 0
            
            print(f"  总题目数: {total_problems}")
            
            for prob in all_problems:
                prob_id, prob_title = prob
                print(f"    题目: {prob_title} (ID: {prob_id})")
                
                # 查看用户4的提交状态
                cursor.execute("""
                    SELECT status, result
                    FROM submission
                    WHERE user_id = 4 AND problem_id = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (prob_id,))
                submission = cursor.fetchone()
                
                if submission:
                    status, result = submission
                    print(f"      提交状态: {status}")
                    if status == 'accepted':
                        completed_problems += 1
                        print(f"      ✅ 已完成")
                    else:
                        print(f"      ❌ 未完成")
                else:
                    print(f"      无提交记录")
            
            completion_percentage = (completed_problems / total_problems * 100) if total_problems > 0 else 0
            is_completed = completed_problems == total_problems and total_problems > 0
            
            print(f"  完成进度: {completed_problems}/{total_problems} ({completion_percentage:.1f}%)")
            print(f"  作业状态: {'已完成' if is_completed else '进行中'}")
        
    except Exception as e:
        print(f"测试用户认证时出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    test_user_authentication()

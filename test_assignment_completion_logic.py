#!/usr/bin/env python3
"""
测试作业完成状态的计算逻辑
"""

import sqlite3
import json
from datetime import datetime

def test_assignment_completion_logic():
    """测试作业完成状态的计算逻辑"""
    print("=== 测试作业完成状态的计算逻辑 ===")
    
    conn = sqlite3.connect('judger.db')
    cursor = conn.cursor()
    
    try:
        # 1. 查看作业1的详细信息
        print("\n1. 作业1的详细信息:")
        cursor.execute("""
            SELECT id, name, course_id, teacher_id, created_at
            FROM assignments
            WHERE id = 1
        """)
        assignment = cursor.fetchone()
        if assignment:
            ass_id, name, course_id, teacher_id, created_at = assignment
            print(f"  作业ID: {ass_id}, 名称: {name}, 课程ID: {course_id}, 教师ID: {teacher_id}, 创建时间: {created_at}")
        
        # 2. 查看作业1包含的题目
        print("\n2. 作业1包含的题目:")
        cursor.execute("""
            SELECT ap.problem_id, p.title, p.type
            FROM assignment_problems ap
            JOIN problem p ON ap.problem_id = p.id
            WHERE ap.assignment_id = 1
        """)
        problems = cursor.fetchall()
        
        for prob in problems:
            prob_id, title, prob_type = prob
            print(f"  题目ID: {prob_id}, 标题: {title}, 类型: {prob_type}")
            
            # 3. 查看用户4对该题目的所有提交记录
            print(f"    用户4的提交记录:")
            cursor.execute("""
                SELECT id, status, result, created_at
                FROM submission
                WHERE user_id = 4 AND problem_id = ?
                ORDER BY created_at ASC
            """, (prob_id,))
            submissions = cursor.fetchall()
            
            if submissions:
                for sub in submissions:
                    sub_id, status, result, created_at = sub
                    print(f"      提交ID: {sub_id}, 状态: {status}, 结果: {result}, 时间: {created_at}")
                    
                    # 判断是否应该算作完成
                    if status == 'accepted':
                        print(f"      ✅ 状态为accepted，应该算作完成")
                    else:
                        print(f"      ❌ 状态为{status}，不应该算作完成")
            else:
                print(f"      无提交记录")
        
        # 4. 模拟作业完成状态计算逻辑
        print("\n3. 模拟作业完成状态计算逻辑:")
        
        total_problems = len(problems)
        completed_problems = 0
        
        print(f"  总题目数: {total_problems}")
        
        for prob in problems:
            prob_id, title, prob_type = prob
            print(f"    题目: {title} (ID: {prob_id})")
            
            # 查找最新提交
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
                print(f"      最新提交状态: {status}, 时间: {created_at}")
                
                # 按照当前逻辑判断
                if status == 'accepted':
                    completed_problems += 1
                    print(f"      ✅ 状态为accepted，完成进度+1")
                else:
                    print(f"      ❌ 状态为{status}，完成进度不变")
            else:
                print(f"      无提交记录，完成进度不变")
        
        # 计算最终结果
        completion_percentage = (completed_problems / total_problems * 100) if total_problems > 0 else 0
        is_completed = completed_problems == total_problems and total_problems > 0
        
        print(f"\n4. 最终计算结果:")
        print(f"  已完成题目数: {completed_problems}")
        print(f"  总题目数: {total_problems}")
        print(f"  完成率: {completion_percentage:.1f}%")
        print(f"  是否完成: {is_completed}")
        print(f"  状态文本: {'已完成' if is_completed else '进行中'}")
        
        # 5. 检查是否有历史提交记录
        print(f"\n5. 检查历史提交记录:")
        cursor.execute("""
            SELECT s.problem_id, s.status, s.created_at, p.title
            FROM submission s
            JOIN problem p ON s.problem_id = p.id
            WHERE s.user_id = 4
            ORDER BY s.created_at ASC
        """)
        all_submissions = cursor.fetchall()
        
        print(f"  用户4的所有提交记录:")
        for sub in all_submissions:
            prob_id, status, created_at, title = sub
            print(f"    题目: {title} (ID: {prob_id}), 状态: {status}, 时间: {created_at}")
        
    except Exception as e:
        print(f"测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    test_assignment_completion_logic()

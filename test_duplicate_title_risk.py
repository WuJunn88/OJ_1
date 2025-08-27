#!/usr/bin/env python3
"""
测试同名题目可能导致的错误完成状态判断
"""

import sqlite3
import json
from datetime import datetime

def test_duplicate_title_risk():
    """测试同名题目的风险"""
    print("=== 测试同名题目的风险 ===")
    
    conn = sqlite3.connect('judger.db')
    cursor = conn.cursor()
    
    try:
        # 1. 查看所有题目，检查是否有同名题目
        print("\n1. 检查是否有同名题目:")
        cursor.execute("""
            SELECT id, title, type, created_at
            FROM problem
            ORDER BY title, created_at
        """)
        problems = cursor.fetchall()
        
        # 按标题分组
        title_groups = {}
        for prob in problems:
            prob_id, title, prob_type, created_at = prob
            if title not in title_groups:
                title_groups[title] = []
            title_groups[title].append({
                'id': prob_id,
                'type': prob_type,
                'created_at': created_at
            })
        
        # 显示同名题目
        for title, prob_list in title_groups.items():
            if len(prob_list) > 1:
                print(f"  ⚠️  发现同名题目: '{title}'")
                for prob in prob_list:
                    print(f"    题目ID: {prob['id']}, 类型: {prob['type']}, 创建时间: {prob['created_at']}")
            else:
                print(f"  ✅ 题目: '{title}' (唯一)")
        
        # 2. 检查提交记录，看是否有基于题目ID的关联问题
        print(f"\n2. 检查提交记录的关联:")
        cursor.execute("""
            SELECT s.id, s.problem_id, s.status, s.created_at, p.title
            FROM submission s
            JOIN problem p ON s.problem_id = p.id
            WHERE s.user_id = 4
            ORDER BY s.created_at ASC
        """)
        submissions = cursor.fetchall()
        
        print(f"  用户4的所有提交记录:")
        for sub in submissions:
            sub_id, prob_id, status, created_at, title = sub
            print(f"    提交ID: {sub_id}, 题目ID: {prob_id}, 标题: '{title}', 状态: {status}, 时间: {created_at}")
        
        # 3. 模拟删除和重建题目的场景
        print(f"\n3. 模拟删除和重建题目的风险:")
        
        # 假设我们删除题目ID=7，然后创建一个新的同名题目
        print(f"  假设场景:")
        print(f"    1. 删除题目ID=7 ('寻找水仙花数')")
        print(f"    2. 创建新题目ID=9 ('寻找水仙花数'，但内容不同)")
        print(f"    3. 将新题目添加到作业中")
        
        # 检查如果新题目被添加到作业中会发生什么
        print(f"\n  风险分析:")
        print(f"    当前作业1包含题目ID=7")
        print(f"    如果删除题目ID=7，创建题目ID=9，并添加到作业中:")
        print(f"    学生对新题目的完成状态将基于历史提交记录判断")
        print(f"    这可能导致错误的完成状态！")
        
        # 4. 检查作业-题目关联的完整性
        print(f"\n4. 检查作业-题目关联的完整性:")
        cursor.execute("""
            SELECT ap.assignment_id, ap.problem_id, p.title, p.id
            FROM assignment_problems ap
            JOIN problem p ON ap.problem_id = p.id
            ORDER BY ap.assignment_id, ap.problem_id
        """)
        assignment_problems = cursor.fetchall()
        
        print(f"  当前作业-题目关联:")
        for ap in assignment_problems:
            ass_id, prob_id, title, prob_db_id = ap
            print(f"    作业ID: {ass_id}, 题目ID: {prob_id}, 标题: '{title}', 数据库ID: {prob_db_id}")
            
            # 检查题目是否仍然存在
            cursor.execute("SELECT id FROM problem WHERE id = ?", (prob_id,))
            problem_exists = cursor.fetchone()
            if problem_exists:
                print(f"      ✅ 题目仍然存在")
            else:
                print(f"      ❌ 题目已被删除！存在孤立引用！")
        
        # 5. 建议的解决方案
        print(f"\n5. 建议的解决方案:")
        print(f"  A. 软删除题目（标记为inactive而不是物理删除）")
        print(f"  B. 在作业完成状态计算中检查题目是否仍然存在")
        print(f"  C. 使用题目内容的哈希值来避免同名但内容不同的题目")
        print(f"  D. 在删除题目时检查是否有关联的作业")
        
    except Exception as e:
        print(f"测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

def test_orphaned_references():
    """测试孤立引用"""
    print(f"\n=== 测试孤立引用 ===")
    
    conn = sqlite3.connect('judger.db')
    cursor = conn.cursor()
    
    try:
        # 检查是否有孤立的作业-题目关联
        cursor.execute("""
            SELECT ap.assignment_id, ap.problem_id
            FROM assignment_problems ap
            LEFT JOIN problem p ON ap.problem_id = p.id
            WHERE p.id IS NULL
        """)
        orphaned_refs = cursor.fetchall()
        
        if orphaned_refs:
            print(f"  ❌ 发现孤立的作业-题目关联:")
            for ref in orphaned_refs:
                ass_id, prob_id = ref
                print(f"    作业ID: {ass_id}, 题目ID: {prob_id} (题目不存在)")
        else:
            print(f"  ✅ 没有发现孤立的作业-题目关联")
        
        # 检查是否有孤立的提交记录
        cursor.execute("""
            SELECT s.id, s.problem_id
            FROM submission s
            LEFT JOIN problem p ON s.problem_id = p.id
            WHERE p.id IS NULL
        """)
        orphaned_submissions = cursor.fetchall()
        
        if orphaned_submissions:
            print(f"  ❌ 发现孤立的提交记录:")
            for sub in orphaned_submissions:
                sub_id, prob_id = sub
                print(f"    提交ID: {sub_id}, 题目ID: {prob_id} (题目不存在)")
        else:
            print(f"  ✅ 没有发现孤立的提交记录")
            
    except Exception as e:
        print(f"测试孤立引用时出错: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    test_duplicate_title_risk()
    test_orphaned_references()

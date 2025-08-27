#!/usr/bin/env python3
"""
为现有数据库添加deleted_at字段的迁移脚本
"""

import sqlite3
import os

def migrate_database():
    """迁移数据库，添加deleted_at字段"""
    print("=== 数据库迁移：添加deleted_at字段 ===")
    
    # 数据库文件路径
    db_path = 'judger.db'
    
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件 {db_path} 不存在")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 1. 检查problem表是否存在deleted_at字段
        cursor.execute("PRAGMA table_info(problem)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'deleted_at' in column_names:
            print("✅ deleted_at字段已存在，无需迁移")
            return
        
        print("📝 开始添加deleted_at字段...")
        
        # 2. 添加deleted_at字段
        cursor.execute("ALTER TABLE problem ADD COLUMN deleted_at DATETIME")
        print("✅ 成功添加deleted_at字段")
        
        # 3. 为现有记录设置默认值
        cursor.execute("UPDATE problem SET deleted_at = NULL")
        print("✅ 为现有记录设置deleted_at默认值")
        
        # 4. 检查是否有孤立引用的题目
        print("\n🔍 检查孤立引用...")
        
        # 检查作业-题目关联
        cursor.execute("""
            SELECT ap.assignment_id, ap.problem_id
            FROM assignment_problems ap
            LEFT JOIN problem p ON ap.problem_id = p.id
            WHERE p.id IS NULL
        """)
        orphaned_refs = cursor.fetchall()
        
        if orphaned_refs:
            print(f"⚠️  发现 {len(orphaned_refs)} 个孤立的作业-题目关联:")
            for ref in orphaned_refs:
                ass_id, prob_id = ref
                print(f"    作业ID: {ass_id}, 题目ID: {prob_id}")
            
            # 清理孤立的关联
            cursor.execute("DELETE FROM assignment_problems WHERE problem_id NOT IN (SELECT id FROM problem)")
            print("✅ 已清理孤立的作业-题目关联")
        else:
            print("✅ 没有发现孤立的作业-题目关联")
        
        # 检查提交记录
        cursor.execute("""
            SELECT s.id, s.problem_id
            FROM submission s
            LEFT JOIN problem p ON s.problem_id = p.id
            WHERE p.id IS NULL
        """)
        orphaned_submissions = cursor.fetchall()
        
        if orphaned_submissions:
            print(f"⚠️  发现 {len(orphaned_submissions)} 条孤立的提交记录:")
            for sub in orphaned_submissions:
                sub_id, prob_id = sub
                print(f"    提交ID: {sub_id}, 题目ID: {prob_id}")
            
            # 清理孤立的提交记录
            cursor.execute("DELETE FROM submission WHERE problem_id NOT IN (SELECT id FROM problem)")
            print("✅ 已清理孤立的提交记录")
        else:
            print("✅ 没有发现孤立的提交记录")
        
        # 5. 提交更改
        conn.commit()
        print("✅ 数据库迁移完成！")
        
        # 6. 验证迁移结果
        print("\n🔍 验证迁移结果...")
        cursor.execute("PRAGMA table_info(problem)")
        columns = cursor.fetchall()
        print("problem表字段:")
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
        
        # 检查题目数量
        cursor.execute("SELECT COUNT(*) FROM problem")
        total_problems = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM problem WHERE is_active = 1")
        active_problems = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM problem WHERE is_active = 0")
        inactive_problems = cursor.fetchone()[0]
        
        print(f"\n题目统计:")
        print(f"  总题目数: {total_problems}")
        print(f"  活跃题目: {active_problems}")
        print(f"  已删除题目: {inactive_problems}")
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
题目数据迁移脚本
将数据从problems表迁移到problem表
"""

import sqlite3
import os

def migrate_problems():
    """迁移题目数据"""
    try:
        # 连接数据库
        conn = sqlite3.connect('judger.db')
        cursor = conn.cursor()
        
        print("🚀 开始迁移题目数据...")
        
        # 检查源表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='problems'")
        if not cursor.fetchone():
            print("❌ 源表problems不存在")
            return
        
        # 检查目标表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='problem'")
        if not cursor.fetchone():
            print("❌ 目标表problem不存在")
            return
        
        # 获取源表数据
        cursor.execute("SELECT COUNT(*) FROM problems")
        source_count = cursor.fetchone()[0]
        print(f"📊 源表problems中有 {source_count} 个题目")
        
        # 获取目标表当前数据
        cursor.execute("SELECT COUNT(*) FROM problem")
        target_count = cursor.fetchone()[0]
        print(f"📊 目标表problem中当前有 {target_count} 个题目")
        
        # 迁移数据
        cursor.execute("""
            INSERT INTO problem (title, description, type, test_cases, expected_output, 
                                difficulty, time_limit, memory_limit, created_by, is_active)
            SELECT 
                title,
                COALESCE(description, '') as description,
                'programming' as type,
                '' as test_cases,
                '' as expected_output,
                COALESCE(difficulty, 'medium') as difficulty,
                COALESCE(time_limit, 1000) as time_limit,
                COALESCE(memory_limit, 256) as memory_limit,
                NULL as created_by,
                1 as is_active
            FROM problems
            WHERE title NOT IN (SELECT title FROM problem)
        """)
        
        # 获取迁移后的数据
        cursor.execute("SELECT COUNT(*) FROM problem")
        new_target_count = cursor.fetchone()[0]
        migrated_count = new_target_count - target_count
        
        print(f"✅ 迁移完成!")
        print(f"📊 迁移了 {migrated_count} 个题目")
        print(f"📊 目标表现在共有 {new_target_count} 个题目")
        
        # 提交更改
        conn.commit()
        
        # 显示一些示例数据
        cursor.execute("SELECT title, difficulty, type FROM problem ORDER BY id DESC LIMIT 5")
        problems = cursor.fetchall()
        print(f"\n📝 最新添加的题目:")
        for problem in problems:
            print(f"  - {problem[0]} ({problem[1]}, {problem[2]})")
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        conn.rollback()
    finally:
        conn.close()
        print("🔒 数据库连接已关闭")

def main():
    """主函数"""
    print("🚀 题目数据迁移工具")
    print("=" * 50)
    
    migrate_problems()
    
    print("\n" + "=" * 50)
    print("🏁 程序结束")

if __name__ == "__main__":
    main()

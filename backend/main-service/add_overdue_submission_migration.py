#!/usr/bin/env python3
"""
补交作业功能数据库迁移脚本
为作业表添加补交相关字段，支持逾期提交白名单和得分比例控制
"""

import os
import sys
import sqlite3
from datetime import datetime

def add_overdue_submission_fields():
    """为作业表添加补交相关字段"""
    
    # 获取数据库路径
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.dirname(current_dir)
    project_root = os.path.dirname(backend_root)
    db_path = os.path.join(project_root, 'judger.db')
    
    print(f"正在连接数据库: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(assignments)")
        columns = [column[1] for column in cursor.fetchall()]
        
        print(f"当前表字段: {columns}")
        
        # 添加补交相关字段
        new_fields = [
            ("overdue_allow_user_ids", "TEXT DEFAULT '[]'", "逾期提交白名单用户ID列表(JSON格式)"),
            ("overdue_score_ratio", "REAL DEFAULT 0.8", "逾期提交得分比例(0.0-1.0)"),
            ("overdue_deadline", "DATETIME", "补交截止时间"),
            ("allow_overdue_submission", "BOOLEAN DEFAULT 0", "是否允许补交作业")
        ]
        
        for field_name, field_type, description in new_fields:
            if field_name not in columns:
                print(f"添加字段: {field_name} ({field_type}) - {description}")
                cursor.execute(f"ALTER TABLE assignments ADD COLUMN {field_name} {field_type}")
            else:
                print(f"字段已存在: {field_name}")
        
        # 为提交表添加逾期标记字段
        cursor.execute("PRAGMA table_info(submission)")
        submission_columns = [column[1] for column in cursor.fetchall()]
        
        if "is_overdue" not in submission_columns:
            print("添加字段: is_overdue (BOOLEAN DEFAULT 0) - 是否为逾期提交")
            cursor.execute("ALTER TABLE submission ADD COLUMN is_overdue BOOLEAN DEFAULT 0")
        else:
            print("字段已存在: is_overdue")
        
        # 创建索引优化查询性能
        indexes = [
            ("idx_assignment_overdue_deadline", "assignments", "overdue_deadline"),
            ("idx_submission_is_overdue", "submission", "is_overdue"),
            ("idx_submission_assignment_overdue", "submission", "assignment_id, is_overdue")
        ]
        
        for index_name, table_name, columns in indexes:
            try:
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns})")
                print(f"创建索引: {index_name}")
            except Exception as e:
                print(f"索引创建失败: {index_name} - {e}")
        
        # 提交更改
        conn.commit()
        print("✅ 数据库迁移完成！")
        
        # 显示更新后的表结构
        print("\n📋 更新后的表结构:")
        cursor.execute("PRAGMA table_info(assignments)")
        for column in cursor.fetchall():
            print(f"  {column[1]} ({column[2]}) - {column[3] if column[3] else 'NULL'}")
        
        print("\n📋 提交表结构:")
        cursor.execute("PRAGMA table_info(submission)")
        for column in cursor.fetchall():
            print(f"  {column[1]} ({column[2]}) - {column[3] if column[3] else 'NULL'}")
        
    except Exception as e:
        print(f"❌ 数据库迁移失败: {e}")
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🚀 开始补交作业功能数据库迁移...")
    add_overdue_submission_fields()
    print("🎉 迁移完成！")

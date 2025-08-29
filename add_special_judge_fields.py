#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库迁移脚本：为Problem表添加Special Judge相关字段
"""

import sqlite3
import os

def add_special_judge_fields():
    """为Problem表添加Special Judge相关字段"""
    
    # 数据库路径（项目根目录）
    db_path = "judger.db"
    
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}")
        return False
    
    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 检查现有字段...")
        
        # 获取表结构
        cursor.execute("PRAGMA table_info(problem)")
        columns = [column[1] for column in cursor.fetchall()]
        
        print(f"现有字段: {columns}")
        
        # 需要添加的字段
        new_fields = [
            ("enable_special_judge", "BOOLEAN DEFAULT 0"),
            ("special_judge_script", "TEXT"),
            ("special_judge_language", "VARCHAR(20) DEFAULT 'python'"),
            ("special_judge_timeout", "INTEGER DEFAULT 5000"),
            ("special_judge_memory_limit", "INTEGER DEFAULT 256"),
            ("judge_config", "TEXT")
        ]
        
        # 添加新字段
        for field_name, field_type in new_fields:
            if field_name not in columns:
                print(f"➕ 添加字段: {field_name} {field_type}")
                cursor.execute(f"ALTER TABLE problem ADD COLUMN {field_name} {field_type}")
            else:
                print(f"✅ 字段已存在: {field_name}")
        
        # 提交更改
        conn.commit()
        
        # 验证字段是否添加成功
        cursor.execute("PRAGMA table_info(problem)")
        new_columns = [column[1] for column in cursor.fetchall()]
        print(f"更新后字段: {new_columns}")
        
        # 检查是否有题目数据
        cursor.execute("SELECT COUNT(*) FROM problem")
        problem_count = cursor.fetchone()[0]
        print(f"📊 题目总数: {problem_count}")
        
        if problem_count > 0:
            # 为现有题目设置默认值
            print("🔄 为现有题目设置默认值...")
            cursor.execute("""
                UPDATE problem SET 
                enable_special_judge = 0,
                special_judge_language = 'python',
                special_judge_timeout = 5000,
                special_judge_memory_limit = 256
                WHERE enable_special_judge IS NULL
            """)
            conn.commit()
            print("✅ 默认值设置完成")
        
        conn.close()
        print("🎉 Special Judge字段添加完成！")
        return True
        
    except Exception as e:
        print(f"❌ 添加字段失败: {str(e)}")
        if 'conn' in locals():
            conn.close()
        return False

def create_sample_special_judge_problem():
    """创建示例Special Judge题目"""
    
    db_path = "judger.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 创建浮点数比较题目
        print("📝 创建浮点数比较示例题目...")
        
        cursor.execute("""
            INSERT INTO problem (
                title, description, type, test_cases, expected_output,
                difficulty, time_limit, memory_limit, created_by, is_active,
                enable_special_judge, special_judge_language, special_judge_timeout,
                special_judge_memory_limit, judge_config
            ) VALUES (
                '浮点数计算精度测试',
                '计算圆的面积，结果允许一定的浮点数误差。\n\n输入：半径r\n输出：面积π*r²\n\n注意：由于浮点数精度问题，结果允许1e-6的误差。',
                'programming',
                '2\n3.5\n10.0',
                '38.48451000647496\n314.1592653589793',
                'medium',
                1000,
                128,
                1,
                1,
                1,
                'python',
                5000,
                256,
                '{"type": "float", "epsilon": 1e-6, "relative_error": 1e-6}'
            )
        """)
        
        # 创建多解题目
        print("📝 创建多解示例题目...")
        
        cursor.execute("""
            INSERT INTO problem (
                title, description, type, test_cases, expected_output,
                difficulty, time_limit, memory_limit, created_by, is_active,
                enable_special_judge, special_judge_language, special_judge_timeout,
                special_judge_memory_limit, judge_config
            ) VALUES (
                '数组排序（多解）',
                '对数组进行排序，输出可以是升序或降序。\n\n输入：n个整数\n输出：排序后的数组\n\n注意：升序和降序都是正确答案。',
                'programming',
                '3\n5 2 8\n4\n1 3 2 4',
                '2 5 8\n1 2 3 4',
                'easy',
                1000,
                128,
                1,
                1,
                1,
                'python',
                5000,
                256,
                '{"type": "multiple_solutions", "solutions": ["2 5 8", "8 5 2", "1 2 3 4", "4 3 2 1"]}'
            )
        """)
        
        # 创建格式要求题目
        print("📝 创建格式要求示例题目...")
        
        cursor.execute("""
            INSERT INTO problem (
                title, description, type, test_cases, expected_output,
                difficulty, time_limit, memory_limit, created_by, is_active,
                enable_special_judge, special_judge_language, special_judge_timeout,
                special_judge_memory_limit, judge_config
            ) VALUES (
                '矩阵输出（格式要求）',
                '输出一个n×n的矩阵，每个数字后面跟一个空格，每行末尾没有空格。\n\n输入：矩阵大小n\n输出：n×n矩阵\n\n注意：格式要求严格，每个数字后必须有空格，行末不能有空格。',
                'programming',
                '3\n2',
                '1 2 3\n4 5 6\n7 8 9\n1 2\n3 4',
                'medium',
                1000,
                128,
                1,
                1,
                1,
                'python',
                5000,
                256,
                '{"type": "format", "line_count": true, "line_format": "^[0-9]+( [0-9]+)*$"}'
            )
        """)
        
        conn.commit()
        print("✅ 示例题目创建完成！")
        
        # 显示创建的题目
        cursor.execute("""
            SELECT id, title, enable_special_judge, judge_config 
            FROM problem 
            WHERE enable_special_judge = 1
        """)
        
        special_judge_problems = cursor.fetchall()
        print(f"\n📋 Special Judge题目列表:")
        for problem in special_judge_problems:
            print(f"  ID: {problem[0]}, 标题: {problem[1]}")
            print(f"  配置: {problem[3]}")
            print()
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ 创建示例题目失败: {str(e)}")
        if 'conn' in locals():
            conn.close()
        return False

if __name__ == "__main__":
    print("🚀 开始添加Special Judge字段...")
    
    if add_special_judge_fields():
        print("\n🎯 是否创建示例Special Judge题目？(y/n): ", end="")
        choice = input().strip().lower()
        
        if choice in ['y', 'yes', '是']:
            create_sample_special_judge_problem()
    
    print("\n✨ 迁移完成！")

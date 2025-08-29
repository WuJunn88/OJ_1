#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化版题目导入脚本
直接导入到当前OJ系统
"""

import os
import json
import sqlite3
import time
from pathlib import Path

def connect_database():
    """连接数据库"""
    try:
        # 尝试连接主数据库
        db_path = "backend/main-service/judger.db"
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            print(f"✅ 连接到数据库: {db_path}")
            return conn
        
        # 尝试连接其他数据库
        db_path = "judger.db"
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            print(f"✅ 连接到数据库: {db_path}")
            return conn
        
        print("❌ 未找到数据库文件")
        return None
    except Exception as e:
        print(f"❌ 连接数据库失败: {e}")
        return None

def create_problems_table(conn):
    """创建题目表（如果不存在）"""
    try:
        cursor = conn.cursor()
        
        # 检查problem表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='problem'")
        if cursor.fetchone():
            print("✅ problem表已存在，跳过创建")
            return True
        
        # 创建与后端模型匹配的题目表
        cursor.execute('''
            CREATE TABLE problem (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                type VARCHAR(20) DEFAULT 'programming',
                test_cases TEXT,
                expected_output TEXT,
                choice_options TEXT,
                is_multiple_choice BOOLEAN DEFAULT 0,
                difficulty VARCHAR(20) DEFAULT 'easy',
                time_limit INTEGER DEFAULT 1000,
                memory_limit INTEGER DEFAULT 128,
                created_by INTEGER,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME
            )
        ''')
        
        conn.commit()
        print("✅ 题目表创建完成")
        return True
    except Exception as e:
        print(f"❌ 创建表失败: {e}")
        return False

def parse_problem_json(problem_file_path):
    """解析题目JSON文件"""
    try:
        with open(problem_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 提取题目信息
        problem = {
            'title': data.get('title', ''),
            'description': data.get('description', {}).get('value', ''),
            'input_description': data.get('input_description', {}).get('value', ''),
            'output_description': data.get('output_description', {}).get('value', ''),
            'hint': data.get('hint', {}).get('value', ''),
            'time_limit': data.get('time_limit', 1000),
            'memory_limit': data.get('memory_limit', 256),
            'difficulty': 'medium',  # 默认难度
            'type': 'programming'    # 默认类型
        }
        
        return problem
    except Exception as e:
        print(f"解析题目文件失败 {problem_file_path}: {e}")
        return None

def read_test_case_files(testcase_dir):
    """读取测试用例文件"""
    test_cases = []
    
    try:
        if not os.path.exists(testcase_dir):
            return test_cases
        
        # 查找所有.in和.out文件
        input_files = [f for f in os.listdir(testcase_dir) if f.endswith('.in') and not f.startswith('._')]
        
        for input_file in input_files:
            output_file = input_file.replace('.in', '.out')
            output_path = os.path.join(testcase_dir, output_file)
            
            if os.path.exists(output_path):
                # 读取输入
                with open(os.path.join(testcase_dir, input_file), 'r', encoding='utf-8') as f:
                    input_content = f.read().strip()
                
                # 读取输出
                with open(output_path, 'r', encoding='utf-8') as f:
                    output_content = f.read().strip()
                
                test_cases.append({
                    'input': input_content,
                    'output': output_content
                })
        
        return test_cases
    except Exception as e:
        print(f"读取测试用例失败 {testcase_dir}: {e}")
        return []

def insert_problem_to_db(conn, problem_data, test_cases):
    """将题目插入数据库"""
    try:
        cursor = conn.cursor()
        
        # 准备测试用例数据
        test_cases_text = ""
        expected_output_text = ""
        
        if test_cases:
            # 将测试用例转换为文本格式
            test_cases_list = []
            for i, test_case in enumerate(test_cases):
                test_cases_list.append(f"测试用例{i+1}:\n输入: {test_case['input']}\n输出: {test_case['output']}")
            test_cases_text = "\n\n".join(test_cases_list)
            
            # 使用第一个测试用例的输出作为期望输出
            if test_cases:
                expected_output_text = test_cases[0]['output']
        
        # 插入题目
        cursor.execute('''
            INSERT INTO problem (title, description, type, test_cases, expected_output, 
                                difficulty, time_limit, memory_limit, created_by, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            problem_data['title'],
            problem_data['description'],
            'programming',  # 默认类型
            test_cases_text,
            expected_output_text,
            'medium',  # 默认难度
            problem_data['time_limit'],
            problem_data['memory_limit'],
            None,  # created_by
            1      # is_active
        ))
        
        problem_id = cursor.lastrowid
        
        conn.commit()
        print(f"✅ 题目插入成功: {problem_data['title']} (ID: {problem_id})")
        return True
        
    except Exception as e:
        print(f"❌ 插入题目失败: {problem_data['title']} - {e}")
        conn.rollback()
        return False

def import_all_problems(problems_dir, conn):
    """导入所有题目"""
    print(f"🚀 开始导入题目，源目录: {problems_dir}")
    
    # 获取所有题目文件夹
    problem_dirs = []
    for item in os.listdir(problems_dir):
        item_path = os.path.join(problems_dir, item)
        if os.path.isdir(item_path) and item.isdigit():
            problem_dirs.append(int(item))
    
    problem_dirs.sort()
    print(f"📁 发现 {len(problem_dirs)} 个题目文件夹")
    
    success_count = 0
    failed_count = 0
    
    for problem_id in problem_dirs:
        problem_dir = os.path.join(problems_dir, str(problem_id))
        problem_json = os.path.join(problem_dir, 'problem.json')
        testcase_dir = os.path.join(problem_dir, 'testcase')
        
        print(f"\n📝 处理题目 {problem_id}...")
        
        # 检查题目文件是否存在
        if not os.path.exists(problem_json):
            print(f"⚠️ 题目文件不存在: {problem_json}")
            failed_count += 1
            continue
        
        # 解析题目信息
        problem_data = parse_problem_json(problem_json)
        if not problem_data:
            print(f"⚠️ 解析题目失败: {problem_id}")
            failed_count += 1
            continue
        
        # 读取测试用例
        test_cases = read_test_case_files(testcase_dir)
        if test_cases:
            print(f"📋 读取到 {len(test_cases)} 个测试用例")
        else:
            print(f"⚠️ 未找到测试用例")
        
        # 插入数据库
        if insert_problem_to_db(conn, problem_data, test_cases):
            success_count += 1
        else:
            failed_count += 1
        
        # 添加延迟
        time.sleep(0.1)
    
    print(f"\n🎉 导入完成!")
    print(f"✅ 成功: {success_count} 个")
    print(f"❌ 失败: {failed_count} 个")
    print(f"📊 总计: {len(problem_dirs)} 个")

def main():
    """主函数"""
    print("🚀 OJ系统题目批量导入工具")
    print("=" * 50)
    
    # 检查Problems_1目录是否存在
    problems_dir = "Problems_1"
    if not os.path.exists(problems_dir):
        print(f"❌ 题目目录不存在: {problems_dir}")
        return
    
    # 连接数据库
    conn = connect_database()
    if not conn:
        return
    
    try:
        # 创建表
        if not create_problems_table(conn):
            return
        
        # 开始导入
        import_all_problems(problems_dir, conn)
        
    except KeyboardInterrupt:
        print("\n⚠️ 用户中断导入")
    except Exception as e:
        print(f"❌ 导入过程中发生错误: {e}")
    finally:
        conn.close()
        print("🔒 数据库连接已关闭")
    
    print("\n" + "=" * 50)
    print("🏁 程序结束")

if __name__ == "__main__":
    main()

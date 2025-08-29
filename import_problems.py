#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量导入题目脚本
从Problems_1文件夹导入题目到OJ系统
"""

import os
import json
import requests
import time
from pathlib import Path

# 配置
API_BASE_URL = "http://localhost:5001"
ADMIN_TOKEN = "your-admin-token-here"  # 需要替换为实际的管理员token

def get_admin_token():
    """获取管理员token"""
    try:
        # 尝试从环境变量获取
        token = os.environ.get('ADMIN_TOKEN')
        if token:
            return token
        
        # 如果没有环境变量，提示用户输入
        print("请输入管理员token:")
        token = input().strip()
        return token
    except Exception as e:
        print(f"获取token失败: {e}")
        return None

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
            'type': 'programming',   # 默认类型
            'test_cases': []
        }
        
        # 处理测试用例
        if 'test_case_score' in data:
            for test_case in data['test_case_score']:
                test_case_info = {
                    'input_name': test_case.get('input_name', ''),
                    'output_name': test_case.get('output_name', ''),
                    'score': test_case.get('score', 100)
                }
                problem['test_cases'].append(test_case_info)
        
        # 处理示例
        if 'samples' in data:
            for i, sample in enumerate(data['samples']):
                problem[f'sample_input_{i+1}'] = sample.get('input', '')
                problem[f'sample_output_{i+1}'] = sample.get('output', '')
        
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

def create_problem_in_system(problem_data, test_cases, token):
    """在系统中创建题目"""
    try:
        # 准备题目数据
        problem_payload = {
            'title': problem_data['title'],
            'description': problem_data['description'],
            'input_description': problem_data['input_description'],
            'output_description': problem_data['output_description'],
            'hint': problem_data['hint'],
            'time_limit': problem_data['time_limit'],
            'memory_limit': problem_data['memory_limit'],
            'difficulty': problem_data['difficulty'],
            'type': problem_data['type'],
            'test_cases': test_cases
        }
        
        # 调用API创建题目
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        response = requests.post(
            f'{API_BASE_URL}/problems',
            headers=headers,
            json=problem_payload,
            timeout=30
        )
        
        if response.status_code == 201:
            result = response.json()
            print(f"✅ 题目创建成功: {problem_data['title']} (ID: {result.get('id', 'N/A')})")
            return True
        else:
            print(f"❌ 题目创建失败: {problem_data['title']}")
            print(f"状态码: {response.status_code}")
            print(f"错误信息: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 创建题目异常: {problem_data['title']} - {e}")
        return False

def import_all_problems(problems_dir, token):
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
        
        # 创建题目
        if create_problem_in_system(problem_data, test_cases, token):
            success_count += 1
        else:
            failed_count += 1
        
        # 添加延迟，避免API请求过于频繁
        time.sleep(0.5)
    
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
    
    # 获取管理员token
    token = get_admin_token()
    if not token:
        print("❌ 无法获取管理员token")
        return
    
    print(f"🔑 使用token: {token[:20]}...")
    
    # 开始导入
    try:
        import_all_problems(problems_dir, token)
    except KeyboardInterrupt:
        print("\n⚠️ 用户中断导入")
    except Exception as e:
        print(f"❌ 导入过程中发生错误: {e}")
    
    print("\n" + "=" * 50)
    print("🏁 程序结束")

if __name__ == "__main__":
    main()

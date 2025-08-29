#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试修复后的课程学生API
"""

import requests
import json

# 配置
BASE_URL = "http://localhost:5001"
TOKEN = "your_token_here"  # 请替换为实际的token

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def test_get_course_students(course_id):
    """测试获取课程学生列表"""
    url = f"{BASE_URL}/courses/{course_id}/students"
    print(f"GET {url}")
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("=== 课程学生API测试 ===\n")
    
    # 测试课程ID为1的学生列表
    course_id = 1
    students = test_get_course_students(course_id)
    
    if students:
        print(f"\n课程 {course_id} 的学生数量: {len(students)}")
        for i, student in enumerate(students):
            print(f"学生 {i+1}: ID={student.get('id')}, 姓名={student.get('name')}, 学号={student.get('username')}")

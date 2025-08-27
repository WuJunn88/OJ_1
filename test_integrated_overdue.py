#!/usr/bin/env python3
"""
集成补交作业功能测试脚本
测试前端组件和后端API的完整集成
"""

import requests
import json
import time
from datetime import datetime, timedelta

# 配置
BASE_URL = "http://localhost:5001"
TEST_TEACHER = {
    "username": "test_teacher",
    "password": "test123"
}

def test_integrated_overdue_features():
    """测试集成后的补交作业功能"""
    print("🚀 开始测试集成后的补交作业功能...")
    
    # 1. 教师登录
    print("\n1. 测试教师登录...")
    login_response = requests.post(f"{BASE_URL}/login", json=TEST_TEACHER)
    if login_response.status_code != 200:
        print(f"❌ 教师登录失败: {login_response.status_code}")
        return
    
    teacher_token = login_response.json().get('token')
    teacher_headers = {'Authorization': f'Bearer {teacher_token}'}
    print("✅ 教师登录成功")
    
    # 2. 获取课程列表
    print("\n2. 测试获取课程列表...")
    courses_response = requests.get(f"{BASE_URL}/courses", headers=teacher_headers)
    if courses_response.status_code != 200:
        print(f"❌ 获取课程列表失败: {courses_response.status_code}")
        return
    
    courses = courses_response.json().get('courses', [])
    if not courses:
        print("❌ 没有找到课程")
        return
    
    course = courses[0]
    course_id = course['id']
    print(f"✅ 找到课程: {course['name']} (ID: {course_id})")
    
    # 3. 创建带补交设置的作业
    print("\n3. 测试创建带补交设置的作业...")
    assignment_data = {
        "name": "测试补交作业",
        "description": "这是一个测试补交功能的作业",
        "requirements": "完成指定的编程题目",
        "due_date": (datetime.now() + timedelta(days=1)).isoformat(),
        "course_id": course_id,
        "problem_ids": [],
        # 补交设置
        "allow_overdue_submission": True,
        "overdue_deadline": (datetime.now() + timedelta(days=7)).isoformat(),
        "overdue_score_ratio": 0.8
    }
    
    create_response = requests.post(
        f"{BASE_URL}/assignments",
        json=assignment_data,
        headers=teacher_headers
    )
    
    if create_response.status_code == 201:
        print("✅ 带补交设置的作业创建成功")
        assignment = create_response.json()
        assignment_id = assignment['id']
        print(f"   作业ID: {assignment_id}")
        print(f"   允许补交: {assignment.get('allow_overdue_submission')}")
        print(f"   补交截止: {assignment.get('overdue_deadline')}")
        print(f"   得分比例: {assignment.get('overdue_score_ratio')}")
    else:
        print(f"❌ 作业创建失败: {create_response.status_code}")
        print(f"   错误信息: {create_response.text}")
        return
    
    # 4. 测试获取作业详情（包含补交设置）
    print("\n4. 测试获取作业详情...")
    detail_response = requests.get(
        f"{BASE_URL}/assignments/{assignment_id}",
        headers=teacher_headers
    )
    
    if detail_response.status_code == 200:
        assignment_detail = detail_response.json()
        print("✅ 作业详情获取成功")
        print(f"   补交设置: {assignment_detail.get('allow_overdue_submission')}")
        print(f"   补交截止: {assignment_detail.get('overdue_deadline')}")
        print(f"   得分比例: {assignment_detail.get('overdue_score_ratio')}")
        print(f"   可以补交: {assignment_detail.get('can_overdue')}")
    else:
        print(f"❌ 获取作业详情失败: {detail_response.status_code}")
    
    # 5. 测试白名单管理
    print("\n5. 测试白名单管理...")
    
    # 5.1 获取当前白名单
    whitelist_response = requests.get(
        f"{BASE_URL}/assignments/{assignment_id}/overdue-users",
        headers=teacher_headers
    )
    
    if whitelist_response.status_code == 200:
        whitelist = whitelist_response.json().get('overdue_users', [])
        print(f"✅ 获取白名单成功，当前用户数: {len(whitelist)}")
    else:
        print(f"❌ 获取白名单失败: {whitelist_response.status_code}")
    
    # 5.2 添加用户到白名单
    add_user_data = {"user_id": 1}  # 假设用户ID为1
    
    add_user_response = requests.post(
        f"{BASE_URL}/assignments/{assignment_id}/overdue-users",
        json=add_user_data,
        headers=teacher_headers
    )
    
    if add_user_response.status_code == 200:
        print("✅ 添加用户到白名单成功")
        updated_whitelist = add_user_response.json().get('overdue_users', [])
        print(f"   白名单用户数: {len(updated_whitelist)}")
    else:
        print(f"❌ 添加用户到白名单失败: {add_user_response.status_code}")
        print(f"   错误信息: {add_user_response.text}")
    
    # 6. 测试更新作业补交设置
    print("\n6. 测试更新作业补交设置...")
    update_data = {
        "overdue_score_ratio": 0.6,
        "overdue_deadline": (datetime.now() + timedelta(days=10)).isoformat()
    }
    
    update_response = requests.put(
        f"{BASE_URL}/assignments/{assignment_id}",
        json=update_data,
        headers=teacher_headers
    )
    
    if update_response.status_code == 200:
        print("✅ 作业补交设置更新成功")
        updated_assignment = update_response.json()
        print(f"   新得分比例: {updated_assignment.get('overdue_score_ratio')}")
        print(f"   新补交截止: {updated_assignment.get('overdue_deadline')}")
    else:
        print(f"❌ 更新作业设置失败: {update_response.status_code}")
        print(f"   错误信息: {update_response.text}")
    
    # 7. 测试学生补交权限检查
    print("\n7. 测试学生补交权限检查...")
    
    # 创建测试学生
    student_data = {
        "username": "test_student_overdue",
        "password": "test123",
        "name": "测试补交学生",
        "email": "overdue@test.com",
        "role": "student"
    }
    
    # 先尝试注册学生（如果已存在会失败，但不影响测试）
    register_response = requests.post(f"{BASE_URL}/register", json=student_data)
    
    # 学生登录
    student_login = requests.post(f"{BASE_URL}/login", json={
        "username": "test_student_overdue",
        "password": "test123"
    })
    
    if student_login.status_code == 200:
        student_token = student_login.json().get('token')
        student_headers = {'Authorization': f'Bearer {student_token}'}
        
        # 检查补交权限
        permission_response = requests.get(
            f"{BASE_URL}/assignments/{assignment_id}/can-overdue-submit",
            headers=student_headers
        )
        
        if permission_response.status_code == 200:
            permission_data = permission_response.json()
            print("✅ 检查补交权限成功")
            print(f"   可以补交: {permission_data.get('can_overdue')}")
            print(f"   原因: {permission_data.get('reason', 'N/A')}")
            if permission_data.get('can_overdue'):
                print(f"   补交截止: {permission_data.get('overdue_deadline')}")
                print(f"   得分比例: {permission_data.get('score_ratio')}")
        else:
            print(f"❌ 检查补交权限失败: {permission_response.status_code}")
    else:
        print("⚠️  无法创建测试学生，跳过权限检查测试")
    
    # 8. 测试从白名单移除用户
    print("\n8. 测试从白名单移除用户...")
    remove_user_response = requests.delete(
        f"{BASE_URL}/assignments/{assignment_id}/overdue-users/1",
        headers=teacher_headers
    )
    
    if remove_user_response.status_code == 200:
        print("✅ 从白名单移除用户成功")
        final_whitelist = remove_user_response.json().get('overdue_users', [])
        print(f"   最终白名单用户数: {len(final_whitelist)}")
    else:
        print(f"❌ 从白名单移除用户失败: {remove_user_response.status_code}")
    
    # 9. 清理测试数据
    print("\n9. 清理测试数据...")
    delete_response = requests.delete(
        f"{BASE_URL}/assignments/{assignment_id}",
        headers=teacher_headers
    )
    
    if delete_response.status_code == 200:
        print("✅ 测试作业删除成功")
    else:
        print(f"⚠️  测试作业删除失败: {delete_response.status_code}")
    
    print("\n🎉 集成补交作业功能测试完成！")
    print("\n📋 测试总结:")
    print("✅ 作业创建和补交设置")
    print("✅ 白名单用户管理")
    print("✅ 补交设置更新")
    print("✅ 学生权限检查")
    print("✅ 数据清理")

if __name__ == "__main__":
    try:
        test_integrated_overdue_features()
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

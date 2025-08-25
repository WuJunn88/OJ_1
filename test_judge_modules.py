#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判题模块测试脚本
测试选择题、判断题和简答题的判题逻辑
"""

import sys
import os

# 添加当前目录到路径（因为test_judge_modules.py和judge.py在同一目录）
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

def test_choice_problem_judging():
    """测试选择题判题逻辑"""
    print("=== 测试选择题判题逻辑 ===")
    
    # 模拟题目和提交数据
    class MockProblem:
        def __init__(self, expected_output):
            self.expected_output = expected_output
            self.type = 'choice'
    
    class MockSubmission:
        def __init__(self, code):
            self.code = code
            self.status = 'pending'
            self.result = ''
            self.execution_time = 0.0
    
    class MockSession:
        def commit(self):
            pass
    
    # 测试用例
    test_cases = [
        # (用户答案, 正确答案, 期望结果)
        ("A", "A", "accepted"),
        ("a", "A", "accepted"),  # 大小写不敏感
        (" A ", "A", "accepted"),  # 空格不敏感
        ("B", "A", "wrong_answer"),
        ("", "A", "wrong_answer"),  # 空答案
        ("A,B", "A,B", "accepted"),  # 多选题
        ("B,A", "A,B", "accepted"),  # 多选题顺序不敏感
    ]
    
    for user_answer, correct_answer, expected_status in test_cases:
        problem = MockProblem(correct_answer)
        submission = MockSubmission(user_answer)
        session = MockSession()
        
        # 调用判题函数
        result = judge_choice_problem(submission, problem, session)
        
        print(f"用户答案: '{user_answer}' | 正确答案: '{correct_answer}' | 结果: {submission.status} | 期望: {expected_status}")
        if submission.status != expected_status:
            print(f"  ❌ 测试失败！期望状态: {expected_status}, 实际状态: {submission.status}")
        else:
            print(f"   ✅ 测试通过")
        print(f"  判题结果: {submission.result}")
        print()

def test_judge_problem_judging():
    """测试判断题判题逻辑"""
    print("=== 测试判断题判题逻辑 ===")
    
    class MockProblem:
        def __init__(self, expected_output):
            self.expected_output = expected_output
            self.type = 'judge'
    
    class MockSubmission:
        def __init__(self, code):
            self.code = code
            self.status = 'pending'
            self.result = ''
            self.execution_time = 0.0
    
    class MockSession:
        def commit(self):
            pass
    
    # 测试用例
    test_cases = [
        # (用户答案, 正确答案, 期望结果)
        ("true", "true", "accepted"),
        ("True", "true", "accepted"),  # 大小写不敏感
        ("T", "true", "accepted"),  # 缩写支持
        ("对", "true", "accepted"),  # 中文支持
        ("正确", "true", "accepted"),  # 中文支持
        ("false", "true", "wrong_answer"),
        ("", "true", "wrong_answer"),  # 空答案
        ("yes", "true", "accepted"),  # 其他表示方式
        ("1", "true", "accepted"),  # 数字表示
    ]
    
    for user_answer, correct_answer, expected_status in test_cases:
        problem = MockProblem(correct_answer)
        submission = MockSubmission(user_answer)
        session = MockSession()
        
        # 调用判题函数
        result = judge_judge_problem(submission, problem, session)
        
        print(f"用户答案: '{user_answer}' | 正确答案: '{correct_answer}' | 结果: {submission.status} | 期望: {expected_status}")
        if submission.status != expected_status:
            print(f"  ❌ 测试失败！期望状态: {expected_status}, 实际状态: {submission.status}")
        else:
            print(f"   ✅ 测试通过")
        print(f"  判题结果: {submission.result}")
        print()

def test_short_answer_problem_judging():
    """测试简答题判题逻辑"""
    print("=== 测试简答题判题逻辑 ===")
    
    class MockProblem:
        def __init__(self, expected_output):
            self.expected_output = expected_output
            self.type = 'short_answer'
    
    class MockSubmission:
        def __init__(self, code):
            self.code = code
            self.status = 'pending'
            self.result = ''
            self.execution_time = 0.0
    
    class MockSession:
        def commit(self):
            pass
    
    # 测试用例
    test_cases = [
        # (用户答案, 参考答案, 期望结果)
        ("Python是一种编程语言", "Python是一种编程语言", "accepted"),  # 完全匹配
        ("python是一种编程语言", "Python是一种编程语言", "accepted"),  # 大小写不敏感
        ("Python是编程语言", "Python是一种编程语言", "partially_correct"),  # 部分匹配
        ("Java是一种编程语言", "Python是一种编程语言", "wrong_answer"),  # 完全不匹配
        ("", "Python是一种编程语言", "wrong_answer"),  # 空答案
        ("Python,编程,语言", "Python,编程,语言", "accepted"),  # 关键词匹配
        ("编程语言Python", "Python,编程,语言", "partially_correct"),  # 部分关键词匹配
    ]
    
    for user_answer, reference_answer, expected_status in test_cases:
        problem = MockProblem(reference_answer)
        submission = MockSubmission(user_answer)
        session = MockSession()
        
        # 调用判题函数
        result = judge_short_answer_problem(submission, problem, session)
        
        print(f"用户答案: '{user_answer}' | 参考答案: '{reference_answer}' | 结果: {submission.status} | 期望: {expected_status}")
        if submission.status != expected_status:
            print(f"  ❌ 测试失败！期望状态: {expected_status}, 实际状态: {submission.status}")
        else:
            print(f"   ✅ 测试通过")
        print(f"  判题结果: {submission.result}")
        print()

def test_answer_similarity():
    """测试答案相似度计算"""
    print("=== 测试答案相似度计算 ===")
    
    test_cases = [
        ("Python是一种编程语言", "Python是一种编程语言"),
        ("python是一种编程语言", "Python是一种编程语言"),
        ("Python是编程语言", "Python是一种编程语言"),
        ("Java是一种编程语言", "Python是一种编程语言"),
        ("Python,编程,语言", "Python,编程,语言"),
        ("编程语言Python", "Python,编程,语言"),
        ("", "Python是一种编程语言"),
        ("Python是一种编程语言", ""),
    ]
    
    for user_answer, reference_answer in test_cases:
        similarity = calculate_answer_similarity(user_answer, reference_answer)
        print(f"用户答案: '{user_answer}'")
        print(f"参考答案: '{reference_answer}'")
        print(f"相似度: {similarity:.3f} ({similarity:.1%})")
        print()

# 从judge.py导入判题函数
try:
    from judge import (
        judge_choice_problem,
        judge_judge_problem, 
        judge_short_answer_problem,
        calculate_answer_similarity
    )
    
    if __name__ == "__main__":
        print("开始测试判题模块...\n")
        
        test_choice_problem_judging()
        test_judge_problem_judging()
        test_short_answer_problem_judging()
        test_answer_similarity()
        
        print("所有测试完成！")
        
except ImportError as e:
    print(f"导入判题模块失败: {e}")
    print("请确保在项目根目录下运行此脚本")
    print("或者先启动判题服务")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Special Judge 引擎
支持复杂的判题场景：多解、浮点数误差、自定义验证等
"""

import json
import re
import math
import subprocess
import tempfile
import os
import sys
from typing import Dict, List, Any, Tuple, Optional
from decimal import Decimal, getcontext

# 设置高精度计算
getcontext().prec = 28


class SpecialJudgeEngine:
    """特殊判题引擎"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.sandbox_dir = tempfile.mkdtemp(prefix="special_judge_")
        
    def __del__(self):
        """清理临时文件"""
        try:
            import shutil
            shutil.rmtree(self.sandbox_dir, ignore_errors=True)
        except:
            pass
    
    def judge(self, 
              user_output: str, 
              expected_output: str, 
              input_data: str,
              judge_script: str = None,
              judge_config: Dict[str, Any] = None) -> Tuple[str, str, float]:
        """
        执行特殊判题
        
        Args:
            user_output: 用户输出
            expected_output: 期望输出
            input_data: 输入数据
            judge_script: 自定义判题脚本
            judge_config: 判题配置
            
        Returns:
            (结果, 消息, 得分)
        """
        try:
            # 1. 如果有自定义判题脚本，优先使用
            if judge_script:
                return self._execute_custom_judge(
                    user_output, expected_output, input_data, judge_script
                )
            
            # 2. 使用配置的判题规则
            if judge_config:
                return self._judge_by_config(
                    user_output, expected_output, input_data, judge_config
                )
            
            # 3. 默认智能判题
            return self._smart_judge(user_output, expected_output, input_data)
            
        except Exception as e:
            return "ERROR", f"判题过程出错: {str(e)}", 0.0
    
    def _execute_custom_judge(self, 
                             user_output: str, 
                             expected_output: str, 
                             input_data: str,
                             judge_script: str) -> Tuple[str, str, float]:
        """执行自定义判题脚本"""
        try:
            # 创建临时脚本文件
            script_file = os.path.join(self.sandbox_dir, "judge_script.py")
            with open(script_file, 'w', encoding='utf-8') as f:
                f.write(judge_script)
            
            # 准备输入数据
            judge_input = {
                'user_output': user_output,
                'expected_output': expected_output,
                'input_data': input_data,
                'config': self.config
            }
            
            # 执行判题脚本
            result = subprocess.run(
                [sys.executable, script_file],
                input=json.dumps(judge_input, ensure_ascii=False),
                capture_output=True,
                text=True,
                timeout=10,  # 10秒超时
                cwd=self.sandbox_dir
            )
            
            if result.returncode != 0:
                return "ERROR", f"判题脚本执行失败: {result.stderr}", 0.0
            
            # 解析脚本输出
            try:
                judge_result = json.loads(result.stdout.strip())
                return (
                    judge_result.get('result', 'ERROR'),
                    judge_result.get('message', '未知错误'),
                    float(judge_result.get('score', 0.0))
                )
            except json.JSONDecodeError:
                return "ERROR", f"判题脚本输出格式错误: {result.stdout}", 0.0
                
        except subprocess.TimeoutExpired:
            return "ERROR", "判题脚本执行超时", 0.0
        except Exception as e:
            return "ERROR", f"执行自定义判题失败: {str(e)}", 0.0
    
    def _judge_by_config(self, 
                         user_output: str, 
                         expected_output: str, 
                         input_data: str,
                         judge_config: Dict[str, Any]) -> Tuple[str, str, float]:
        """根据配置进行判题"""
        try:
            judge_type = judge_config.get('type', 'exact')
            
            if judge_type == 'float':
                return self._judge_float(user_output, expected_output, judge_config)
            elif judge_type == 'multiple_solutions':
                return self._judge_multiple_solutions(user_output, expected_output, judge_config)
            elif judge_type == 'format':
                return self._judge_format(user_output, expected_output, judge_config)
            elif judge_type == 'partial':
                return self._judge_partial(user_output, expected_output, judge_config)
            else:
                return self._judge_exact(user_output, expected_output)
                
        except Exception as e:
            return "ERROR", f"配置判题失败: {str(e)}", 0.0
    
    def _judge_float(self, 
                     user_output: str, 
                     expected_output: str,
                     config: Dict[str, Any]) -> Tuple[str, str, float]:
        """浮点数判题（允许误差）"""
        try:
            # 提取数值
            user_nums = self._extract_numbers(user_output)
            expected_nums = self._extract_numbers(expected_output)
            
            if len(user_nums) != len(expected_nums):
                return "WRONG_ANSWER", "输出数值数量不匹配", 0.0
            
            # 获取误差范围
            epsilon = config.get('epsilon', 1e-6)
            relative_error = config.get('relative_error', 1e-6)
            
            # 逐个比较数值
            correct_count = 0
            total_count = len(expected_nums)
            
            for u_num, e_num in zip(user_nums, expected_nums):
                if self._is_float_equal(u_num, e_num, epsilon, relative_error):
                    correct_count += 1
            
            score = correct_count / total_count
            if score >= 0.99:  # 99%以上正确
                return "ACCEPTED", "浮点数比较通过", 1.0
            elif score >= 0.8:  # 80%以上正确
                return "PARTIALLY_CORRECT", f"部分正确 ({correct_count}/{total_count})", score
            else:
                return "WRONG_ANSWER", f"浮点数误差过大 ({correct_count}/{total_count})", score
                
        except Exception as e:
            return "ERROR", f"浮点数判题失败: {str(e)}", 0.0
    
    def _judge_multiple_solutions(self, 
                                 user_output: str, 
                                 expected_output: str,
                                 config: Dict[str, Any]) -> Tuple[str, str, float]:
        """多解判题"""
        try:
            # 获取所有可能的解
            solutions = config.get('solutions', [])
            if not solutions:
                return "ERROR", "未配置多解信息", 0.0
            
            # 标准化用户输出
            user_output_clean = self._normalize_output(user_output)
            
            # 检查是否匹配任一解
            for solution in solutions:
                if self._normalize_output(solution) == user_output_clean:
                    return "ACCEPTED", "多解验证通过", 1.0
            
            # 如果没有完全匹配，检查部分正确性
            best_match_score = 0.0
            for solution in solutions:
                score = self._calculate_similarity(user_output_clean, self._normalize_output(solution))
                best_match_score = max(best_match_score, score)
            
            if best_match_score >= 0.9:
                return "PARTIALLY_CORRECT", f"部分匹配 ({best_match_score:.2f})", best_match_score
            else:
                return "WRONG_ANSWER", "未找到匹配的解", best_match_score
                
        except Exception as e:
            return "ERROR", f"多解判题失败: {str(e)}", 0.0
    
    def _judge_format(self, 
                      user_output: str, 
                      expected_output: str,
                      config: Dict[str, Any]) -> Tuple[str, str, float]:
        """格式判题"""
        try:
            # 获取格式要求
            format_rules = config.get('format_rules', {})
            
            # 检查行数
            if 'line_count' in format_rules:
                user_lines = user_output.strip().split('\n')
                expected_lines = expected_output.strip().split('\n')
                if len(user_lines) != len(expected_lines):
                    return "WRONG_ANSWER", f"行数不匹配: 期望{len(expected_lines)}行，实际{len(user_lines)}行", 0.0
            
            # 检查每行格式
            if 'line_format' in format_rules:
                pattern = format_rules['line_format']
                user_lines = user_output.strip().split('\n')
                correct_lines = 0
                total_lines = len(user_lines)
                
                for line in user_lines:
                    if re.match(pattern, line.strip()):
                        correct_lines += 1
                
                score = correct_lines / total_lines
                if score >= 0.99:
                    return "ACCEPTED", "格式验证通过", 1.0
                elif score >= 0.8:
                    return "PARTIALLY_CORRECT", f"格式部分正确 ({correct_lines}/{total_lines})", score
                else:
                    return "WRONG_ANSWER", f"格式错误过多 ({correct_lines}/{total_lines})", score
            
            # 默认格式检查
            return self._judge_exact(user_output, expected_output)
            
        except Exception as e:
            return "ERROR", f"格式判题失败: {str(e)}", 0.0
    
    def _judge_partial(self, 
                       user_output: str, 
                       expected_output: str,
                       config: Dict[str, Any]) -> Tuple[str, str, float]:
        """部分正确判题"""
        try:
            # 获取评分规则
            scoring_rules = config.get('scoring_rules', [])
            if not scoring_rules:
                return "ERROR", "未配置评分规则", 0.0
            
            total_score = 0.0
            max_score = 0.0
            messages = []
            
            for rule in scoring_rules:
                rule_type = rule.get('type', 'exact')
                rule_score = rule.get('score', 0.0)
                max_score += rule_score
                
                if rule_type == 'exact':
                    if user_output.strip() == expected_output.strip():
                        total_score += rule_score
                        messages.append(f"完全正确: +{rule_score}")
                    else:
                        messages.append(f"不完全正确: +0")
                elif rule_type == 'contains':
                    keywords = rule.get('keywords', [])
                    if all(keyword in user_output for keyword in keywords):
                        total_score += rule_score
                        messages.append(f"包含关键词: +{rule_score}")
                    else:
                        messages.append(f"缺少关键词: +0")
                elif rule_type == 'pattern':
                    pattern = rule.get('pattern', '')
                    if re.search(pattern, user_output):
                        total_score += rule_score
                        messages.append(f"模式匹配: +{rule_score}")
                    else:
                        messages.append(f"模式不匹配: +0")
            
            final_score = total_score / max_score if max_score > 0 else 0.0
            
            if final_score >= 0.99:
                return "ACCEPTED", f"完全正确: {total_score}/{max_score}", 1.0
            elif final_score >= 0.6:
                return "PARTIALLY_CORRECT", f"部分正确: {total_score}/{max_score}", final_score
            else:
                return "WRONG_ANSWER", f"得分过低: {total_score}/{max_score}", final_score
                
        except Exception as e:
            return "ERROR", f"部分正确判题失败: {str(e)}", 0.0
    
    def _smart_judge(self, 
                     user_output: str, 
                     expected_output: str, 
                     input_data: str) -> Tuple[str, str, float]:
        """智能判题（自动识别类型）"""
        try:
            # 检测是否为浮点数
            if self._contains_floats(user_output) and self._contains_floats(expected_output):
                return self._judge_float(user_output, expected_output, {'epsilon': 1e-6})
            
            # 检测是否为多行输出
            if '\n' in user_output or '\n' in expected_output:
                return self._judge_format(user_output, expected_output, {'line_count': True})
            
            # 默认精确匹配
            return self._judge_exact(user_output, expected_output)
            
        except Exception as e:
            return "ERROR", f"智能判题失败: {str(e)}", 0.0
    
    def _judge_exact(self, user_output: str, expected_output: str) -> Tuple[str, str, float]:
        """精确匹配判题"""
        if user_output.strip() == expected_output.strip():
            return "ACCEPTED", "答案完全正确", 1.0
        else:
            return "WRONG_ANSWER", "答案不正确", 0.0
    
    def _extract_numbers(self, text: str) -> List[float]:
        """从文本中提取数值"""
        numbers = []
        # 匹配各种数值格式
        patterns = [
            r'-?\d+\.\d+',  # 浮点数
            r'-?\d+',       # 整数
            r'-?\d+e-?\d+', # 科学计数法
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    numbers.append(float(match))
                except ValueError:
                    continue
        
        return numbers
    
    def _is_float_equal(self, a: float, b: float, epsilon: float, relative_error: float) -> bool:
        """比较两个浮点数是否相等（考虑误差）"""
        if abs(a - b) <= epsilon:
            return True
        
        if abs(b) > 0:
            relative_diff = abs(a - b) / abs(b)
            if relative_diff <= relative_error:
                return True
        
        return False
    
    def _normalize_output(self, output: str) -> str:
        """标准化输出（去除多余空格、换行等）"""
        return re.sub(r'\s+', ' ', output.strip())
    
    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """计算两个字符串的相似度"""
        if str1 == str2:
            return 1.0
        
        if len(str1) == 0 or len(str2) == 0:
            return 0.0
        
        # 使用编辑距离计算相似度
        distance = self._levenshtein_distance(str1, str2)
        max_len = max(len(str1), len(str2))
        return 1.0 - (distance / max_len)
    
    def _levenshtein_distance(self, str1: str, str2: str) -> int:
        """计算编辑距离"""
        m, n = len(str1), len(str2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        
        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j
        
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if str1[i - 1] == str2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]
                else:
                    dp[i][j] = min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
        
        return dp[m][n]
    
    def _contains_floats(self, text: str) -> bool:
        """检测文本是否包含浮点数"""
        return bool(re.search(r'-?\d+\.\d+', text))


# 判题脚本模板
JUDGE_SCRIPT_TEMPLATES = {
    "float_comparison": '''
import json
import sys

def judge_float_comparison(user_output, expected_output, input_data, config):
    """浮点数比较判题"""
    try:
        # 提取数值
        user_nums = [float(x) for x in user_output.strip().split() if x.replace('.', '').replace('-', '').isdigit()]
        expected_nums = [float(x) for x in expected_output.strip().split() if x.replace('.', '').replace('-', '').isdigit()]
        
        if len(user_nums) != len(expected_nums):
            return {"result": "WRONG_ANSWER", "message": "数值数量不匹配", "score": 0.0}
        
        epsilon = config.get('epsilon', 1e-6)
        correct_count = 0
        
        for u, e in zip(user_nums, expected_nums):
            if abs(u - e) <= epsilon:
                correct_count += 1
        
        score = correct_count / len(expected_nums)
        if score >= 0.99:
            return {"result": "ACCEPTED", "message": "浮点数比较通过", "score": 1.0}
        else:
            return {"result": "PARTIALLY_CORRECT", "message": f"部分正确 ({correct_count}/{len(expected_nums)})", "score": score}
            
    except Exception as e:
        return {"result": "ERROR", "message": f"判题出错: {str(e)}", "score": 0.0}

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        result = judge_float_comparison(
            input_data['user_output'],
            input_data['expected_output'],
            input_data['input_data'],
            input_data.get('config', {})
        )
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"result": "ERROR", "message": str(e), "score": 0.0}, ensure_ascii=False))
''',
    
    "multiple_solutions": '''
import json
import sys

def judge_multiple_solutions(user_output, expected_output, input_data, config):
    """多解判题"""
    try:
        solutions = config.get('solutions', [])
        user_output_clean = user_output.strip()
        
        # 检查是否匹配任一解
        for solution in solutions:
            if solution.strip() == user_output_clean:
                return {"result": "ACCEPTED", "message": "多解验证通过", "score": 1.0}
        
        # 检查部分正确性
        best_score = 0.0
        for solution in solutions:
            # 简单的相似度计算
            if len(user_output_clean) == len(solution.strip()):
                matches = sum(1 for a, b in zip(user_output_clean, solution.strip()) if a == b)
                score = matches / len(user_output_clean)
                best_score = max(best_score, score)
        
        if best_score >= 0.8:
            return {"result": "PARTIALLY_CORRECT", "message": f"部分匹配 ({best_score:.2f})", "score": best_score}
        else:
            return {"result": "WRONG_ANSWER", "message": "未找到匹配的解", "score": best_score}
            
    except Exception as e:
        return {"result": "ERROR", "message": f"判题出错: {str(e)}", "score": 0.0}

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        result = judge_multiple_solutions(
            input_data['user_output'],
            input_data['expected_output'],
            input_data['input_data'],
            input_data.get('config', {})
        )
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"result": "ERROR", "message": str(e), "score": 0.0}, ensure_ascii=False))
'''
}


if __name__ == "__main__":
    # 测试代码
    engine = SpecialJudgeEngine()
    
    # 测试浮点数判题
    result, message, score = engine.judge(
        "3.14159 2.71828",
        "3.14159 2.71828",
        "test input",
        judge_config={'type': 'float', 'epsilon': 1e-6}
    )
    print(f"浮点数判题: {result} - {message} (得分: {score})")
    
    # 测试多解判题
    result, message, score = engine.judge(
        "1 2 3",
        "1 2 3",
        "test input",
        judge_config={'type': 'multiple_solutions', 'solutions': ['1 2 3', '3 2 1']}
    )
    print(f"多解判题: {result} - {message} (得分: {score})")

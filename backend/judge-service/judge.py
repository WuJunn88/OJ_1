#判题服务的主逻辑，通过 RabbitMQ 监听队列，接收判题任务。
# 处理时从数据库获取提交和题目信息，
# 调用 sandbox.run_code 执行代码，判断结果，更新提交状态和结果。

import sys
import os
import pika
import json
import time
import re
from datetime import datetime
from sandbox import run_code
from database import Session
from special_judge import SpecialJudgeEngine

# 将 backend 目录加入 sys.path，确保可以导入 shared.models
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir)
if backend_root not in sys.path:
    sys.path.append(backend_root)

# 从共享模型导入
from shared.models import Problem, Submission

RABBITMQ_HOST = 'localhost'
RABBITMQ_PORT = 5673
QUEUE_NAME = 'judge_queue'

def start_judge_worker():
    try:
        print(f"[*] 尝试连接到RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
        connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_HOST, RABBITMQ_PORT))
        channel = connection.channel()
        channel.queue_declare(queue=QUEUE_NAME, durable=True)
        print(f"[*] 成功连接到RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
        print(f"[*] 队列名称: {QUEUE_NAME}")
    except Exception as e:
        print(f"[!] RabbitMQ连接失败: {str(e)}")
        print("[!] 判题服务无法启动，请检查RabbitMQ服务状态")
        return
    
    def callback(ch, method, properties, body):
        try:
            data = json.loads(body)
            submission_id = data['submission_id']
            print(f"[*] 开始处理提交 {submission_id}")
            
            session = Session()
            submission = None
            
            try:
                # 获取提交记录
                submission = session.query(Submission).get(submission_id)
                if not submission:
                    print(f"[!] Submission {submission_id} not found")
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    return
                
                print(f"[*] 提交信息: ID={submission.id}, 题目ID={submission.problem_id}, 状态={submission.status}")
                
                # 更新状态为判题中
                submission.status = 'judging'
                session.commit()
                print(f"[*] 提交 {submission_id} 状态更新为: judging")
                
                # 获取题目信息
                problem = session.query(Problem).get(submission.problem_id)
                if not problem:
                    submission.status = 'error'
                    submission.result = 'Problem not found'
                    session.commit()
                    print(f"[!] 提交 {submission_id}: 题目不存在")
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    return
                
                # 检查是否为逾期提交（通过作业关联）
                is_overdue = False
                try:
                    # 查找该题目是否属于某个作业
                    from shared.models import Assignment, AssignmentProblem
                    assignment_problem = session.query(AssignmentProblem).filter_by(
                        problem_id=submission.problem_id
                    ).first()
                    
                    if assignment_problem:
                        assignment = session.query(Assignment).get(assignment_problem.assignment_id)
                        if assignment and assignment.allow_overdue_submission:
                            # 检查是否超过正常截止时间
                            now = datetime.utcnow()
                            if assignment.due_date and now > assignment.due_date:
                                # 检查是否在补交截止时间内
                                if assignment.overdue_deadline and now <= assignment.overdue_deadline:
                                    # 检查用户是否在白名单中
                                    overdue_user_ids = json.loads(assignment.overdue_allow_user_ids) if assignment.overdue_allow_user_ids else []
                                    if submission.user_id in overdue_user_ids:
                                        is_overdue = True
                                        print(f"[*] 提交 {submission_id} 为逾期提交，用户ID: {submission.user_id}")
                                    else:
                                        print(f"[*] 提交 {submission_id} 超过截止时间，但用户不在白名单中")
                                else:
                                    print(f"[*] 提交 {submission_id} 超过补交截止时间")
                            else:
                                print(f"[*] 提交 {submission_id} 在正常截止时间内")
                        else:
                            print(f"[*] 提交 {submission_id} 不属于允许补交的作业")
                except Exception as e:
                    print(f"[!] 检查逾期状态时发生错误: {str(e)}")
                    # 不影响正常判题流程
                
                # 标记逾期状态
                submission.is_overdue = is_overdue
                
                print(f"[*] 题目信息: ID={problem.id}, 类型={problem.type}, 标题={problem.title}")
                print(f"[*] 开始判题，题目类型: {problem.type}, 语言: {submission.language}")
                
                # 根据题目类型进行不同的判题逻辑
                if problem.type == 'programming':
                    print(f"[*] 调用编程题判题函数")
                    result = judge_programming_problem(submission, problem, session)
                elif problem.type == 'choice':
                    print(f"[*] 调用选择题判题函数")
                    result = judge_choice_problem(submission, problem, session)
                elif problem.type == 'judge':
                    print(f"[*] 调用判断题判题函数")
                    result = judge_judge_problem(submission, problem, session)
                elif problem.type == 'short_answer':
                    print(f"[*] 调用简答题判题函数")
                    result = judge_short_answer_problem(submission, problem, session)
                else:
                    submission.status = 'error'
                    submission.result = f'不支持的题目类型: {problem.type}'
                    session.commit()
                    print(f"[!] 提交 {submission_id}: 不支持的题目类型 {problem.type}")
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    return
                
                print(f"[*] 提交 {submission_id} 判题完成，状态: {submission.status}, 结果: {submission.result}")
                
            except Exception as e:
                print(f"[!] 处理提交 {submission_id} 时发生错误: {str(e)}")
                import traceback
                traceback.print_exc()
                if submission:
                    submission.status = 'error'
                    submission.result = f'判题服务错误: {str(e)}'
                    session.commit()
            finally:
                if session:
                    session.close()
                ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            print(f"[!] 回调函数发生错误: {str(e)}")
            import traceback
            traceback.print_exc()
            ch.basic_ack(delivery_tag=method.delivery_tag)
    
    channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)
    print(f"[*] 等待判题任务...")
    channel.start_consuming()

def judge_programming_problem(submission, problem, session):
    """判题编程题（支持多测试用例、空输入、多行输入/输出）"""
    print(f"[*] 开始执行代码，语言: {submission.language}")
    print(f"[*] 原始测试用例字段: {problem.test_cases}")
    print(f"[*] 原始期望输出字段: {problem.expected_output}")

    # 优先尝试解析结构化JSON测试用例：[{"input": "...", "output": "..."}, ...]
    structured_cases = None
    try:
        parsed = json.loads(problem.test_cases) if problem.test_cases else None
        if isinstance(parsed, list) and all(isinstance(c, dict) for c in parsed):
            # 规范化为字符串
            structured_cases = [
                {
                    'input': (str(c.get('input', '')) if c.get('input') is not None else ''),
                    'output': (str(c.get('output', '')) if c.get('output') is not None else '')
                }
                for c in parsed
            ]
            print(f"[*] 解析到结构化测试用例 {len(structured_cases)} 个")
    except Exception as e:
        print(f"[!] 测试用例JSON解析失败，使用兼容模式: {e}")

    def normalize_text_block(s: str) -> str:
        # 统一换行/去除末尾多余空白行，但保留中间空行
        if s is None:
            return ''
        # 统一换行
        s = s.replace('\r\n', '\n').replace('\r', '\n')
        # 去除每行末尾空格
        lines = [line.rstrip() for line in s.split('\n')]
        # 去除首尾空行
        while lines and lines[0] == '':
            lines.pop(0)
        while lines and lines[-1] == '':
            lines.pop()
        return '\n'.join(lines)

    if structured_cases is not None:
        all_passed = True
        failed_cases = []
        total_execution_time = 0.0

        for i, case in enumerate(structured_cases):
            input_block = case.get('input', '')
            expected_block = case.get('output', '')
            print(f"[*] 执行用例 {i+1}: 输入(预览)='{input_block[:60]}'…")

            # 执行代码
            start_time = time.time()
            output, error = run_code(
                code=submission.code,
                language=submission.language,
                input_data=input_block,
                time_limit_ms=problem.time_limit,
                memory_limit_mb=problem.memory_limit
            )
            exec_time = time.time() - start_time
            total_execution_time = max(total_execution_time, exec_time)

            if error:
                print(f"[*] 用例 {i+1} 执行错误: {error}")
                all_passed = False
                failed_cases.append(f"用例 {i+1}: 执行错误 - {error}")
                continue

            actual_norm = normalize_text_block(output)
            expected_norm = normalize_text_block(expected_block)
            print(f"[*] 用例 {i+1} 实际输出(预览)='{actual_norm[:60]}'…")

            # 检查是否启用Special Judge
            if hasattr(problem, 'enable_special_judge') and problem.enable_special_judge:
                print(f"[*] 用例 {i+1} 启用Special Judge")
                try:
                    # 初始化Special Judge引擎
                    judge_config = json.loads(problem.judge_config) if problem.judge_config else {}
                    special_judge = SpecialJudgeEngine(judge_config)
                    
                    # 执行Special Judge
                    result, message, score = special_judge.judge(
                        user_output=actual_norm,
                        expected_output=expected_norm,
                        input_data=input_block,
                        judge_script=problem.special_judge_script,
                        judge_config=judge_config
                    )
                    
                    print(f"[*] Special Judge结果: {result} - {message} (得分: {score})")
                    
                    if result == "ACCEPTED":
                        print(f"[*] 用例 {i+1} Special Judge通过")
                        continue
                    elif result == "PARTIALLY_CORRECT":
                        print(f"[*] 用例 {i+1} Special Judge部分正确，得分: {score}")
                        # 可以选择是否接受部分正确
                        if score >= 0.8:  # 80%以上算通过
                            print(f"[*] 用例 {i+1} 部分正确，接受")
                            continue
                        else:
                            all_passed = False
                            failed_cases.append(
                                f"用例 {i+1}: Special Judge部分正确 - {message} (得分: {score})"
                            )
                    else:
                        all_passed = False
                        failed_cases.append(
                            f"用例 {i+1}: Special Judge失败 - {message}"
                        )
                        
                except Exception as e:
                    print(f"[!] Special Judge执行失败: {str(e)}")
                    # 回退到标准判题
                    if actual_norm != expected_norm:
                        all_passed = False
                        failed_cases.append(
                            f"用例 {i+1}: 输出不匹配\n期望: \n{expected_norm}\n实际: \n{actual_norm}"
                        )
            else:
                # 标准判题
                if actual_norm != expected_norm:
                    all_passed = False
                    failed_cases.append(
                        f"用例 {i+1}: 输出不匹配\n期望: \n{expected_norm}\n实际: \n{actual_norm}"
                    )

        if all_passed:
            submission.status = 'accepted'
            submission.result = '所有测试用例通过'
            print(f"[*] 所有测试用例通过！")
        else:
            submission.status = 'wrong_answer'
            submission.result = '部分测试用例失败:\n' + '\n'.join(failed_cases)
            print(f"[*] 部分测试用例失败")
        submission.execution_time = total_execution_time
        session.commit()
        return True

    # 兼容模式（旧格式）：按行zip。保留无输入多行输出的特殊处理
    print(f"[*] 使用兼容模式解析测试用例")
    test_cases = problem.test_cases.split('\n') if problem.test_cases is not None else ['']
    expected_outputs = problem.expected_output.split('\n') if problem.expected_output else ['']

    # 过滤空行，但保留空字符串（表示无输入）
    test_cases = [tc for tc in test_cases if tc.strip() != '' or tc == '']
    expected_outputs = [eo for eo in expected_outputs if eo.strip()]

    print(f"[*] 兼容模式下测试用例数量: {len(test_cases)} / 期望输出行数: {len(expected_outputs)}")

    # 如果所有测试用例都是空字符串（可能被错误拆成多行空输入），按单个空输入对待
    if test_cases and all(tc.strip() == '' for tc in test_cases):
        print(f"[*] 检测到所有测试用例皆为空，按单个空输入处理")
        test_cases = ['']
        # 如果期望输出是多行，直接按无输入多行输出处理
        if len(expected_outputs) > 1:
            print(f"[*] 检测到无输入、多行输出题目")
            all_expected_lines = [line.strip() for line in problem.expected_output.split('\n') if line.strip()]
            start_time = time.time()
            output, error = run_code(
                code=submission.code,
                language=submission.language,
                input_data='',
                time_limit_ms=problem.time_limit,
                memory_limit_mb=problem.memory_limit
            )
            execution_time = time.time() - start_time
            if error:
                submission.status = 'error'
                submission.result = error
                submission.execution_time = execution_time
                session.commit()
                return True
            actual_lines = [line.strip() for line in output.split('\n') if line.strip()]
            if len(actual_lines) != len(all_expected_lines) or any(a != e for a, e in zip(actual_lines, all_expected_lines)):
                submission.status = 'wrong_answer'
                submission.result = f"输出不匹配\n期望:\n{chr(10).join(all_expected_lines)}\n实际:\n{chr(10).join(actual_lines)}"
            else:
                submission.status = 'accepted'
                submission.result = '所有输出行都匹配'
            submission.execution_time = execution_time
            session.commit()
            return True

    # 无输入、多行输出（原有的逻辑，保留作为备用）
    if len(test_cases) == 1 and test_cases[0] == '' and len(expected_outputs) > 1:
        print(f"[*] 检测到无输入、多行输出题目")
        all_expected_lines = [line.strip() for line in problem.expected_output.split('\n') if line.strip()]
        start_time = time.time()
        output, error = run_code(
            code=submission.code,
            language=submission.language,
            input_data='',
            time_limit_ms=problem.time_limit,
            memory_limit_mb=problem.memory_limit
        )
        execution_time = time.time() - start_time
        if error:
            submission.status = 'error'
            submission.result = error
            submission.execution_time = execution_time
            session.commit()
            return True
        actual_lines = [line.strip() for line in output.split('\n') if line.strip()]
        if len(actual_lines) != len(all_expected_lines) or any(a != e for a, e in zip(actual_lines, all_expected_lines)):
            submission.status = 'wrong_answer'
            submission.result = f"输出不匹配\n期望:\n{chr(10).join(all_expected_lines)}\n实际:\n{chr(10).join(actual_lines)}"
        else:
            submission.status = 'accepted'
            submission.result = '所有输出行都匹配'
        submission.execution_time = execution_time
        session.commit()
        return True

    # 多测试用例（单行输入/输出）
    print(f"[*] 使用多测试用例模式(旧)")
    all_passed = True
    failed_cases = []
    total_execution_time = 0.0

    for i, (test_case, expected_output) in enumerate(zip(test_cases, expected_outputs)):
        print(f"[*] 执行测试用例 {i+1}: 输入='{test_case}', 期望输出='{expected_output}'")
        start_time = time.time()
        output, error = run_code(
            code=submission.code,
            language=submission.language,
            input_data=test_case,
            time_limit_ms=problem.time_limit,
            memory_limit_mb=problem.memory_limit
        )
        exec_time = time.time() - start_time
        total_execution_time = max(total_execution_time, exec_time)
        if error:
            all_passed = False
            failed_cases.append(f"测试用例 {i+1}: 执行错误 - {error}")
            continue
        # 检查是否启用Special Judge
        if hasattr(problem, 'enable_special_judge') and problem.enable_special_judge:
            print(f"[*] 测试用例 {i+1} 启用Special Judge")
            try:
                # 初始化Special Judge引擎
                judge_config = json.loads(problem.judge_config) if problem.judge_config else {}
                special_judge = SpecialJudgeEngine(judge_config)
                
                # 执行Special Judge
                result, message, score = special_judge.judge(
                    user_output=output.strip(),
                    expected_output=expected_output,
                    input_data=test_case,
                    judge_script=problem.special_judge_script,
                    judge_config=judge_config
                )
                
                print(f"[*] Special Judge结果: {result} - {message} (得分: {score})")
                
                if result == "ACCEPTED":
                    print(f"[*] 测试用例 {i+1} Special Judge通过")
                    continue
                elif result == "PARTIALLY_CORRECT":
                    print(f"[*] 测试用例 {i+1} Special Judge部分正确，得分: {score}")
                    # 可以选择是否接受部分正确
                    if score >= 0.8:  # 80%以上算通过
                        print(f"[*] 测试用例 {i+1} 部分正确，接受")
                        continue
                    else:
                        all_passed = False
                        failed_cases.append(
                            f"测试用例 {i+1}: Special Judge部分正确 - {message} (得分: {score})"
                        )
                else:
                    all_passed = False
                    failed_cases.append(
                        f"测试用例 {i+1}: Special Judge失败 - {message}"
                    )
                    
            except Exception as e:
                print(f"[!] Special Judge执行失败: {str(e)}")
                # 回退到标准判题
                if output.strip() != expected_output:
                    all_passed = False
                    failed_cases.append(f"测试用例 {i+1}: 期望 '{expected_output}', 实际 '{output.strip()}'")
        else:
            # 标准判题
            if output.strip() != expected_output:
                all_passed = False
                failed_cases.append(f"测试用例 {i+1}: 期望 '{expected_output}', 实际 '{output.strip()}'")

    if all_passed:
        submission.status = 'accepted'
        submission.result = '所有测试用例通过'
        print(f"[*] 所有测试用例通过！")
    else:
        submission.status = 'wrong_answer'
        submission.result = f'部分测试用例失败:\n' + '\n'.join(failed_cases)
        print(f"[*] 部分测试用例失败")
    submission.execution_time = total_execution_time
    session.commit()
    return True

def judge_choice_problem(submission, problem, session):
    """判题选择题"""
    print(f"[*] 开始判题选择题")
    print(f"[*] 用户答案: {submission.code}")
    print(f"[*] 正确答案: {problem.expected_output}")
    
    # 获取正确答案
    correct_answer = problem.expected_output.strip() if problem.expected_output else ""
    user_answer = submission.code.strip()
    
    if not correct_answer:
        submission.status = 'error'
        submission.result = '题目缺少正确答案'
        session.commit()
        print(f"[!] 选择题缺少正确答案")
        return False
    
    if not user_answer:
        submission.status = 'wrong_answer'
        submission.result = '请选择答案'
        session.commit()
        print(f"[*] 用户未选择答案")
        return True
    
    # 标准化答案格式（去除空格，统一大小写）
    correct_answer_normalized = re.sub(r'\s+', '', correct_answer.lower())
    user_answer_normalized = re.sub(r'\s+', '', user_answer.lower())
    
    # 处理多选题：将答案按逗号分割，排序后重新组合，确保顺序不敏感
    if ',' in correct_answer_normalized:
        correct_parts = sorted(correct_answer_normalized.split(','))
        user_parts = sorted(user_answer_normalized.split(','))
        correct_answer_normalized = ','.join(correct_parts)
        user_answer_normalized = ','.join(user_parts)
    
    print(f"[*] 标准化后的答案比较:")
    print(f"[*] 用户答案: '{user_answer_normalized}'")
    print(f"[*] 正确答案: '{correct_answer_normalized}'")
    
    # 比较答案
    if user_answer_normalized == correct_answer_normalized:
        submission.status = 'accepted'
        submission.result = '答案正确'
        print(f"[*] 选择题答案正确")
    else:
        submission.status = 'wrong_answer'
        submission.result = f'答案错误\n你的答案: {user_answer}\n正确答案: {correct_answer}'
        print(f"[*] 选择题答案错误")
    
    # 选择题不需要执行时间
    submission.execution_time = 0.0
    session.commit()
    return True

def judge_judge_problem(submission, problem, session):
    """判题判断题"""
    print(f"[*] 开始判题判断题")
    print(f"[*] 用户答案: {submission.code}")
    print(f"[*] 正确答案: {problem.expected_output}")
    
    # 获取正确答案
    correct_answer = problem.expected_output.strip() if problem.expected_output else ""
    user_answer = submission.code.strip()
    
    if not correct_answer:
        submission.status = 'error'
        submission.result = '题目缺少正确答案'
        session.commit()
        print(f"[!] 判断题缺少正确答案")
        return False
    
    if not user_answer:
        submission.status = 'wrong_answer'
        submission.result = '请选择答案'
        session.commit()
        print(f"[*] 用户未选择答案")
        return True
    
    # 标准化答案格式（支持多种表示方式）
    correct_answer_normalized = normalize_judge_answer(correct_answer)
    user_answer_normalized = normalize_judge_answer(user_answer)
    
    print(f"[*] 标准化后的答案比较:")
    print(f"[*] 用户答案: '{user_answer_normalized}'")
    print(f"[*] 正确答案: '{correct_answer_normalized}'")
    
    # 比较答案
    if user_answer_normalized == correct_answer_normalized:
        submission.status = 'accepted'
        submission.result = '答案正确'
        print(f"[*] 判断题答案正确")
    else:
        submission.status = 'wrong_answer'
        submission.result = f'答案错误\n你的答案: {user_answer}\n正确答案: {correct_answer}'
        print(f"[*] 判断题答案错误")
    
    # 判断题不需要执行时间
    submission.execution_time = 0.0
    session.commit()
    return True

def normalize_judge_answer(answer):
    """标准化判断题答案，支持多种表示方式"""
    if not answer:
        return ""
    
    answer_lower = answer.lower().strip()
    
    # 支持多种表示方式
    true_values = ['true', 't', 'yes', 'y', '1', '对', '正确', '是', '真']
    false_values = ['false', 'f', 'no', 'n', '0', '错', '错误', '否', '假']
    
    if answer_lower in true_values:
        return 'true'
    elif answer_lower in false_values:
        return 'false'
    else:
        # 如果无法识别，返回原值
        return answer_lower

def judge_short_answer_problem(submission, problem, session):
    """判题简答题"""
    print(f"[*] 开始判题简答题")
    print(f"[*] 用户答案: {submission.code}")
    print(f"[*] 参考答案: {problem.expected_output}")
    
    # 获取参考答案
    reference_answer = problem.expected_output.strip() if problem.expected_output else ""
    user_answer = submission.code.strip()
    
    if not reference_answer:
        submission.status = 'error'
        submission.result = '题目缺少参考答案'
        session.commit()
        print(f"[!] 简答题缺少参考答案")
        return False
    
    if not user_answer:
        submission.status = 'wrong_answer'
        submission.result = '请填写答案'
        session.commit()
        print(f"[*] 用户未填写答案")
        return True
    
    # 计算答案相似度
    similarity_score = calculate_answer_similarity(user_answer, reference_answer)
    print(f"[*] 答案相似度: {similarity_score:.2f}")
    
    # 根据相似度判断结果
    if similarity_score >= 0.7:  # 70%相似度算正确
        submission.status = 'accepted'
        submission.result = f'答案正确 (相似度: {similarity_score:.1%})'
        print(f"[*] 简答题答案正确，相似度: {similarity_score:.1%}")
    elif similarity_score >= 0.5:  # 50-70%相似度算部分正确
        submission.status = 'partially_correct'
        submission.result = f'答案部分正确 (相似度: {similarity_score:.1%})\n参考答案: {reference_answer}'
        print(f"[*] 简答题答案部分正确，相似度: {similarity_score:.1%}")
    else:
        submission.status = 'wrong_answer'
        submission.result = f'答案不正确 (相似度: {similarity_score:.1%})\n参考答案: {reference_answer}'
        print(f"[*] 简答题答案不正确，相似度: {similarity_score:.1%}")
    
    # 简答题不需要执行时间
    submission.execution_time = 0.0
    session.commit()
    return True

def calculate_answer_similarity(user_answer, reference_answer):
    """计算答案相似度"""
    if not user_answer or not reference_answer:
        return 0.0
    
    # 转换为小写并分词（支持中英文）
    def extract_words(text):
        # 支持中英文混合分词
        import re
        # 中文按字符分割，英文按单词分割
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
        english_words = re.findall(r'[a-zA-Z]+', text.lower())
        return chinese_chars + english_words
    
    user_words = set(extract_words(user_answer))
    reference_words = set(extract_words(reference_answer))
    
    if not reference_words:
        return 0.0
    
    # 计算Jaccard相似度
    intersection = len(user_words.intersection(reference_words))
    union = len(user_words.union(reference_words))
    
    if union == 0:
        return 0.0
    
    jaccard_similarity = intersection / union
    
    # 计算关键词匹配度
    reference_keywords = [word.strip() for word in reference_answer.split(',') if word.strip()]
    if reference_keywords:
        matched_keywords = 0
        for keyword in reference_keywords:
            if keyword.lower() in user_answer.lower():
                matched_keywords += 1
        keyword_similarity = matched_keywords / len(reference_keywords)
    else:
        keyword_similarity = 0.0
    
    # 计算字符级别的相似度（适用于中文）
    def char_similarity(text1, text2):
        if not text1 or not text2:
            return 0.0
        # 使用编辑距离的逆数作为相似度
        from difflib import SequenceMatcher
        return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()
    
    char_sim = char_similarity(user_answer, reference_answer)
    
    # 综合相似度（Jaccard相似度、关键词匹配度、字符相似度的加权平均）
    final_similarity = 0.4 * jaccard_similarity + 0.3 * keyword_similarity + 0.3 * char_sim
    
    return final_similarity

if __name__ == '__main__':
    start_judge_worker()
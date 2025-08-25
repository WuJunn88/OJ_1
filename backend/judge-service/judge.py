#判题服务的主逻辑，通过 RabbitMQ 监听队列，接收判题任务。
# 处理时从数据库获取提交和题目信息，
# 调用 sandbox.run_code 执行代码，判断结果，更新提交状态和结果。

import sys
import os
import pika
import json
import time
import re
from sandbox import run_code
from database import Session

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
    """判题编程题"""
    print(f"[*] 开始执行代码，语言: {submission.language}")
    
    # 执行代码
    start_time = time.time()
    output, error = run_code(
        code=submission.code,
        language=submission.language,
        input_data=problem.test_cases,
        time_limit_ms=problem.time_limit,
        memory_limit_mb=problem.memory_limit
    )
    execution_time = time.time() - start_time
    
    print(f"[*] 代码执行完成，耗时: {execution_time:.3f}s")
    print(f"[*] 输出: {output[:100]}...")
    if error:
        print(f"[*] 错误: {error}")
    
    # 判断结果
    if error:
        submission.status = 'error'
        submission.result = error
    elif output.strip() == problem.expected_output.strip():
        submission.status = 'accepted'
        submission.result = '答案正确'
    else:
        submission.status = 'wrong_answer'
        submission.result = f'答案错误\n期望输出: {problem.expected_output}\n实际输出: {output}'
    
    submission.execution_time = execution_time
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
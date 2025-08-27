//判题结果页面组件：
//通过路由参数获取提交 ID，调用 API 查询判题结果。
//若状态为 “pending”（等待中）或 “judging”（判题中），每 5 秒轮询更新结果。
//展示提交 ID、题目 ID、状态、结果、执行时间等信息。

import React, { useState, useEffect } from 'react';
import { getResult } from '../services/api';
import { useParams } from 'react-router-dom';

const ResultPage = () => {
  const { submissionId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const data = await getResult(submissionId);
        setResult(data);
        
        // 如果判题完成且状态为accepted，发送通知
        if (data.status === 'accepted') {
          console.log('判题成功，发送状态更新通知');
          // 通知学生仪表盘刷新作业完成状态
          localStorage.setItem('submissionStatusChanged', 'true');
          // 触发storage事件（用于跨标签页通信）
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'submissionStatusChanged',
            newValue: 'true'
          }));
        }
        
        // 如果还在判题中，每5秒轮询一次
        if (data.status === 'pending' || data.status === 'judging') {
          setTimeout(fetchResult, 5000);
        }
      } catch (error) {
        console.error('获取结果失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResult();
  }, [submissionId]);

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1>判题结果</h1>
      <p>提交ID: {submissionId}</p>
      <p>题目ID: {result.problem_id}</p>
      <p>状态: {result.status}</p>
      <p>结果: {result.result || 'N/A'}</p>
      {result.execution_time && (
        <p>执行时间: {result.execution_time.toFixed(2)}秒</p>
      )}
      
      {['pending', 'judging'].includes(result.status) && (
        <div>判题中，请稍候...</div>
      )}
    </div>
  );
};

export default ResultPage;
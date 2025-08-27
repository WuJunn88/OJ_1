import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTeacherCourses, getCourseAssignments, getCourseStudents, getProblems, getAssignmentCompletionStatus } from '../services/api';
import './StudentDashboardPage.css';
import WhaleIcon from '../components/WhaleIcon';
const StudentDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('courses');
  const [activeSubTab, setActiveSubTab] = useState('list');
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 课程相关状态（只读，用于查看）
  const [editingCourse, setEditingCourse] = useState(null);

  // 作业相关状态
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [viewingAssignment, setViewingAssignment] = useState(null);
  const [assignmentProblems, setAssignmentProblems] = useState([]);
  
  // 作业完成状态
  const [assignmentCompletionStatus, setAssignmentCompletionStatus] = useState({});

  // 学生-课程关联关系状态
  const [studentClassRelations, setStudentClassRelations] = useState([]);

  useEffect(() => {
    fetchInitialData();
    
    // 添加定期刷新作业完成状态的定时器
    const refreshInterval = setInterval(() => {
      if (editingCourse && editingCourse.id) {
        fetchAssignmentCompletionStatus(editingCourse.id);
      }
    }, 30000); // 每30秒刷新一次
    
    // 监听页面可见性变化，当页面重新可见时刷新数据
    const handleVisibilityChange = () => {
      if (!document.hidden && editingCourse && editingCourse.id) {
        console.log('页面重新可见，刷新作业完成状态');
        fetchAssignmentCompletionStatus(editingCourse.id);
      }
    };
    
    // 监听storage事件，用于跨标签页通信
    const handleStorageChange = (e) => {
      if (e.key === 'submissionStatusChanged' && editingCourse && editingCourse.id) {
        console.log('检测到提交状态变化，刷新作业完成状态');
        fetchAssignmentCompletionStatus(editingCourse.id);
        // 清除标记
        localStorage.removeItem('submissionStatusChanged');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [editingCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  // 从API加载学生-课程关联关系
  const fetchStudentClassRelations = async (courseId) => {
    try {
      const courseStudentsData = await getCourseStudents(courseId);
      if (courseStudentsData && courseStudentsData.length > 0) {
        const apiRelations = courseStudentsData.map(student => ({
          student_id: student.student_id,
          class_id: student.class_id,
          course_id: courseId,
          student_name: student.student_name,
          student_no: student.student_no,
          added_at: student.added_at || new Date().toISOString()
        }));
        setStudentClassRelations(apiRelations);
      } else {
        setStudentClassRelations([]);
      }
    } catch (error) {
      console.error('获取课程学生关联关系失败:', error);
      setStudentClassRelations([]);
    }
  };

  // 监听课程变化，加载课程学生关联关系
  useEffect(() => {
    const loadCourseStudents = async () => {
      if (editingCourse && editingCourse.id) {
        console.log('开始加载课程学生数据，课程ID:', editingCourse.id);
        await fetchStudentClassRelations(editingCourse.id);
        // 同时加载作业完成状态
        await fetchAssignmentCompletionStatus(editingCourse.id);
      }
    };
    
    loadCourseStudents();
  }, [editingCourse]); // eslint-disable-next-line react-hooks/exhaustive-deps

  // 获取作业完成状态
  const fetchAssignmentCompletionStatus = async (courseId) => {
    try {
      const completionData = await getAssignmentCompletionStatus(courseId);
      if (completionData && completionData.assignments) {
        const statusMap = {};
        completionData.assignments.forEach(assignment => {
          statusMap[assignment.id] = assignment.completion_status;
        });
        setAssignmentCompletionStatus(statusMap);
        console.log('获取到作业完成状态:', statusMap);
      }
    } catch (error) {
      console.error('获取作业完成状态失败:', error);
      setAssignmentCompletionStatus({});
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 获取学生所在的课程数据
      try {
        const coursesData = await getTeacherCourses();
        if (coursesData && coursesData.courses) {
          setCourses(coursesData.courses);
          console.log('获取到学生课程数据:', coursesData.courses);
        } else {
          setCourses([]);
        }
      } catch (error) {
        console.warn('获取课程数据失败:', error);
        setCourses([]);
      }

      // 获取作业数据
      try {
        const assignmentsData = await getCourseAssignments();
        if (assignmentsData && assignmentsData.assignments) {
          setAssignments(assignmentsData.assignments);
          console.log('获取到作业数据:', assignmentsData.assignments);
        } else {
          setAssignments([]);
        }
      } catch (error) {
        console.warn('获取作业数据失败:', error);
        setAssignments([]);
      }
      
    } catch (error) {
      setError(error?.response?.data?.error || '获取数据失败');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 查看课程详情
  const handleViewCourseDetail = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setEditingCourse(course);
      setActiveSubTab('detail');
    }
  };

  // 查看作业详情
  const handleViewAssignmentDetail = async (assignment) => {
    try {
      setViewingAssignment(assignment);
      
      // 获取作业包含的题目详情
      if (assignment.problem_ids && assignment.problem_ids.length > 0) {
        try {
          // 调用API获取题目详情
          const problemsData = await getProblems(1, 100); // 获取前100个题目
          if (problemsData && problemsData.problems) {
            // 过滤出作业中包含的题目
            const assignmentProblemsList = problemsData.problems.filter(problem => 
              assignment.problem_ids.includes(problem.id)
            );
            
            // 转换为需要的格式
            const formattedProblems = assignmentProblemsList.map(problem => ({
              id: problem.id,
              title: problem.title || `题目 ${problem.id}`,
              description: problem.description || `这是作业"${assignment.name}"中的题目`,
              difficulty: problem.difficulty || '未知',
              type: problem.type || '未知类型'
            }));
            
            setAssignmentProblems(formattedProblems);
            console.log(`获取到作业"${assignment.name}"的题目:`, formattedProblems);
          } else {
            // 如果API调用失败，使用题目ID作为备选
            const formattedProblems = assignment.problem_ids.map((pid, idx) => ({
              id: pid,
              title: `题目 ${idx + 1}`,
              description: `这是作业"${assignment.name}"中的题目`,
              difficulty: '未知',
              type: '未知类型'
            }));
            setAssignmentProblems(formattedProblems);
          }
        } catch (error) {
          console.warn('获取题目详情失败，使用备选数据:', error);
          const formattedProblems = assignment.problem_ids.map((pid, idx) => ({
            id: pid,
            title: `题目 ${idx + 1}`,
            description: `这是作业"${assignment.name}"中的题目`,
            difficulty: '未知',
            type: '未知类型'
          }));
          setAssignmentProblems(formattedProblems);
        }
      } else {
        setAssignmentProblems([]);
      }
    } catch (error) {
      console.error('查看作业详情失败:', error);
    }
  };

  // 关闭作业详情
  const handleCloseAssignmentDetail = () => {
    setViewingAssignment(null);
    setAssignmentProblems([]);
  };

  // 返回课程列表
  const handleBackToCourses = () => {
    setEditingCourse(null);
    setActiveSubTab('list');
  };

  // 格式化日期显示
  const formatDate = (dateString) => {
    if (!dateString) return '未知';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  const renderCoursesTab = () => (
    <div className="tab-content">
      <div className="sub-tabs">
        <button 
          className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('list')}
        >
          课程列表
        </button>
        {editingCourse && (
          <button 
            className={`sub-tab-btn ${activeSubTab === 'detail' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('detail')}
          >
            课程详情
          </button>
        )}
      </div>

      <div className="section-content">
        {activeSubTab === 'list' && (
          <div className="courses-list">
            {loading ? (
              <div className="loading">加载中...</div>
            ) : courses.length === 0 ? (
              <div className="empty-state">
                <p>暂无课程</p>
              </div>
            ) : (
              <div className="courses-grid">
                {courses.map(course => (
                  <div key={course.id} className="course-card">
                    <div className="course-header">
                      <h3>{course.name}</h3>
                      <span className="course-code">课程编号: {course.id}</span>
                    </div>
                    <div className="course-body">
                      <p className="course-desc">{course.description || '暂无课程描述'}</p>
                      <div className="course-info">
                        <span className="teacher-name">授课教师: {course.teacher_name || '未知'}</span>
                        <span className="student-count">学生数量: {course.student_count || 0}</span>
                      </div>
                      <div className="course-actions">
                        <button className="view-detail-btn" onClick={() => handleViewCourseDetail(course.id)}>查看详情</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'detail' && editingCourse && (
          <div className="course-detail">
            <div className="course-detail-header">
              <h2>{editingCourse.name}</h2>
              <button className="back-btn" onClick={handleBackToCourses}>返回课程列表</button>
            </div>
            
            <div className="course-info-grid">
              <div className="info-item">
                <label>课程编号</label>
                <span>{editingCourse.id}</span>
              </div>
              <div className="info-item">
                <label>授课教师</label>
                <span>{editingCourse.teacher_name || '未知'}</span>
              </div>
              <div className="info-item">
                <label>学生数量</label>
                <span>{editingCourse.student_count || 0}</span>
              </div>
            </div>
            
            <div className="assignments-section">
              <h3>课程作业</h3>
              {assignments.length === 0 ? (
                <div className="empty-state">
                  <p>该课程暂无作业</p>
                </div>
              ) : (
                <div className="assignments-grid">
                  {assignments
                    .filter(a => a.course_id === editingCourse.id)
                    .map(assignment => {
                      const completionStatus = assignmentCompletionStatus[assignment.id];
                      return (
                        <div key={assignment.id} className="assignment-card" onClick={() => handleViewAssignmentDetail(assignment)}>
                          <div className="assignment-header">
                            <h4>{assignment.name}</h4>
                            <span className={`status-badge ${assignment.is_active ? 'active' : 'inactive'}`}>
                              {assignment.is_active ? '进行中' : '已结束'}
                            </span>
                          </div>
                          <div className="assignment-body">
                            <p className="assignment-desc">{assignment.description || '暂无描述'}</p>
                            <div className="assignment-info">
                              <span className="due-date">截止时间: {formatDate(assignment.due_date)}</span>
                            </div>
                            {completionStatus && (
                              <div className="completion-status">
                                <p>
                                  完成状态：
                                  <span className={`status-text ${completionStatus.is_completed ? 'completed' : 'in-progress'}`}>
                                    {completionStatus.status_text}
                                  </span>
                                </p>
                                <p>
                                  完成进度：
                                  <span className="progress-text">
                                    {completionStatus.completed_problems}/{completionStatus.total_problems} 
                                    ({completionStatus.completion_percentage}%)
                                  </span>
                                </p>
                                <div className="progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ width: `${completionStatus.completion_percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                            <p className="click-hint">💡 点击查看作业详情和题目</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>学生仪表板</h1>
            <p>欢迎回来，{JSON.parse(localStorage.getItem('user') || '{}').name}！</p>
          </div>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="dashboard-tabs-row">
        <div className="dashboard-tabs">
          <button 
            className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('courses');
              setActiveSubTab('list');
              setEditingCourse(null);
            }}
          >
            我的课程
          </button>
        </div>
        <div className="dashboard-tabs-actions">
          <Link to="/student/change-password" className="change-password-inline-btn">🔐 修改密码</Link>
        </div>
      </div>

      {activeTab === 'courses' && renderCoursesTab()}

      {/* 作业详情弹窗 */}
      {viewingAssignment && (
        <div className="modal-overlay" onClick={handleCloseAssignmentDetail}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 作业详情：{viewingAssignment.name}</h3>
              <div className="modal-header-actions">
                <button 
                  className="refresh-btn"
                  onClick={() => {
                    if (editingCourse && editingCourse.id) {
                      fetchAssignmentCompletionStatus(editingCourse.id);
                    }
                  }}
                  title="刷新完成状态"
                >
                  🔄 刷新状态
                </button>
                <button className="close-btn" onClick={handleCloseAssignmentDetail}>
                  ×
                </button>
              </div>
            </div>
            
            <div className="modal-body">
              {/* 作业基本信息 */}
              <div className="assignment-detail-section">
                <h4>📋 作业信息</h4>
                <div className="detail-info-grid">
                  <div className="detail-info-item">
                    <label>作业名称：</label>
                    <span>{viewingAssignment.name}</span>
                  </div>
                  <div className="detail-info-item">
                    <label>作业描述：</label>
                    <span>{viewingAssignment.description || '暂无描述'}</span>
                  </div>
                  <div className="detail-info-item">
                    <label>作业要求：</label>
                    <span>{viewingAssignment.requirements || '暂无要求'}</span>
                  </div>
                  <div className="detail-info-item">
                    <label>截止时间：</label>
                    <span>{formatDate(viewingAssignment.due_date)}</span>
                  </div>
                  <div className="detail-info-item">
                    <label>作业状态：</label>
                    <span className={`status-badge ${viewingAssignment.is_active ? 'active' : 'inactive'}`}>
                      {viewingAssignment.is_active ? '进行中' : '已结束'}
                    </span>
                  </div>
                  <div className="detail-info-item">
                    <label>题目数量：</label>
                    <span>{assignmentProblems.length}题</span>
                  </div>
                  {/* 添加完成状态显示 */}
                  {assignmentCompletionStatus[viewingAssignment.id] && (
                    <>
                      <div className="detail-info-item">
                        <label>完成状态：</label>
                        <span className={`completion-status ${assignmentCompletionStatus[viewingAssignment.id].is_completed ? 'completed' : 'in-progress'}`}>
                          {assignmentCompletionStatus[viewingAssignment.id].status_text}
                        </span>
                      </div>
                      <div className="detail-info-item">
                        <label>完成进度：</label>
                        <span className="progress-text">
                          {assignmentCompletionStatus[viewingAssignment.id].completed_problems}/{assignmentCompletionStatus[viewingAssignment.id].total_problems} 
                          ({assignmentCompletionStatus[viewingAssignment.id].completion_percentage}%)
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                {/* 添加进度条显示 */}
                {assignmentCompletionStatus[viewingAssignment.id] && (
                  <div className="completion-progress-detail">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${assignmentCompletionStatus[viewingAssignment.id].completion_percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 作业题目列表 */}
              <div className="assignment-problems-section">
                <h4>📚 作业题目</h4>
                {assignmentProblems.length === 0 ? (
                  <div className="empty-problems">
                    <p>该作业暂无题目</p>
                  </div>
                ) : (
                  <div className="problems-list">
                    {assignmentProblems.map((problem, index) => (
                      <div key={problem.id} className="problem-item">
                        <div className="problem-header">
                          <span className="problem-number">题目 {index + 1}</span>
                          <span className="problem-id">ID: {problem.id}</span>
                        </div>
                        <div className="problem-content">
                          <h5>{problem.title}</h5>
                          <p>{problem.description}</p>
                          <div className="problem-meta">
                            <span className="problem-difficulty">难度: {problem.difficulty}</span>
                            <span className="problem-type">类型: {problem.type}</span>
                          </div>
                          <div className="problem-actions">
                            <button 
                              className="view-problem-btn"
                              onClick={() => {
                                // 跳转到题目详情页
                                window.open(`/problem/${problem.id}`, '_blank');
                              }}
                            >
                              👁️ 查看题目
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="close-modal-btn" onClick={handleCloseAssignmentDetail}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboardPage;

// 导入axios库，用于发送HTTP请求
import axios from 'axios';

// 定义API基础URL，指向后端服务地址
const API_BASE_URL = 'http://localhost:5001';

// 创建axios实例，添加请求拦截器
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// 请求拦截器：添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理认证错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * 用户认证相关API
 */

// 用户登录
export const login = async (data) => {
  const response = await api.post('/auth/login', data);
  return response.data;
};

// 用户注册
export const register = async (data) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

// 管理员注册
export const registerAdmin = async (data) => {
  const response = await api.post('/auth/register/admin', data);
  return response.data;
};

// 教师创建学生账号
export const registerStudent = async (data) => {
  const response = await api.post('/auth/register/student', data);
  return response.data;
};

// 管理员创建教师账号
export const registerTeacher = async (data) => {
  const response = await api.post('/auth/register/teacher', data);
  return response.data;
};

// 密码找回
export const forgotPassword = async (data) => {
  const response = await api.post('/auth/forgot-password', data);
  return response.data;
};

// 重置密码
export const resetPassword = async (data) => {
  const response = await api.post('/auth/reset-password', data);
  return response.data;
};

/**
 * 题目相关API
 */

// 获取题目列表
export const getProblems = async (page = 1, perPage = 10, difficulty = '') => {
  const params = { page, per_page: perPage };
  if (difficulty) params.difficulty = difficulty;
  
  const response = await api.get('/problems', { params });
  return response.data;
};

// 获取题目详情
export const getProblem = async (problemId) => {
  const response = await api.get(`/problems/${problemId}`);
  return response.data;
};

// 创建题目（教师权限）
export const createProblem = async (data) => {
  const response = await api.post('/problems', data);
  return response.data;
};


// 更新题目（教师权限）
export const updateProblem = async (problemId, data) => {
  const response = await api.put(`/problems/${problemId}`, data);
  return response.data;
};

// 删除题目（教师权限）
export const deleteProblem = async (problemId) => {
  const response = await api.delete(`/problems/${problemId}`);
  return response.data;
};

// 提交代码到后端服务
export const submitCode = async (data) => {
  const response = await api.post('/submit', data);
  return response.data;
};

// 获取代码提交结果
export const getResult = async (submissionId) => {
  const response = await api.get(`/result/${submissionId}`);
  return response.data;
};

// 获取提交历史
export const getSubmissions = async (page = 1, perPage = 20, problemId = null, problemTitle = null) => {
  const params = { page, per_page: perPage };
  if (problemId) params.problem_id = problemId;
  if (problemTitle) params.problem_title = problemTitle;  // 新增：支持题目名称筛选
  
  const response = await api.get('/submissions', { params });
  return response.data;
};

/**
 * 用户管理相关API（教师权限）
 */

// 获取用户列表
export const getUsers = async (
  page = 1,
  perPage = 20,
  role = null,
  classId = null,
  username = null,
  name = null
) => {
  const params = { page, per_page: perPage };
  if (role) params.role = role;
  if (classId) params.class_id = classId;
  if (username) params.username = username;
  if (name) params.name = name;
  const response = await api.get('/users', { params });
  return response.data;
};

// 更新用户信息
export const updateUser = async (userId, data) => {
  const response = await api.put(`/users/${userId}`, data);
  return response.data;
};

// 删除用户
export const deleteUser = async (userId) => {
  const response = await api.delete(`/users/${userId}`);
  return response.data;
};

// 批量导入学生
export const batchImportStudents = async (data) => {
  const response = await api.post('/users/batch-import', data);
  return response.data;
};

// 批量导入学生（从Excel文件）
export const batchImportStudentsFromExcel = async (formData) => {
  const response = await api.post('/users/batch-import-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * 组织架构相关API
 */

// 获取学校列表
export const getSchools = async () => {
  const response = await api.get('/schools');
  return response.data;
};

// 获取院部列表
export const getDepartments = async (schoolId = null) => {
  const params = {};
  if (schoolId) params.school_id = schoolId;
  
  const response = await api.get('/departments', { params });
  return response.data;
};

// 获取专业列表
export const getMajors = async (schoolId = null) => {
  const params = {};
  if (schoolId) params.school_id = schoolId;
  
  const response = await api.get('/majors', { params });
  return response.data;
};

// 获取班级列表
export const getClasses = async (majorId = null) => {
  const params = {};
  if (majorId) params.major_id = majorId;
  
  const response = await api.get('/classes', { params });
  return response.data;
};

// 组织架构管理相关API
export const createSchool = async (data) => {
  const response = await api.post('/schools', data);
  return response.data;
};

export const updateSchool = async (schoolId, data) => {
  const response = await api.put(`/schools/${schoolId}`, data);
  return response.data;
};

export const deleteSchool = async (schoolId) => {
  const response = await api.delete(`/schools/${schoolId}`);
  return response.data;
};

export const createDepartment = async (data) => {
  const response = await api.post('/departments', data);
  return response.data;
};

export const updateDepartment = async (departmentId, data) => {
  const response = await api.put(`/departments/${departmentId}`, data);
  return response.data;
};

export const deleteDepartment = async (departmentId) => {
  const response = await api.delete(`/departments/${departmentId}`);
  return response.data;
};

export const createMajor = async (data) => {
  const response = await api.post('/majors', data);
  return response.data;
};

export const updateMajor = async (majorId, data) => {
  const response = await api.put(`/majors/${majorId}`, data);
  return response.data;
};

export const deleteMajor = async (majorId) => {
  const response = await api.delete(`/majors/${majorId}`);
  return response.data;
};

export const createClass = async (data) => {
  const response = await api.post('/classes', data);
  return response.data;
};

export const updateClass = async (classId, data) => {
  const response = await api.put(`/classes/${classId}`, data);
  return response.data;
};

export const deleteClass = async (classId) => {
  const response = await api.delete(`/classes/${classId}`);
  return response.data;
};

// AI生成题目（延长超时至60秒）
export const aiGenerateProblem = async (requirements) => {
  const response = await api.post('/problems/ai-generate', { requirements }, { timeout: 60000 });
  return response.data;
};

// 预览AI生成的题目（延长超时至60秒）
export const aiPreviewProblem = async (problemData) => {
  const response = await api.post('/problems/ai-preview', problemData, { timeout: 60000 });
  return response.data;
};

// AI验证并创建题目（延长超时至60秒）
export const aiValidateAndCreateProblem = async (problemData) => {
  const response = await api.post('/problems/ai-validate', problemData, { timeout: 60000 });
  return response.data;
};

// 获取AI生成历史（延长超时至60秒，以防慢查询）
export const getAiHistory = async () => {
  const response = await api.get('/problems/ai-history', { timeout: 60000 });
  return response.data;
};

/**
 * 课程管理相关API
 */

// 获取所有课程（管理员权限）
export const getAllCourses = async (page = 1, perPage = 50) => {
  const params = { page, per_page: perPage };
  const response = await api.get('/courses/all', { params });
  return response.data;
};

// 获取教师的课程列表
export const getTeacherCourses = async (teacherId = null) => {
  const params = {};
  if (teacherId) params.teacher_id = teacherId;
  
  const response = await api.get('/courses', { params });
  return response.data;
};

// 创建课程
export const createCourse = async (data) => {
  const response = await api.post('/courses', data);
  return response.data;
};

// 更新课程
export const updateCourse = async (courseId, data) => {
  const response = await api.put(`/courses/${courseId}`, data);
  return response.data;
};

// 删除课程
export const deleteCourse = async (courseId) => {
  const response = await api.delete(`/courses/${courseId}`);
  return response.data;
};

// 获取课程详情
export const getCourseDetail = async (courseId) => {
  const response = await api.get(`/courses/${courseId}`);
  return response.data;
};

/**
 * 作业管理相关API
 */

// 获取课程的作业列表
export const getCourseAssignments = async (courseId = null) => {
  const params = {};
  if (courseId) params.course_id = courseId;
  
  const response = await api.get('/assignments', { params });
  return response.data;
};

// 获取作业列表
export const getAssignments = async (courseId = null) => {
  const params = {};
  if (courseId) params.course_id = courseId;
  
  const response = await api.get('/assignments', { params });
  return response.data;
};

// 获取学生作业完成状态
export const getAssignmentCompletionStatus = async (courseId) => {
  const response = await api.get(`/assignments/completion-status?course_id=${courseId}`);
  return response.data;
};

// 创建作业
export const createAssignment = async (data) => {
  const response = await api.post('/assignments', data);
  return response.data;
};

// 更新作业
export const updateAssignment = async (assignmentId, data) => {
  const response = await api.put(`/assignments/${assignmentId}`, data);
  return response.data;
};

// 删除作业
export const deleteAssignment = async (assignmentId) => {
  const response = await api.delete(`/assignments/${assignmentId}`);
  return response.data;
};

/**
 * 补交作业相关API
 */

// 获取作业逾期用户白名单
export const getAssignmentOverdueUsers = async (assignmentId) => {
  const response = await api.get(`/assignments/${assignmentId}/overdue-users`);
  return response.data;
};

// 添加用户到逾期白名单
export const addUserToOverdueWhitelist = async (assignmentId, userId) => {
  const response = await api.post(`/assignments/${assignmentId}/overdue-users`, {
    user_id: userId
  });
  return response.data;
};

// 从逾期白名单移除用户
export const removeUserFromOverdueWhitelist = async (assignmentId, userId) => {
  const response = await api.delete(`/assignments/${assignmentId}/overdue-users/${userId}`);
  return response.data;
};

// 更新作业逾期设置
export const updateAssignmentOverdueSettings = async (assignmentId, settings) => {
  const response = await api.put(`/assignments/${assignmentId}/overdue-settings`, settings);
  return response.data;
};

// 检查学生是否可以补交作业
export const checkStudentOverduePermission = async (assignmentId) => {
  const response = await api.get(`/assignments/${assignmentId}/can-overdue-submit`);
  return response.data;
};

// 获取作业详情
export const getAssignmentDetail = async (assignmentId) => {
  const response = await api.get(`/assignments/${assignmentId}`);
  return response.data;
};

/**
 * 学生-课程关联关系管理API
 */

// 获取课程的学生列表
export const getCourseStudents = async (courseId) => {
  const response = await api.get(`/courses/${courseId}/students`);
  return response.data;
};

// 添加学生到课程
export const addStudentToCourse = async (courseId, studentData) => {
  const response = await api.post(`/courses/${courseId}/students`, studentData);
  return response.data;
};

// 从课程中移除学生（关联添加的学生）
export const removeStudentFromCourse = async (courseId, studentId) => {
  const response = await api.delete(`/courses/${courseId}/students/${studentId}`);
  return response.data;
};

// 原班级学生退课（排除）
export const excludeOriginalStudent = async (courseId, studentId) => {
  const response = await api.post(`/courses/${courseId}/students/${studentId}/exclude`);
  return response.data;
};

// 取消退课（恢复）
export const cancelExcludeOriginalStudent = async (courseId, studentId) => {
  const response = await api.delete(`/courses/${courseId}/students/${studentId}/exclude`);
  return response.data;
};
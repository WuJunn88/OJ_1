import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, getSchools, getMajors, getClasses, getProblems, createProblem, updateProblem, deleteProblem, updateUser, deleteUser, registerStudent, getTeacherCourses, getCourseAssignments, createAssignment, updateAssignment, deleteAssignment, getCourseStudents, addStudentToCourse, removeStudentFromCourse, getDepartments, batchImportStudentsFromExcel, excludeOriginalStudent, aiSelectProblems, previewAiSelectedProblems } from '../services/api';
import * as XLSX from 'xlsx';
import './TeacherDashboardPage.css';
import AIProblemGenerationPage from './AIProblemGenerationPage';
import AssignmentWhitelistManager from '../components/AssignmentWhitelistManager';
import { mockCourses, mockAssignments, formatDate } from '../testData/courses';

const TeacherDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('students');
  const [activeSubTab, setActiveSubTab] = useState('list'); // 子标签页
  const [users, setUsers] = useState([]);
  const [problems, setProblems] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 批量导入相关状态
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  // 手动创建题目相关状态
  const [problemForm, setProblemForm] = useState({
    title: '',
    description: '',
    type: 'programming', // 题目类型：programming(编程题), choice(选择题), judge(判断题), short_answer(简答题)
    testCases: [], // 测试用例数组，每个元素包含 {id, input, output}
    difficulty: 'easy',
    time_limit: 1000,
    memory_limit: 128,
    // 选择题相关字段
    options: [], // 选项数组
    correct_answers: [], // 正确答案数组（支持多选）
    is_multiple_choice: false, // 是否多选
    // 简答题相关字段
    answer: '' // 简答题答案
  });

  // 滚动动画相关状态
  const [scrollAnimations, setScrollAnimations] = useState({
    formVisible: false,
    bottomFormVisible: false
  });

  // 课程详情页荷叶式动画状态
  const [courseDetailAnimations, setCourseDetailAnimations] = useState({
    courseInfoVisible: false,
    studentsSectionVisible: false,
    assignmentsSectionVisible: false
  });
  

  // 编辑题目状态
  const [editingProblem, setEditingProblem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20); // 每页显示20个题目
  const [totalProblems, setTotalProblems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 测试用例管理函数
  const addTestCase = () => {
    const newTestCase = {
      id: Date.now() + Math.random(), // 生成唯一ID
      input: '',
      output: ''
    };
    setProblemForm(prev => ({
      ...prev,
      testCases: [...prev.testCases, newTestCase]
    }));
  };

  const removeTestCase = (testCaseId) => {
    setProblemForm(prev => ({
      ...prev,
      testCases: prev.testCases.filter(tc => tc.id !== testCaseId)
    }));
  };

  const updateTestCase = (testCaseId, field, value) => {
    setProblemForm(prev => ({
      ...prev,
      testCases: prev.testCases.map(tc => 
        tc.id === testCaseId ? { ...tc, [field]: value } : tc
      )
    }));
  };

  // 解析后端测试用例格式的函数
  const parseTestCases = (testCasesStr, expectedOutputStr) => {
    if (!testCasesStr && !expectedOutputStr) {
      return [];
    }
    
    // 优先尝试解析JSON数组格式：[ { input, output }, ... ]
    try {
      if (testCasesStr && testCasesStr.trim().startsWith('[')) {
        const parsed = JSON.parse(testCasesStr);
        if (Array.isArray(parsed)) {
          return parsed.map((tc, idx) => ({
            id: Date.now() + Math.random() + idx,
            input: (tc && typeof tc.input !== 'undefined') ? String(tc.input) : '',
            output: (tc && typeof tc.output !== 'undefined') ? String(tc.output) : ''
          }));
        }
      }
    } catch (e) {
      // JSON解析失败则回退到旧格式
      console.warn('解析JSON测试用例失败，回退旧格式:', e);
    }
    
    const testCases = testCasesStr ? testCasesStr.split('\n').filter(line => line.trim()) : [];
    const expectedOutputs = expectedOutputStr ? expectedOutputStr.split('\n').filter(line => line.trim()) : [];
    
    const maxLength = Math.max(testCases.length, expectedOutputs.length);
    
    const result = [];
    for (let i = 0; i < maxLength; i++) {
      result.push({
        id: Date.now() + Math.random() + i, // 生成唯一ID
        input: testCases[i] || '', // 如果没有输入则使用空字符串
        output: expectedOutputs[i] || '' // 输出是必填的
      });
    }
    
    return result;
  };

  // 添加学生相关状态（按新规则：学号、姓名、密码必填）
  const [addStudentForm, setAddStudentForm] = useState({
    student_no: '',
    name: '',
    password: '',
    email: '',
    phone: '',
    school_id: '',
    department_id: '',
    major_id: '',
    class_id: ''
  });

  // 学生编辑相关状态
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
    school_id: '',
    major_id: '',
    class_id: '',
    new_password: ''
  });

  // 课程相关状态（只读，用于查看）
  const [courses, setCourses] = useState([]);
  const [editingCourse, setEditingCourse] = useState(null);

  // 作业相关状态
  const [assignments, setAssignments] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    name: '',
    description: '',
    requirements: '',
    due_date: '',
    course_id: '',
    problem_ids: [],
    // 补交作业相关字段
    allow_overdue_submission: false,
    overdue_deadline: '',
    overdue_score_ratio: 0.8
  });

  // 编辑作业状态
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentContext, setEditingAssignmentContext] = useState(''); // 记录编辑作业时的上下文
  
  // 添加学生到课程的状态
  const [addingStudentContext, setAddingStudentContext] = useState(''); // 记录添加学生时的上下文
  
  // 学生-教学班关联关系状态
  const [studentClassRelations, setStudentClassRelations] = useState([]); // 存储学生与教学班的关联关系

  // 智能选题相关状态
  const [aiSelectionForm, setAiSelectionForm] = useState({
    requirements: '',
    problem_count: 3
  });
  const [aiSelectedProblems, setAiSelectedProblems] = useState([]);
  const [isAiSelecting, setIsAiSelecting] = useState(false);
  const [aiSelectionResult, setAiSelectionResult] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 单独获取完整题库用于作业选题（不受分页限制）
  useEffect(() => {
    (async () => {
      try {
        const all = await getProblems(1, 9999, '', true);
        if (all && all.problems) {
          setAllProblems(all.problems);
        }
      } catch (e) {
        console.warn('获取全部题目失败:', e);
      }
    })();
  }, []);

  // 滚动监听和动画触发
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // 检测表单是否进入视口
      if (scrollY > 100) {
        setScrollAnimations(prev => ({ ...prev, formVisible: true }));
      }
      
      // 检测是否接近底部，触发底部表单动画
      if (scrollY + windowHeight > documentHeight - 200) {
        setScrollAnimations(prev => ({ ...prev, bottomFormVisible: true }));
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    // 初始触发
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 课程详情页荷叶式动画滚动监听
  useEffect(() => {
    if (activeSubTab === 'detail' && editingCourse) {
      const handleCourseDetailScroll = () => {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        
        // 课程基本信息 - 当滚动到页面中央时浮现
        if (scrollY > windowHeight * 0.3) {
          setCourseDetailAnimations(prev => ({ ...prev, courseInfoVisible: true }));
        }
        
        // 教学班学生 - 当滚动到页面中央偏下时浮现
        if (scrollY > windowHeight * 0.6) {
          setCourseDetailAnimations(prev => ({ ...prev, studentsSectionVisible: true }));
        }
        
        // 已布置作业 - 当滚动到页面底部时浮现
        if (scrollY > windowHeight * 0.9) {
          setCourseDetailAnimations(prev => ({ ...prev, assignmentsSectionVisible: true }));
        }
      };

      window.addEventListener('scroll', handleCourseDetailScroll);
      
      // 初始触发
      handleCourseDetailScroll();
      
      return () => window.removeEventListener('scroll', handleCourseDetailScroll);
    }
  }, [activeSubTab, editingCourse]);

  useEffect(() => {
    fetchInitialData();
    
    // 监听多种通知方式，用于AI生题成功后的数据刷新
    const handleStorageChange = (e) => {
      if (e.key === 'refreshProblems' && e.newValue === 'true') {
        console.log('检测到题目创建成功标记，自动刷新题目列表');
        // 清除标记
        localStorage.removeItem('refreshProblems');
        // 刷新题目列表
        fetchProblems();
      }
    };
    
    const handleProblemCreated = (e) => {
      console.log('检测到题目创建成功事件，自动刷新题目列表');
      fetchProblems();
    };
    
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'PROBLEM_CREATED') {
        console.log('检测到题目创建成功消息，自动刷新题目列表');
        fetchProblems();
      }
    };
    
    // 监听storage事件（跨标签页）
    window.addEventListener('storage', handleStorageChange);
    
    // 监听自定义事件
    window.addEventListener('problemCreated', handleProblemCreated);
    
    // 监听postMessage
    window.addEventListener('message', handleMessage);
    
    // 检查是否需要刷新（当前标签页）
    const shouldRefresh = localStorage.getItem('refreshProblems');
    if (shouldRefresh === 'true') {
      console.log('检测到题目创建成功标记，自动刷新题目列表');
      localStorage.removeItem('refreshProblems');
      fetchProblems();
    }
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('problemCreated', handleProblemCreated);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

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

  // 刷新题目列表
  const fetchProblems = async (page = currentPage) => {
    try {
      const problemsData = await getProblems(page, perPage);
      if (problemsData && problemsData.problems) {
        setProblems(problemsData.problems);
        setTotalProblems(problemsData.total);
        setTotalPages(problemsData.pages);
        setCurrentPage(page);
        console.log(`题目列表刷新成功，第${page}页，题目数量: ${problemsData.problems.length}，总计: ${problemsData.total}`);
      }
    } catch (error) {
      console.warn('刷新题目列表失败:', error);
    }
  };

  // 分页控制函数
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchProblems(newPage);
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1); // 重置到第一页
    fetchProblems(1);
  };

  // 监听课程变化，加载课程学生关联关系
  useEffect(() => {
    const loadCourseStudents = async () => {
      if (editingCourse && editingCourse.id) {
        console.log('开始加载课程学生数据，课程ID:', editingCourse.id);
        await fetchStudentClassRelations(editingCourse.id);
      }
    };
    
    loadCourseStudents();
  }, [editingCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const [schoolsData, usersData, problemsData] = await Promise.all([
        getSchools(),
        getUsers(1, 50, 'student'),
        getProblems(1, perPage)  // 使用分页参数
      ]);
      
      setSchools(schoolsData);
      setUsers(usersData.users);
      setProblems(problemsData.problems);
      setTotalProblems(problemsData.total);
      setTotalPages(problemsData.pages);
      setCurrentPage(1);
      
      // 获取所有专业和班级数据 - 确保schools数据已经设置
      if (schoolsData && schoolsData.length > 0) {
        await fetchAllMajorsAndClasses(schoolsData);
      }
      
      // 调试信息：打印题目数据
      console.log('从API获取的题目数据:', problemsData.problems);
      if (problemsData.problems && problemsData.problems.length > 0) {
        problemsData.problems.forEach((problem, index) => {
          console.log(`题目 ${index + 1}:`, {
            id: problem.id,
            title: problem.title,
            type: problem.type,
            difficulty: problem.difficulty
          });
        });
      }
      
      // 获取课程和作业数据（使用测试数据）
      try {
        console.log('开始获取课程和作业数据...');
        const [coursesData, assignmentsData] = await Promise.all([
          getTeacherCourses(),
          getCourseAssignments()
        ]);
        
        console.log('API返回的课程数据:', coursesData);
        console.log('API返回的作业数据:', assignmentsData);
        
        if (coursesData && coursesData.courses) {
          console.log('使用API返回的课程数据，课程数量:', coursesData.courses.length);
          setCourses(coursesData.courses);
        } else {
          console.log('API返回的课程数据无效，使用测试数据');
          setCourses(mockCourses);
        }
        
        if (assignmentsData && assignmentsData.assignments) {
          console.log('使用API返回的作业数据，作业数量:', assignmentsData.assignments.length);
          setAssignments(assignmentsData.assignments);
        } else {
          console.log('API返回的作业数据无效，使用测试数据');
          setAssignments(mockAssignments);
        }
      } catch (error) {
        console.warn('获取课程或作业数据失败，使用测试数据:', error);
        console.log('错误详情:', error.response?.data || error.message);
        setCourses(mockCourses);
        setAssignments(mockAssignments);
      }
      
      // 学生-课程关联关系数据将在进入课程详情页时从API加载
    } catch (error) {
      setError(error?.response?.data?.error || '获取数据失败');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  // 获取所有专业和班级数据的函数
  const fetchAllMajorsAndClasses = async (schoolsData = null) => {
    // 防止重复调用
    if (fetchAllMajorsAndClasses.isLoading) {
      console.log('fetchAllMajorsAndClasses 正在执行中，跳过重复调用');
      return;
    }
    
    fetchAllMajorsAndClasses.isLoading = true;
    
    try {
      // 使用传入的schoolsData参数，如果没有传入则使用state中的schools
      const schoolsToUse = schoolsData || schools;
      
      if (!schoolsToUse || schoolsToUse.length === 0) {
        console.warn('没有学校数据，无法获取专业和班级');
        return;
      }
      
      console.log('开始获取数据，学校数量:', schoolsToUse.length);
      console.log('学校数据:', schoolsToUse);
      
      // 按照正确的层次结构获取数据：学校 → 院部 → 专业 → 班级
      const allDepartments = [];
      const allMajors = [];
      const allClasses = [];
      
      for (const school of schoolsToUse) {
        try {
          console.log(`正在获取学校 ${school.id} (${school.name}) 的数据...`);
          
          // 1. 获取学校的院部
          const departmentsData = await getDepartments(school.id);
          console.log(`学校 ${school.id} 的院部数据:`, departmentsData);
          allDepartments.push(...departmentsData);
          
          // 2. 获取学校下的所有专业（按school_id过滤）
          try {
            console.log(`正在获取学校 ${school.id} 的专业...`);
            const majorsData = await getMajors(school.id);
            console.log(`学校 ${school.id} 的专业数据:`, majorsData);
            allMajors.push(...majorsData);
            
            // 3. 获取每个专业的班级
            for (const major of majorsData) {
              try {
                console.log(`正在获取专业 ${major.id} (${major.name}) 的班级...`);
                const classesData = await getClasses(major.id);
                console.log(`专业 ${major.id} 的班级数据:`, classesData);
                allClasses.push(...classesData);
              } catch (error) {
                console.error(`获取专业 ${major.id} 的班级失败:`, error);
              }
            }
          } catch (error) {
            console.error(`获取学校 ${school.id} 的专业失败:`, error);
          }
        } catch (error) {
          console.error(`获取学校 ${school.id} 的院部失败:`, error);
        }
      }
      
      console.log('最终获取到的数据:');
      console.log('院部:', allDepartments);
      console.log('专业:', allMajors);
      console.log('班级:', allClasses);
      
      setDepartments(allDepartments);
      setMajors(allMajors);
      setClasses(allClasses);
      
      console.log('获取到的所有院部:', allDepartments);
      console.log('获取到的所有专业:', allMajors);
      console.log('获取到的所有班级:', allClasses);
    } catch (error) {
      console.error('获取所有院部、专业和班级失败:', error);
    } finally {
      fetchAllMajorsAndClasses.isLoading = false;
    }
  };

  const handleSchoolChange = async (schoolId) => {
    setSelectedSchool(schoolId);
    setSelectedDepartment('');
    setSelectedMajor('');
    setSelectedClass('');
    
    // 不再重置全局的departments、majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleDepartmentChange = async (departmentId) => {
    setSelectedDepartment(departmentId);
    setSelectedMajor('');
    setSelectedClass('');
    
    // 不再重置全局的majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleMajorChange = async (majorId) => {
    setSelectedMajor(majorId);
    setSelectedClass('');
    
    // 不再重置全局的classes数组
    // 这个数组应该保持完整，用于学生列表显示
  };

  const handleBatchImport = async () => {
    if (!uploadedFile) {
      setError('请选择要上传的Excel文件');
      setSuccess('');
      return;
    }

    if (!selectedSchool || !selectedDepartment || !selectedMajor || !selectedClass) {
      setError('请选择学校、院部、专业和班级');
      setSuccess('');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 创建FormData对象来上传文件
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('school_id', selectedSchool);
      formData.append('department_id', selectedDepartment);
      formData.append('major_id', selectedMajor);
      formData.append('class_id', selectedClass);
      
      // 调用新的批量导入API
      const resp = await batchImportStudentsFromExcel(formData);
      
      const msg = resp?.message || `批量导入完成: 成功 ${resp?.success_count ?? 0} 个, 失败 ${resp?.failed_count ?? 0} 个`;
      setSuccess(msg);
      
      if (resp?.errors && resp.errors.length > 0) {
        const preview = resp.errors.slice(0, 5).join('；');
        setError(`部分导入失败：${preview}${resp.errors.length > 5 ? ' 等' : ''}`);
      }
      
      // 刷新用户列表
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
      
      // 清理上传的文件
      setUploadedFile(null);
      
    } catch (error) {
      setError(error.response?.data?.error || '批量导入失败');
    } finally {
      setLoading(false);
    }
  };

  // 下载Excel模板
  const handleDownloadTemplate = () => {
    // 创建Excel模板数据
    const templateData = [
      ['学号', '姓名', '密码'],
      ['2021001', '张三', '123456'],
      ['2021002', '李四', '123456'],
      ['2021003', '王五', '123456']
    ];
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 学号列宽
      { wch: 15 }, // 姓名列宽
      { wch: 15 }  // 密码列宽
    ];
    worksheet['!cols'] = colWidths;
    
    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '学生信息');
    
    // 生成Excel文件并下载
    XLSX.writeFile(workbook, '学生信息导入模板.xlsx');
    
    setSuccess('Excel模板下载成功！请填写学生信息后重新上传。');
  };

  // 处理文件上传
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // 检查文件类型
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validTypes.includes(fileExtension)) {
        setError('请选择有效的Excel文件格式（.xlsx, .xls, .csv）');
        return;
      }
      
      // 检查文件大小（5MB限制）
      if (file.size > 5 * 1024 * 1024) {
        setError('文件大小不能超过5MB');
        return;
      }
      
      setUploadedFile(file);
      setError('');
      setSuccess('文件选择成功！');
    }
  };

  // 移除上传的文件
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setError('');
    setSuccess('');
  };

  const handleCreateProblem = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 构建提交给后端的数据
      const submitData = { ...problemForm };
      
      // 如果是选择题，需要将options数组转换为choice_options字符串
      if (problemForm.type === 'choice') {
        // 将选项数组转换为字符串格式：A.选项内容\nB.选项内容\nC.选项内容
        submitData.choice_options = problemForm.options
          .map((option) => `${option.id}.${option.text}`)
          .join('\n');
        
        // 将正确答案数组转换为expected_output字符串
        submitData.expected_output = problemForm.correct_answers.join(',');
        
        // 删除前端特有的字段，避免后端报错
        delete submitData.options;
        delete submitData.correct_answers;
      }
      
      // 如果是判断题，需要特殊处理
      if (problemForm.type === 'judge') {
        // 判断题的选项固定为"正确"和"错误"
        submitData.choice_options = 'A.正确\nB.错误';
        
        // 将正确答案转换为expected_output
        submitData.expected_output = problemForm.correct_answers.join(',');
        
        // 删除前端特有的字段
        delete submitData.options;
        delete submitData.correct_answers;
      }
      
      // 如果是简答题，需要特殊处理
      if (problemForm.type === 'short_answer') {
        // 将简答题答案设置为expected_output
        submitData.expected_output = problemForm.answer;
        
        // 删除前端特有的字段
        delete submitData.answer;
      }
      
      // 如果是编程题，改为JSON结构提交测试用例
      if (problemForm.type === 'programming') {
        const testCases = problemForm.testCases || [];
        if (testCases.length === 0) {
          throw new Error('编程题至少需要一个测试用例');
        }
        // 以结构化JSON传输，支持多行输入/输出与空输入
        const structured = testCases.map(tc => ({
          input: tc.input || '',
          output: tc.output || ''
        }));
        submitData.test_cases = JSON.stringify(structured);
        // expected_output 保留为所有输出拼接（兼容旧后端或列表展示）
        submitData.expected_output = testCases.map(tc => tc.output || '').join('\n');
        // 删除前端特有字段
        delete submitData.testCases;
      }
      
      // 添加调试信息
      console.log('提交的题目数据:', submitData);
      console.log('题目类型:', submitData.type);
      console.log('完整表单数据:', JSON.stringify(submitData, null, 2));
      
      if (isEditing && editingProblem) {
        console.log('更新题目，ID:', editingProblem.id);
        await updateProblem(editingProblem.id, submitData);
        setSuccess('题目更新成功！');
      } else {
        console.log('创建新题目');
        await createProblem(submitData);
        setSuccess('题目创建成功！');
      }
      
      // 重置表单
      setProblemForm({
        title: '',
        description: '',
        type: 'programming',
        testCases: [],
        difficulty: 'easy',
        time_limit: 1000,
        memory_limit: 128,
        options: [],
        correct_answers: [],
        is_multiple_choice: false,
        answer: ''
      });
      
      setIsEditing(false);
      setEditingProblem(null);
      
      // 刷新题目列表
      const problemsData = await getProblems(1, perPage);  // 使用分页参数
      setProblems(problemsData.problems);
      setTotalProblems(problemsData.total);
      setTotalPages(problemsData.pages);
      setCurrentPage(1);
      // 同步刷新完整题库，确保作业选题可见最新题目
      try {
        const all = await getProblems(1, 9999, '', true);
        if (all && all.problems) {
          setAllProblems(all.problems);
        }
      } catch (e) {
        console.warn('刷新完整题库失败:', e);
      }
      
      // 切换到题目列表
      setActiveSubTab('list');
      
    } catch (error) {
      console.error('题目操作失败:', error);
      setError(error.response?.data?.error || error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProblem = (problem) => {
    setEditingProblem(problem);
    // 根据题目类型初始化表单数据
    let initialOptions = [];
    let initialCorrectAnswers = [];
    
    if (problem.type === 'choice') {
      // 解析选择题的choice_options字符串
      if (problem.choice_options) {
        const optionLines = problem.choice_options.split('\n').filter(line => line.trim());
        initialOptions = optionLines.map((line, index) => {
          const match = line.match(/^([A-Z])\.(.+)$/);
          if (match) {
            return {
              id: match[1], // 使用字母ID (A, B, C...)
              text: match[2].trim(),
              is_correct: false
            };
          }
          return {
            id: String.fromCharCode(65 + index), // 如果没有匹配到字母，使用默认字母ID
            text: line.trim(),
            is_correct: false
          };
        });
      }
      
      // 解析expected_output中的正确答案
      if (problem.expected_output) {
        const correctAnswers = problem.expected_output.split(',').filter(ans => ans.trim());
        initialCorrectAnswers = correctAnswers;
        
        // 设置选项的正确状态
        initialOptions = initialOptions.map(option => ({
          ...option,
          is_correct: correctAnswers.includes(option.id)
        }));
      }
    } else if (problem.type === 'judge') {
      // 判断题固定选项
      initialOptions = [
        { id: 'A', text: '正确', is_correct: false },
        { id: 'B', text: '错误', is_correct: false }
      ];
      
      // 根据expected_output设置正确答案
      if (problem.expected_output) {
        const correctAnswer = problem.expected_output.trim();
        if (correctAnswer === 'A') {
          initialOptions[0].is_correct = true;
          initialCorrectAnswers = ['A'];
        } else if (correctAnswer === 'B') {
          initialOptions[1].is_correct = true;
          initialCorrectAnswers = ['B'];
        }
      }
    }
    
    setProblemForm({
      title: problem.title,
      description: problem.description,
      type: problem.type || 'programming',
      testCases: problem.type === 'programming' ? parseTestCases(problem.test_cases, problem.expected_output) : [],
      difficulty: problem.difficulty,
      time_limit: problem.time_limit || 1000,
      memory_limit: problem.memory_limit || 128,
      options: initialOptions,
      correct_answers: initialCorrectAnswers,
      is_multiple_choice: problem.is_multiple_choice || false,
      answer: problem.answer || ''
    });
    
    setIsEditing(true);
    setActiveSubTab('create');
  };

  const handleDeleteProblem = async (problemId) => {
    if (!window.confirm('确定要删除这个题目吗？此操作不可恢复。')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await deleteProblem(problemId);
      setSuccess('题目删除成功！');
      
      // 刷新题目列表
      const problemsData = await getProblems(1, perPage);  // 使用分页参数
      setProblems(problemsData.problems);
      setTotalProblems(problemsData.total);
      setTotalPages(problemsData.pages);
      setCurrentPage(1);
      // 同步刷新完整题库，确保作业选题从allProblems中剔除已删除题
      try {
        const all = await getProblems(1, 9999, '', true);
        if (all && all.problems) {
          setAllProblems(all.problems);
        }
      } catch (e) {
        console.warn('刷新完整题库失败:', e);
      }
    } catch (error) {
      setError(error.response?.data?.error || '删除题目失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据题目特征推断题目类型
  const inferProblemType = (problem) => {
    console.log('开始推断题目类型，题目数据:', problem);
    
    // 优先使用明确设置的题目类型
    if (problem.type && problem.type !== 'undefined') {
      console.log('使用明确设置的题目类型:', problem.type);
      return problem.type;
    }
    
    // 如果没有明确设置类型，则通过特征推断
    console.log('没有明确设置类型，开始推断...');
    
    // 检查所有可能的选项字段
    const options = problem.options || problem.choices || problem.alternatives || problem.option_list || [];
    console.log('检查到的选项:', options);
    
    // 如果有选项，判断是选择题还是判断题
    if (Array.isArray(options) && options.length > 0) {
      console.log('发现选项，数量:', options.length);
      
      // 检查是否是判断题（只有两个选项：正确、错误）
      if (options.length === 2) {
        const optionTexts = options.map(opt => {
          const text = opt.text || opt.option_text || opt.content || opt.label || '';
          console.log('选项文本:', text);
          return text;
        });
        
        if (optionTexts.includes('正确') && optionTexts.includes('错误')) {
          console.log('推断为判断题');
          return 'judge';
        }
      }
      
      console.log('推断为选择题');
      return 'choice';
    }
    
    // 检查所有可能的答案字段
    const answer = problem.answer || problem.solution || problem.correct_answer || problem.answer_text || '';
    console.log('检查到的答案:', answer);
    
    if (answer && answer.trim()) {
      console.log('推断为简答题');
      return 'short_answer';
    }
    
    // 检查编程题相关字段
    const testCases = problem.test_cases || problem.test_cases_text || problem.test_input || '';
    const expectedOutput = problem.expected_output || problem.expected_result || problem.expected_answer || '';
    console.log('检查到的测试用例:', testCases);
    console.log('检查到的期望输出:', expectedOutput);
    
    if (testCases && expectedOutput) {
      console.log('推断为编程题');
      return 'programming';
    }
    
    // 如果都无法推断，默认返回编程题
    console.log('无法推断类型，默认返回编程题');
    return 'programming';
  };

  // 根据ID获取学校名称
  const getSchoolName = (schoolId) => {
    if (!schoolId) return '-';
    const school = schools.find(s => {
      const sId = s.id;
      return sId === schoolId || sId === parseInt(schoolId) || parseInt(sId) === schoolId;
    });
    return school ? school.name : schoolId;
  };

  // 根据ID获取专业名称
  const getMajorName = (majorId) => {
    if (!majorId) return '-';
    const major = majors.find(m => {
      const mId = m.id;
      return mId === majorId || mId === parseInt(majorId) || parseInt(mId) === majorId;
    });
    return major ? major.name : majorId;
  };

  // 根据ID获取班级名称
  const getClassName = (classId) => {
    if (!classId) return '-';
    const classItem = classes.find(c => {
      const cId = c.id;
      return cId === classId || cId === parseInt(classId) || parseInt(cId) === classId;
    });
    return classItem ? classItem.name : classId;
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingProblem(null);
    setProblemForm({
      title: '',
      description: '',
      type: 'programming',
      testCases: [],
      difficulty: 'easy',
      time_limit: 1000,
      memory_limit: 128,
      options: [],
      correct_answers: [],
      is_multiple_choice: false,
      answer: ''
    });
    setActiveSubTab('list');
  };

  // 课程相关处理函数（只读功能）
  const handleViewCourseDetail = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setActiveTab('courses');
      setActiveSubTab('detail');
      setEditingCourse(course);
    }
  };

  // 作业相关处理函数
  const handleCreateAssignment = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 如果在课程详情页面创建作业，自动设置课程ID
      const assignmentData = { ...assignmentForm };
      if (activeSubTab === 'create-assignment' && editingCourse) {
        assignmentData.course_id = editingCourse.id;
      }
      
      if (isEditingAssignment && editingAssignment) {
        await updateAssignment(editingAssignment.id, assignmentData);
        setSuccess('作业更新成功！');
      } else {
        await createAssignment(assignmentData);
        setSuccess('作业布置成功！');
      }
      
      // 重置表单
      setAssignmentForm({
        name: '',
        description: '',
        requirements: '',
        due_date: '',
        course_id: '',
        problem_ids: [],
        // 重置补交设置
        allow_overdue_submission: false,
        overdue_deadline: '',
        overdue_score_ratio: 0.8
      });
      
      setIsEditingAssignment(false);
      setEditingAssignment(null);
      
      // 刷新作业列表
      const assignmentsData = await getCourseAssignments();
      setAssignments(assignmentsData.assignments || []);
      
      // 如果在课程详情页面，返回到课程详情；否则返回到课程列表
      if (activeSubTab === 'create-assignment') {
        setActiveSubTab('detail');
      } else {
        setActiveSubTab('list');
      }
      
    } catch (error) {
      setError(error.response?.data?.error || (isEditingAssignment ? '更新作业失败' : '布置作业失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      name: assignment.name,
      description: assignment.description || '',
      requirements: assignment.requirements || '',
      due_date: assignment.due_date || '',
      course_id: assignment.course_id || '',
      problem_ids: assignment.problem_ids || [],
      // 补交作业相关字段
      allow_overdue_submission: assignment.allow_overdue_submission || false,
      overdue_deadline: assignment.overdue_deadline || '',
      overdue_score_ratio: assignment.overdue_score_ratio || 0.8
    });
    setIsEditingAssignment(true);
    
    // 记录编辑作业时的上下文
    if (activeSubTab === 'detail' && editingCourse) {
      setEditingAssignmentContext('course-detail');
    } else {
      setEditingAssignmentContext('course-list');
    }
    
    // 切换到作业创建模式
    setActiveSubTab('create-assignment');
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('确定要删除该作业吗？此操作不可恢复。')) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await deleteAssignment(assignmentId);
      setSuccess('作业已删除');
      
      // 刷新作业列表
      const assignmentsData = await getCourseAssignments();
      setAssignments(assignmentsData.assignments || []);
      
    } catch (error) {
      setError(error.response?.data?.error || '删除作业失败');
    } finally {
      setLoading(false);
    }
  };

  // 学生-课程关联关系处理函数
  const handleAddStudentToCourse = async () => {
    if (!editingCourse) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 查找学生是否已存在
      const existingStudent = users.find(user => 
        user.username === addStudentForm.student_no && user.role === 'student'
      );
      
      if (!existingStudent) {
        setError('学生不存在，请先创建学生账号');
        return;
      }
      
      // 使用API添加学生到课程
      try {
        const payload = { student_id: existingStudent.id };
        if (editingCourse.class_id) {
          payload.class_id = editingCourse.class_id;
        }
        await addStudentToCourse(editingCourse.id, payload);
        setSuccess('学生已成功添加到课程！');
        
        // 重新加载课程学生数据
        const courseStudentsData = await getCourseStudents(editingCourse.id);
        if (courseStudentsData && courseStudentsData.length > 0) {
          const apiRelations = courseStudentsData.map(student => ({
            student_id: student.student_id,
            class_id: student.class_id,
            course_id: editingCourse.id,
            student_name: student.student_name,
            student_no: student.student_no,
            added_at: student.added_at || new Date().toISOString()
          }));
          setStudentClassRelations(apiRelations);
        } else {
          setStudentClassRelations([]);
        }
        
        // 刷新课程列表（因为学生数量发生变化）
        try {
          const coursesData = await getTeacherCourses();
          if (coursesData && coursesData.courses) {
            setCourses(coursesData.courses);
            // 更新当前编辑的课程信息
            const updatedCourse = coursesData.courses.find(c => c.id === editingCourse.id);
            if (updatedCourse) {
              setEditingCourse(updatedCourse);
            }
          }
        } catch (error) {
          console.warn('刷新课程列表失败:', error);
        }
      } catch (apiError) {
        console.error('添加学生到课程失败:', apiError);
        setError(apiError.response?.data?.error || '添加学生失败');
        return;
      }
      
      // 重置表单
      setAddStudentForm({
        student_no: '',
        name: '',
        password: '',
        email: '',
        phone: '',
        school_id: '',
        department_id: '',
        major_id: '',
        class_id: ''
      });
      
      // 返回到课程详情页
      setActiveSubTab('detail');
      
    } catch (error) {
      setError(error.response?.data?.error || '添加学生失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudentFromCourse = async (relationId) => {
    if (!window.confirm('确定要从该课程中移除该学生吗？')) return;
    
    try {
      // 解析relationId获取学生ID和课程ID
      const [studentId] = relationId.split('_');
      
      // 使用API从课程中移除学生
      try {
        await removeStudentFromCourse(editingCourse.id, studentId);
        setSuccess('学生已从课程中移除');
        
        // 重新加载课程学生数据
        const courseStudentsData = await getCourseStudents(editingCourse.id);
        if (courseStudentsData && courseStudentsData.length > 0) {
          const apiRelations = courseStudentsData.map(student => ({
            student_id: student.student_id,
            class_id: student.class_id,
            course_id: editingCourse.id,
            student_name: student.student_name,
            student_no: student.student_no,
            added_at: student.added_at || new Date().toISOString()
          }));
          setStudentClassRelations(apiRelations);
        } else {
          setStudentClassRelations([]);
        }
        
        // 刷新课程列表（因为学生数量发生变化）
        try {
          const coursesData = await getTeacherCourses();
          if (coursesData && coursesData.courses) {
            setCourses(coursesData.courses);
            // 更新当前编辑的课程信息
            const updatedCourse = coursesData.courses.find(c => c.id === editingCourse.id);
            if (updatedCourse) {
              setEditingCourse(updatedCourse);
            }
          }
        } catch (error) {
          console.warn('刷新课程列表失败:', error);
        }
      } catch (apiError) {
        console.error('从课程中移除学生失败:', apiError);
        setError(apiError.response?.data?.error || '移除学生失败');
        return;
      }
    } catch (error) {
      setError('移除学生失败');
    }
  };

  // 学生管理标签页渲染函数
  const renderStudentsTab = () => (
    <div className="tab-content">
      <div className="sub-tabs">
        <button 
          className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('list')}
        >
          学生列表
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('add')}
        >
          添加学生
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('import')}
        >
          批量导入
        </button>
      </div>

      {activeSubTab === 'list' && (
        <div className="section-content">
          <div className="section-header">
            <h2>学生列表</h2>
            <button 
              className="add-btn"
              onClick={() => setActiveSubTab('add')}
            >
              添加学生
            </button>
          </div>
          
          <div className="students-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>邮箱</th>
                  <th>手机号</th>
                  <th>学校</th>
                  <th>专业</th>
                  <th>班级</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>{user.email || '-'}</td>
                    <td>{user.phone || '-'}</td>
                    <td>{getSchoolName(user.school_id)}</td>
                    <td>{getMajorName(user.major_id)}</td>
                    <td>{getClassName(user.class_id)}</td>
                    <td>
                      <button 
                        className="action-btn edit"
                        onClick={() => handleEditStudentClick(user)}
                      >
                        编辑
                      </button>
                      <button 
                        className="action-btn delete"
                        onClick={() => handleDeleteStudent(user.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'add' && (
        <div className="section-content">
          <div className="section-header">
            <h2>➕ 添加学生</h2>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('list')}
            >
              ← 返回学生列表
            </button>
          </div>
          
          <div className={`add-student-form ${scrollAnimations.formVisible ? 'form-visible' : ''}`}>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>学号：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学号"
                  value={addStudentForm.student_no}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, student_no: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>姓名：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学生姓名"
                  value={addStudentForm.name}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>密码：<span className="required-mark">*</span></label>
                <input 
                  type="password" 
                  placeholder="请输入初始密码"
                  value={addStudentForm.password}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>邮箱：</label>
                <input 
                  type="email" 
                  placeholder="请输入邮箱地址"
                  value={addStudentForm.email}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>手机号：</label>
                <input 
                  type="tel" 
                  placeholder="请输入手机号码"
                  value={addStudentForm.phone}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>学校：</label>
                <select 
                  value={addStudentForm.school_id} 
                  onChange={(e) => handleAddStudentSchoolChange(e.target.value)}
                >
                  <option value="">请选择学校（可选）</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>院部：</label>
                <select 
                  value={addStudentForm.department_id} 
                  onChange={(e) => handleAddStudentDepartmentChange(e.target.value)}
                  disabled={!addStudentForm.school_id}
                >
                  <option value="">请选择院部（可选）</option>
                  {getAddStudentSchoolDepartments().map(department => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {/* 调试信息 */}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  当前学校ID: {addStudentForm.school_id} | 
                  可用院部数量: {getAddStudentSchoolDepartments().length} | 
                  总院部数量: {departments.length}
                </div>
              </div>
              
              <div className="form-group">
                <label>专业：</label>
                <select 
                  value={addStudentForm.major_id} 
                  onChange={(e) => handleAddStudentMajorChange(e.target.value)}
                  disabled={!addStudentForm.department_id}
                >
                  <option value="">请选择专业（可选）</option>
                  {getAddStudentDepartmentMajors().map(major => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </select>
                {/* 调试信息 */}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  当前院部ID: {addStudentForm.department_id} | 
                  可用专业数量: {getAddStudentDepartmentMajors().length} | 
                  总专业数量: {majors.length}
                </div>
              </div>
            </div>
            
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label>班级：</label>
                <select 
                  value={addStudentForm.class_id} 
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, class_id: e.target.value }))}
                  disabled={!addStudentForm.major_id}
                >
                  <option value="">请选择班级（可选）</option>
                  {getAddStudentMajorClasses().map(classItem => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
                {/* 调试信息 */}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  当前专业ID: {addStudentForm.major_id} | 
                  可用班级数量: {getAddStudentMajorClasses().length} | 
                  总班级数量: {classes.length}
                </div>
              </div>
            </div>
            
            <div className={`form-actions ${scrollAnimations.bottomFormVisible ? 'bottom-form-visible' : ''}`}>
              <button 
                className="submit-btn"
                onClick={handleAddStudent}
                disabled={loading || !addStudentForm.student_no || !addStudentForm.name || !addStudentForm.password}
              >
                {loading ? '创建中...' : '创建学生账号'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'import' && (
        <div className="section-content">
          <div className="section-header">
            <h2>📥 批量导入学生</h2>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('list')}
            >
              ← 返回学生列表
            </button>
          </div>
          
          <div className="import-form">
            <div className="form-help" style={{ 
              display: 'block', 
              visibility: 'visible', 
              opacity: '1', 
              background: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              borderLeft: '4px solid #667eea',
              marginBottom: '25px'
            }}>
              <h3 style={{ color: '#333', fontSize: '18px', fontWeight: '600', margin: '0 0 15px 0' }}>导入说明</h3>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', margin: '10px 0' }}>请按以下步骤操作：</p>
              <ol style={{ margin: '15px 0', paddingLeft: '20px' }}>
                <li style={{ margin: '8px 0', color: '#495057', lineHeight: '1.5' }}>点击下方"下载Excel模板"按钮，下载标准格式的Excel文件（.xlsx格式）</li>
                <li style={{ margin: '8px 0', color: '#495057', lineHeight: '1.5' }}>在Excel文件中填写学生信息（学号、姓名、密码）</li>
                <li style={{ margin: '8px 0', color: '#495057', lineHeight: '1.5' }}>选择学校、院部、专业、班级信息</li>
                <li style={{ margin: '8px 0', color: '#495057', lineHeight: '1.5' }}>上传填写好的Excel文件</li>
                <li style={{ margin: '8px 0', color: '#495057', lineHeight: '1.5' }}>系统将自动识别并添加学生信息</li>
              </ol>
              <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', margin: '10px 0' }}><strong style={{ color: '#dc3545', fontWeight: '600' }}>注意：</strong>学号、姓名、密码为必填项，学校、院部、专业、班级信息将应用到所有导入的学生</p>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>学校：</label>
                <select 
                  value={selectedSchool} 
                  onChange={(e) => handleSchoolChange(e.target.value)}
                >
                  <option value="">请选择学校（必选）</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>院部：</label>
                <select 
                  value={selectedDepartment} 
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  disabled={!selectedSchool}
                >
                  <option value="">请选择院部（必选）</option>
                  {getCurrentSchoolDepartments().map(department => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>专业：</label>
                <select 
                  value={selectedMajor} 
                  onChange={(e) => handleMajorChange(e.target.value)}
                  disabled={!selectedDepartment}
                >
                  <option value="">请选择专业（必选）</option>
                  {getCurrentDepartmentMajors().map(major => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>班级：</label>
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={!selectedMajor}
                >
                  <option value="">请选择班级（必选）</option>
                  {getCurrentMajorClasses().map(classItem => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <button 
                  className="download-btn"
                  onClick={handleDownloadTemplate}
                  disabled={loading}
                >
                  📥 下载Excel模板
                </button>
                <span className="form-help-text">下载包含学号、姓名、密码三列的标准Excel模板（.xlsx格式）</span>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>上传Excel文件：<span className="required-mark">*</span></label>
                <input 
                  type="file" 
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={loading || !selectedSchool || !selectedDepartment || !selectedMajor || !selectedClass}
                />
                <span className="form-help-text">支持.xlsx和.xls格式，文件大小不超过5MB。建议使用下载的Excel模板填写数据。</span>
              </div>
            </div>
            
            {uploadedFile && (
              <div className="form-row">
                <div className="form-group">
                  <div className="file-info">
                    <span>📎 已选择文件: {uploadedFile.name}</span>
                    <button 
                      className="remove-file-btn"
                      onClick={handleRemoveFile}
                    >
                      ✕ 移除
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleBatchImport}
                disabled={loading || !uploadedFile || !selectedSchool || !selectedDepartment || !selectedMajor || !selectedClass}
              >
                {loading ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 题目管理标签页渲染函数
  const renderProblemsTab = () => (
    <div className="tab-content">
      <div className="sub-tabs">
        <button 
          className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('list')}
        >
          题目列表
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('create')}
        >
          创建题目
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('ai')}
        >
          AI生题
        </button>
      </div>

      {activeSubTab === 'list' && (
        <div className="section-content">
          <div className="section-header">
            <h2>题目列表</h2>
            <button 
              className="add-btn"
              onClick={() => setActiveSubTab('create')}
            >
              创建题目
            </button>
          </div>
          
          <div className="problems-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  <th>类型</th>
                  <th>难度</th>
                  <th>时间限制</th>
                  <th>内存限制</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {problems.map(problem => {
                  // 调试信息：打印每个题目的类型
                  console.log(`=== 题目 ${problem.id} 调试信息 ===`);
                  console.log('题目标题:', problem.title);
                  console.log('原始类型:', problem.type);
                  console.log('完整题目对象:', problem);
                  console.log('所有字段名:', Object.keys(problem));
                  console.log('选项字段:', problem.options);
                  console.log('答案字段:', problem.answer);
                  console.log('测试用例字段:', problem.test_cases);
                  console.log('期望输出字段:', problem.expected_output);
                  
                  const inferredType = inferProblemType(problem);
                  console.log('推断类型:', inferredType);
                  console.log('=== 调试信息结束 ===');
                  
                  return (
                    <tr key={problem.id}>
                      <td>{problem.id}</td>
                      <td>{problem.title}</td>
                      <td>
                        {(() => {
                          const inferredType = inferProblemType(problem);
                          const displayType = inferredType === 'choice' ? '选择题' : 
                                            inferredType === 'judge' ? '判断题' : 
                                            inferredType === 'short_answer' ? '简答题' : '编程题';
                          
                          return (
                            <span className={`type-badge ${inferredType}`}>
                              {displayType}
                            </span>
                          );
                        })()}
                        {/* 调试信息 */}
                        <small style={{display: 'block', color: '#999', fontSize: '10px'}}>
                          原始类型: {problem.type || 'undefined'} | 推断类型: {inferProblemType(problem)}
                        </small>
                      </td>
                      <td>
                        <span className={`difficulty-badge ${problem.difficulty}`}>
                          {problem.difficulty === 'easy' ? '简单' : 
                           problem.difficulty === 'medium' ? '中等' : '困难'}
                        </span>
                      </td>
                      <td>{problem.time_limit || '-'}ms</td>
                      <td>{problem.memory_limit || '-'}MB</td>
                      <td>
                        <button 
                          className="action-btn edit"
                          onClick={() => handleEditProblem(problem)}
                        >
                          编辑
                        </button>
                        <button 
                          className="action-btn delete"
                          onClick={() => handleDeleteProblem(problem.id)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* 分页组件 */}
          <div className="pagination-container">
            <div className="pagination-info">
              <span>显示第 {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, totalProblems)} 题，共 {totalProblems} 题</span>
            </div>
            
            <div className="pagination-controls">
              <div className="per-page-selector">
                <label>每页显示：</label>
                <select 
                  value={perPage} 
                  onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              
              <div className="page-navigation">
                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  « 首页
                </button>
                
                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  ‹ 上一页
                </button>
                
                {/* 页码显示 */}
                <div className="page-numbers">
                  {(() => {
                    const pages = [];
                    const maxVisiblePages = 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                    
                    if (endPage - startPage + 1 < maxVisiblePages) {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1);
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          className={`page-btn ${i === currentPage ? 'active' : ''}`}
                          onClick={() => handlePageChange(i)}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pages;
                  })()}
                </div>
                
                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  下一页 ›
                </button>
                
                <button 
                  className="page-btn"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  末页 »
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'create' && (
        <div className="section-content">
          <div className="section-header">
            <h2>{isEditing ? '✏️ 编辑题目' : '➕ 创建题目'}</h2>
            <button 
              className="secondary-btn"
              onClick={handleCancelEdit}
            >
              ← 返回题目列表
            </button>
          </div>
          
          <div className="problem-form">
            <div className="form-row">
              <div className="form-group">
                <label>题目标题：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入题目标题"
                  value={problemForm.title}
                  onChange={(e) => setProblemForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>题目类型：<span className="required-mark">*</span></label>
                <select 
                  value={problemForm.type}
                  onChange={(e) => handleProblemTypeChange(e.target.value)}
                >
                  <option value="programming">编程题</option>
                  <option value="choice">选择题</option>
                  <option value="judge">判断题</option>
                  <option value="short_answer">简答题</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>难度：<span className="required-mark">*</span></label>
                <select 
                  value={problemForm.difficulty}
                  onChange={(e) => setProblemForm(prev => ({ ...prev, difficulty: e.target.value }))}
                >
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
              
              {problemForm.type === 'choice' && (
                <div className="form-group">
                  <label>选择类型：</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={problemForm.is_multiple_choice}
                        onChange={(e) => setProblemForm(prev => ({ 
                          ...prev, 
                          is_multiple_choice: e.target.checked 
                        }))}
                      />
                      <span>多选题</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>题目描述：<span className="required-mark">*</span></label>
              <textarea
                placeholder="请输入题目描述"
                value={problemForm.description}
                onChange={(e) => setProblemForm(prev => ({ ...prev, description: e.target.value }))}
                rows={6}
              />
            </div>

            {/* 选择题选项管理 */}
            {problemForm.type === 'choice' && (
              <div className="form-group">
                <label>选项：<span className="required-mark">*</span></label>
                <div className="choice-options">
                  {problemForm.options.map((option, index) => (
                    <div key={option.id} className="choice-option">
                      <div className="option-header">
                        <span className="option-label">选项 {String.fromCharCode(65 + index)}</span>
                        <div className="option-controls">
                          <label className="checkbox-label">
                            <input 
                              type="checkbox"
                              checked={option.is_correct}
                              onChange={() => toggleChoiceOptionCorrect(option.id)}
                            />
                            <span>正确答案</span>
                          </label>
                          {problemForm.options.length > 2 && (
                            <button 
                              type="button"
                              className="remove-option-btn"
                              onClick={() => removeChoiceOption(option.id)}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                      <input 
                        type="text" 
                        placeholder={`请输入选项 ${String.fromCharCode(65 + index)} 的内容`}
                        value={option.text}
                        onChange={(e) => updateChoiceOption(option.id, 'text', e.target.value)}
                        className="option-input"
                      />
                    </div>
                  ))}
                  <button 
                    type="button"
                    className="add-option-btn"
                    onClick={addChoiceOption}
                  >
                    + 添加选项
                  </button>
                </div>
                <small>至少需要2个选项，最多支持10个选项</small>
              </div>
            )}

            {/* 判断题选项管理 */}
            {problemForm.type === 'judge' && (
              <div className="form-group">
                <label>选项：<span className="required-mark">*</span></label>
                <div className="choice-options">
                  {problemForm.options.map((option, index) => (
                    <div key={option.id} className="choice-option">
                      <div className="option-header">
                        <span className="option-label">选项 {index + 1}</span>
                        <div className="option-controls">
                          <label className="checkbox-label">
                            <input 
                              type="checkbox"
                              checked={option.is_correct}
                              onChange={() => toggleChoiceOptionCorrect(option.id)}
                            />
                            <span>正确答案</span>
                          </label>
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={option.text}
                        onChange={(e) => updateChoiceOption(option.id, 'text', e.target.value)}
                        className="option-input"
                        readOnly
                      />
                      <small className="option-hint">判断题选项不可编辑</small>
                    </div>
                  ))}
                </div>
                <small>判断题固定为"正确"和"错误"两个选项，请选择其中一个作为正确答案</small>
              </div>
            )}
            
            {/* 简答题答案 */}
            {problemForm.type === 'short_answer' && (
              <div className="form-group">
                <label>答案：<span className="required-mark">*</span></label>
                <textarea
                  placeholder="请输入简答题的标准答案"
                  value={problemForm.answer}
                  onChange={(e) => setProblemForm(prev => ({ ...prev, answer: e.target.value }))}
                  rows={6}
                />
                <small>请提供详细的答案内容，供学生参考和教师评分使用</small>
              </div>
            )}
            
            {/* 编程题相关字段 */}
            {problemForm.type === 'programming' && (
              <>
                <div className="form-group">
                  <label>测试用例管理：<span className="required-mark">*</span></label>
                  <div className="test-cases-manager">
                    <div className="test-cases-header">
                      <span>测试用例</span>
                      <button 
                        type="button" 
                        className="add-test-case-btn"
                        onClick={() => addTestCase()}
                      >
                        ➕ 添加测试用例
                      </button>
                    </div>
                    
                    {problemForm.testCases && problemForm.testCases.length > 0 ? (
                      <div className="test-cases-list">
                        {problemForm.testCases.map((testCase, index) => (
                          <div key={testCase.id} className="test-case-item">
                            <div className="test-case-header">
                              <span className="test-case-number">测试用例 {index + 1}</span>
                              <button 
                                type="button"
                                className="remove-test-case-btn"
                                onClick={() => removeTestCase(testCase.id)}
                              >
                                ❌
                              </button>
                            </div>
                            
                            <div className="test-case-content">
                              <div className="test-case-input">
                                <label>输入：</label>
                                <textarea
                                  placeholder="输入数据（如果没有输入请留空）"
                                  value={testCase.input || ''}
                                  onChange={(e) => updateTestCase(testCase.id, 'input', e.target.value)}
                                  rows={3}
                                />
                                <small>如果没有输入，请留空</small>
                              </div>
                              
                              <div className="test-case-output">
                                <label>期望输出：<span className="required-mark">*</span></label>
                                <textarea
                                  placeholder="期望的输出结果"
                                  value={testCase.output || ''}
                                  onChange={(e) => updateTestCase(testCase.id, 'output', e.target.value)}
                                  rows={3}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-test-cases">
                        <p>还没有添加测试用例，请点击"添加测试用例"按钮添加</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>时间限制：<span className="required-mark">*</span></label>
                    <input 
                      type="number" 
                      placeholder="请输入时间限制（毫秒）"
                      value={problemForm.time_limit}
                      onChange={(e) => setProblemForm(prev => ({ ...prev, time_limit: parseInt(e.target.value) || 1000 }))}
                      min="100"
                      max="10000"
                    />
                    <small>单位：毫秒，范围：100-10000</small>
                  </div>
                  
                  <div className="form-group">
                    <label>内存限制：<span className="required-mark">*</span></label>
                    <input 
                      type="number" 
                      placeholder="请输入内存限制（MB）"
                      value={problemForm.memory_limit}
                      onChange={(e) => setProblemForm(prev => ({ ...prev, memory_limit: parseInt(e.target.value) || 128 }))}
                      min="16"
                      max="512"
                    />
                    <small>单位：MB，范围：16-512</small>
                  </div>
                </div>
              </>
            )}
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleCreateProblem}
                disabled={loading || !problemForm.title || !problemForm.description || 
                  (problemForm.type === 'programming' && (problemForm.testCases.length === 0 || 
                    problemForm.testCases.some(tc => !tc.output.trim()))) ||
                  (problemForm.type === 'choice' && (problemForm.options.length < 2 || 
                    problemForm.options.some(option => !option.text) || 
                    problemForm.correct_answers.length === 0)) ||
                  (problemForm.type === 'judge' && problemForm.correct_answers.length !== 1) ||
                  (problemForm.type === 'short_answer' && !problemForm.answer)}
              >
                {loading ? (isEditing ? '更新中...' : '创建中...') : (isEditing ? '更新题目' : '创建题目')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'ai' && (
        <AIProblemGenerationPage />
      )}
    </div>
  );

  // 课程查看标签页渲染函数（只读功能）
  const renderCoursesTab = () => (
    <div className="tab-content">
      <div className="sub-tabs">
        <button 
          className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => {
            setActiveSubTab('list');
            // 如果当前在课程详情页，清除课程详情状态
            if (activeSubTab === 'detail') {
              setEditingCourse(null);
            }
            // 清除添加学生上下文
            setAddingStudentContext('');
          }}
        >
          课程列表
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'detail' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('detail')}
          style={{ display: (editingCourse && activeSubTab === 'detail') ? 'inline-block' : 'none' }}
        >
          课程详情
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'add-student-to-course' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('add-student-to-course')}
          style={{ display: (editingCourse && activeSubTab === 'detail') ? 'inline-block' : 'none' }}
        >
          添加学生
        </button>
      </div>

      {activeSubTab === 'list' && (
        <div className="section-content">
          <div className="section-header">
            <h2>我的课程</h2>
            <div className="section-info">
              <p>💡 点击任意课程卡片即可查看详情、管理学生和布置作业</p>
            </div>
          </div>
          
          <div className="courses-grid">
            {courses.length === 0 ? (
              <div className="empty-state">
                <p>暂无课程，请联系管理员添加课程</p>
              </div>
            ) : (
              courses.map(course => (
                <div 
                  key={course.id} 
                  className="course-card"
                  onClick={() => handleViewCourseDetail(course.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="course-header">
                    <h3>{course.name}</h3>
                    <span className="course-status active">进行中</span>
                  </div>
                  <div className="course-info">
                    <p><strong>教学班：</strong>{course.display_class_name || course.class_name || (course.teaching_class_name || '未设置')}</p>
                    <p><strong>专业：</strong>{course.major_name}</p>
                    <p><strong>学校：</strong>{course.school_name}</p>
                    <p><strong>学生数量：</strong>{course.student_count || 0}人</p>
                    <p><strong>创建时间：</strong>{formatDate(course.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'detail' && editingCourse && (
        <div className="section-content">
          <div className="section-header">
            <h2>📚 课程详情：{editingCourse.name}</h2>
            <button 
              className="secondary-btn"
              onClick={() => {
                setActiveSubTab('list');
                setEditingCourse(null);
              }}
            >
              ← 返回课程列表
            </button>
          </div>
          
          <div className="course-detail">
            <div className={`course-info-section ${courseDetailAnimations.courseInfoVisible ? 'lotus-visible' : ''}`}>
              <h3>课程基本信息</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>课程名称：</label>
                  <span>{editingCourse.name}</span>
                </div>
                <div className="info-item">
                  <label>课程描述：</label>
                  <span>{editingCourse.description}</span>
                </div>
                <div className="info-item">
                  <label>教学班：</label>
                  <span>{editingCourse.display_class_name || editingCourse.class_name || (editingCourse.teaching_class_name || '未设置')}</span>
                </div>
                <div className="info-item">
                  <label>专业：</label>
                  <span>{editingCourse.major_name}</span>
                </div>
                <div className="info-item">
                  <label>学校：</label>
                  <span>{editingCourse.school_name}</span>
                </div>
                <div className="info-item">
                  <label>学生数量：</label>
                  <span>{editingCourse.student_count || 0}人</span>
                </div>
                <div className="info-item">
                  <label>创建时间：</label>
                  <span>{formatDate(editingCourse.created_at)}</span>
                </div>
              </div>
            </div>

            <div className={`course-students-section ${courseDetailAnimations.studentsSectionVisible ? 'lotus-visible' : ''}`}>
              <div className="section-header">
                <h3>教学班学生</h3>
                <button 
                  className="add-btn"
                  onClick={() => {
                    // 设置添加学生上下文为课程详情页
                    setAddingStudentContext('course-detail');
                    setActiveSubTab('add-student-to-course');
                  }}
                >
                  添加学生
                </button>
              </div>
              <div className="students-table">
                <table>
                  <thead>
                    <tr>
                      <th>学号</th>
                      <th>姓名</th>
                      <th>邮箱</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // 获取当前课程的所有学生
                      const courseStudents = [];
                      
                      // 1. 添加原本属于该教学班的学生
                      const originalStudents = users.filter(user => 
                        user.class_id === editingCourse.class_id && user.role === 'student'
                      );
                      courseStudents.push(...originalStudents);
                      
                      // 2. 添加通过关联关系添加的学生
                      const relatedStudents = studentClassRelations
                        .filter(relation => relation.course_id === editingCourse.id)
                        .map(relation => {
                          // 查找学生的完整信息
                          const studentInfo = users.find(user => user.id === relation.student_id);
                          return {
                            ...studentInfo,
                            // 使用关联关系中的信息作为后备
                            name: studentInfo ? studentInfo.name : relation.student_name,
                            username: studentInfo ? studentInfo.username : relation.student_no,
                            // 标记这是通过关联关系添加的学生
                            isRelatedStudent: true,
                            relationId: `${relation.student_id}_${relation.course_id}`
                          };
                        });
                      courseStudents.push(...relatedStudents);
                      
                      if (courseStudents.length === 0) {
                        return (
                          <tr>
                            <td colSpan="5">
                              <div className="empty-state">
                                <p>该教学班暂无学生</p>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      
                      return courseStudents.map(student => (
                        <tr key={student.id || student.relationId}>
                          <td>{student.username}</td>
                          <td>{student.name}</td>
                          <td>{student.email || '-'}</td>
                          <td>
                            <span className={`status-badge ${student.isRelatedStudent ? 'related' : 'original'}`}>
                              {student.isRelatedStudent ? '已添加' : '原班级'}
                            </span>
                          </td>
                          <td>
                            {student.isRelatedStudent ? (
                              <button 
                                className="action-btn delete"
                                onClick={() => handleRemoveStudentFromCourse(student.relationId)}
                              >
                                移除
                              </button>
                            ) : (
                              <button 
                                className="action-btn delete"
                                onClick={async () => {
                                  if (!window.confirm('确定要将该原班级学生从本课程中退课吗？此操作不会删除其账号。')) return;
                                  try {
                                    await excludeOriginalStudent(editingCourse.id, student.id);
                                    setSuccess('该学生已从本课程退课');
                                    // 刷新课程学生数据
                                    await fetchStudentClassRelations(editingCourse.id);
                                  } catch (apiError) {
                                    console.error('退课失败:', apiError);
                                    setError(apiError.response?.data?.error || '退课失败');
                                  }
                                }}
                              >
                                退课
                              </button>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`course-assignments-section ${courseDetailAnimations.assignmentsSectionVisible ? 'lotus-visible' : ''}`}>
              <div className="section-header">
                <h3>已布置作业</h3>
                <button 
                  className="add-btn"
                  onClick={() => {
                    // 自动设置当前课程ID到作业表单
                    setAssignmentForm(prev => ({
                      ...prev,
                      course_id: editingCourse.id
                    }));
                    // 设置编辑作业上下文为课程详情页
                    setEditingAssignmentContext('course-detail');
                    setActiveSubTab('create-assignment');
                  }}
                >
                  布置作业
                </button>
              </div>
              <div className="assignments-table">
                <table>
                  <thead>
                    <tr>
                      <th>作业名称</th>
                      <th>描述</th>
                      <th>截止时间</th>
                      <th>状态</th>
                      <th>补交设置</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.filter(assignment => assignment.course_id === editingCourse.id).map(assignment => (
                      <tr key={assignment.id}>
                        <td>{assignment.name}</td>
                        <td>{assignment.description}</td>
                        <td>{formatDate(assignment.due_date)}</td>
                        <td>
                          <span className={`status-badge ${assignment.is_active ? 'active' : 'inactive'}`}>
                            {assignment.is_active ? '进行中' : '已结束'}
                          </span>
                        </td>
                        <td>
                          {assignment.allow_overdue_submission ? (
                            <div className="overdue-status">
                              <span className="overdue-badge enabled">允许补交</span>
                              {assignment.overdue_deadline && (
                                <div className="overdue-detail">
                                  <small>补交截止: {formatDate(assignment.overdue_deadline)}</small>
                                  <small>得分比例: {Math.round((assignment.overdue_score_ratio || 0.8) * 100)}%</small>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="overdue-badge disabled">不允许补交</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="action-btn edit"
                            onClick={() => handleEditAssignment(assignment)}
                          >
                            编辑
                          </button>
                          <button 
                            className="action-btn delete"
                            onClick={() => handleDeleteAssignment(assignment.id)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assignments.filter(assignment => assignment.course_id === editingCourse.id).length === 0 && (
                  <div className="empty-state">
                    <p>该课程暂无作业</p>
                  </div>
                )}
              </div>
            </div>

            {/* 作业创建表单 */}
            {activeSubTab === 'create-assignment' && (
              <div className="course-assignment-form">
                <div className="section-header">
                  <h3>📝 布置作业（{editingCourse.name}）</h3>
                  <button 
                    className="secondary-btn"
                    onClick={() => setActiveSubTab('detail')}
                  >
                    ← 返回课程详情
                  </button>
                </div>
                
                <div className="assignment-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>作业名称：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入作业名称"
                        value={assignmentForm.name}
                        onChange={(e) => setAssignmentForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>课程：</label>
                      <input 
                        type="text" 
                        value={editingCourse.name}
                        disabled
                        className="disabled-input"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>作业描述：<span className="required-mark">*</span></label>
                    <textarea
                      placeholder="请输入作业描述"
                      value={assignmentForm.description}
                      onChange={(e) => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>作业要求：<span className="required-mark">*</span></label>
                    <textarea
                      placeholder="请输入作业要求"
                      value={assignmentForm.requirements}
                      onChange={(e) => setAssignmentForm(prev => ({ ...prev, requirements: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>截止时间：<span className="required-mark">*</span></label>
                      <input 
                        type="datetime-local" 
                        value={assignmentForm.due_date}
                        onChange={(e) => setAssignmentForm(prev => ({ ...prev, due_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>选择题目：</label>
                    
                    {/* 智能选题功能 */}
                    <div className="ai-selection-section">
                      <div className="ai-selection-header">
                        <h4>🤖 AI智能选题</h4>
                        <p className="ai-selection-desc">输入选题需求，AI将自动从题目库中选择最合适的题目</p>
                      </div>
                      
                      <div className="ai-selection-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>选题需求描述：</label>
                            <textarea
                              placeholder="例如：需要3道关于数组和循环的题目，难度从简单到困难，适合大一学生"
                              value={aiSelectionForm.requirements}
                              onChange={(e) => setAiSelectionForm(prev => ({ ...prev, requirements: e.target.value }))}
                              rows={3}
                            />
                          </div>
                          
                          <div className="form-group">
                            <label>题目数量：</label>
                            <select
                              value={aiSelectionForm.problem_count}
                              onChange={(e) => setAiSelectionForm(prev => ({ ...prev, problem_count: parseInt(e.target.value) }))}
                            >
                              <option value={1}>1题</option>
                              <option value={2}>2题</option>
                              <option value={3}>3题</option>
                              <option value={4}>4题</option>
                              <option value={5}>5题</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="ai-selection-actions">
                          <button 
                            className="ai-select-btn"
                            onClick={handleAiSelectProblems}
                            disabled={isAiSelecting || !aiSelectionForm.requirements.trim()}
                          >
                            {isAiSelecting ? 'AI选题中...' : '🤖 开始AI选题'}
                          </button>
                          
                          {aiSelectedProblems.length > 0 && (
                            <>
                              <button 
                                className="preview-btn"
                                onClick={handlePreviewAiSelection}
                              >
                                👁️ 预览结果
                              </button>
                              
                              <button 
                                className="apply-btn"
                                onClick={handleApplyAiSelection}
                              >
                                ✅ 应用选题
                              </button>
                              
                              <button 
                                className="clear-btn"
                                onClick={handleClearAiSelection}
                              >
                                🗑️ 清空结果
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* AI选题结果展示 */}
                      {aiSelectionResult && aiSelectedProblems.length > 0 && (
                        <div className="ai-selection-result">
                          <h5>🎯 AI选题结果</h5>
                          <div className="ai-selected-problems">
                            {aiSelectedProblems.map((selected, index) => {
                              const problem = problems.find(p => p.id === selected.problem_id);
                              return problem ? (
                                <div key={selected.problem_id} className="ai-selected-problem">
                                  <div className="problem-info">
                                    <span className="problem-number">{index + 1}</span>
                                    <span className="problem-title">{problem.title}</span>
                                    <span className={`difficulty-badge ${problem.difficulty}`}>
                                      {problem.difficulty === 'easy' ? '简单' : 
                                       problem.difficulty === 'medium' ? '中等' : '困难'}
                                    </span>
                                  </div>
                                  <div className="ai-reason">
                                    <strong>选择理由：</strong>{selected.reason}
                                  </div>
                                  <div className="ai-details">
                                    <span>难度：{selected.difficulty_level}</span>
                                    <span>概念：{selected.concept_coverage}</span>
                                  </div>
                                </div>
                              ) : null;
                            })}
                          </div>
                          
                          {aiSelectionResult.selection_summary && (
                            <div className="ai-summary">
                              <strong>AI选题总结：</strong>
                              {aiSelectionResult.selection_summary}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="problem-selection">
                      {(allProblems.length > 0 ? allProblems : problems).map(problem => (
                        <label key={problem.id} className="problem-checkbox">
                          <input 
                            type="checkbox" 
                            value={problem.id}
                            checked={assignmentForm.problem_ids.includes(problem.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignmentForm(prev => ({ 
                                  ...prev, 
                                  problem_ids: [...prev.problem_ids, problem.id] 
                                }));
                              } else {
                                setAssignmentForm(prev => ({ 
                                  ...prev, 
                                  problem_ids: prev.problem_ids.filter(id => id !== problem.id) 
                                }));
                              }
                            }}
                          />
                          <span className="problem-title">{problem.title}</span>
                          <span className={`difficulty-badge ${problem.difficulty}`}>
                            {problem.difficulty === 'easy' ? '简单' : 
                             problem.difficulty === 'medium' ? '中等' : '困难'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      className="submit-btn"
                      onClick={handleCreateAssignment}
                      disabled={loading || !assignmentForm.name || !assignmentForm.description || !assignmentForm.requirements || !assignmentForm.due_date || !assignmentForm.course_id}
                    >
                      {loading ? '创建中...' : '布置作业'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 添加学生到课程的表单 */}
            {activeSubTab === 'add-student-to-course' && editingCourse && (
              <div className="section-content">
                <div className="section-header">
                  <h3>👥 添加学生到课程：{editingCourse.name}</h3>
                  <button 
                    className="secondary-btn"
                    onClick={() => setActiveSubTab('detail')}
                  >
                    ← 返回课程详情
                  </button>
                </div>
                
                <div className="add-student-to-course-form">
                  <div className="form-help">
                    <p>请选择要添加到该课程的学生：</p>
                    <p>注意：只能添加已存在的学生账号</p>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>学号：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入学号"
                        value={addStudentForm.student_no}
                        onChange={(e) => setAddStudentForm(prev => ({ ...prev, student_no: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>姓名：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入学生姓名"
                        value={addStudentForm.name}
                        onChange={(e) => setAddStudentForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      className="submit-btn"
                      onClick={handleAddStudentToCourse}
                      disabled={loading || !addStudentForm.student_no || !addStudentForm.name}
                    >
                      {loading ? '添加中...' : '添加学生到课程'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // 学生相关处理函数
  const handleAddStudent = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await registerStudent(addStudentForm);
      setSuccess('学生账号创建成功！');
      
      // 重置表单
      setAddStudentForm({
        student_no: '',
        name: '',
        password: '',
        email: '',
        phone: '',
        school_id: '',
        department_id: '',
        major_id: '',
        class_id: ''
      });
      
      // 刷新用户列表
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
      
      // 刷新课程列表（因为学生数量可能发生变化）
      try {
        const coursesData = await getTeacherCourses();
        if (coursesData && coursesData.courses) {
          setCourses(coursesData.courses);
        }
      } catch (error) {
        console.warn('刷新课程列表失败:', error);
      }
      
      // 切换到学生列表
      setActiveSubTab('list');
      
    } catch (error) {
      setError(error.response?.data?.error || '创建学生账号失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudentClick = (user) => {
    setEditingUser(user);
    setEditForm({
      email: user.email || '',
      phone: user.phone || '',
      school_id: user.school_id || '',
      major_id: user.major_id || '',
      class_id: user.class_id || '',
      new_password: ''
    });
    setError('');
    setSuccess('');
  };

  const handleSaveStudent = async () => {
    if (!editingUser) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await updateUser(editingUser.id, editForm);
      setSuccess('学生信息已更新');
      // 刷新列表
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
      
      // 刷新课程列表（因为学生数量可能发生变化）
      try {
        const coursesData = await getTeacherCourses();
        if (coursesData && coursesData.courses) {
          setCourses(coursesData.courses);
        }
      } catch (error) {
        console.warn('刷新课程列表失败:', error);
      }
      
      setEditingUser(null);
    } catch (error) {
      setError(error.response?.data?.error || '更新学生信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditStudent = () => {
    setEditingUser(null);
    setEditForm({ email: '', phone: '', school_id: '', major_id: '', class_id: '', new_password: '' });
  };

  const handleDeleteStudent = async (userId) => {
    if (!window.confirm('确定要删除该学生吗？此操作不可恢复。')) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await deleteUser(userId);
      setSuccess('学生已删除');
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
      
      // 刷新课程列表（因为学生数量可能发生变化）
      try {
        const coursesData = await getTeacherCourses();
        if (coursesData && coursesData.courses) {
          setCourses(coursesData.courses);
        }
      } catch (error) {
        console.warn('刷新课程列表失败:', error);
      }
      
    } catch (error) {
      setError(error.response?.data?.error || '删除学生失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudentSchoolChange = async (schoolId) => {
    setAddStudentForm(prev => ({ 
      ...prev, 
      school_id: schoolId, 
      department_id: '', 
      major_id: '', 
      class_id: '' 
    }));
    
    // 不再重置全局的departments、majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleAddStudentDepartmentChange = async (departmentId) => {
    setAddStudentForm(prev => ({ 
      ...prev, 
      department_id: departmentId, 
      major_id: '', 
      class_id: '' 
    }));
    
    // 不再重置全局的majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleAddStudentMajorChange = async (majorId) => {
    setAddStudentForm(prev => ({ 
      ...prev, 
      major_id: majorId, 
      class_id: '' 
    }));
    
    // 不再重置全局的classes数组
    // 这个数组应该保持完整，用于学生列表显示
  };

  // 选择题选项管理函数
  const addChoiceOption = () => {
    setProblemForm(prev => {
      // 计算下一个可用的字母ID
      const existingIds = prev.options.map(option => option.id);
      let nextId = 'A';
      for (let i = 0; i < 26; i++) {
        const candidateId = String.fromCharCode(65 + i); // A, B, C, D...
        if (!existingIds.includes(candidateId)) {
          nextId = candidateId;
          break;
        }
      }
      
      return {
        ...prev,
        options: [...prev.options, { id: nextId, text: '', is_correct: false }]
      };
    });
  };

  const removeChoiceOption = (optionId) => {
    setProblemForm(prev => ({
      ...prev,
      options: prev.options.filter(option => option.id !== optionId)
    }));
  };

  const updateChoiceOption = (optionId, field, value) => {
    setProblemForm(prev => ({
      ...prev,
      options: prev.options.map(option => 
        option.id === optionId ? { ...option, [field]: value } : option
      )
    }));
  };

  const toggleChoiceOptionCorrect = (optionId) => {
    setProblemForm(prev => {
      let updatedOptions;
      
      if (prev.type === 'judge') {
        // 判断题：单选模式，点击一个选项时取消其他选项
        updatedOptions = prev.options.map(option => ({
          ...option,
          is_correct: option.id === optionId ? !option.is_correct : false
        }));
      } else {
        // 选择题：多选模式，可以同时选择多个选项
        updatedOptions = prev.options.map(option => 
          option.id === optionId ? { ...option, is_correct: !option.is_correct } : option
        );
      }
      
      // 更新正确答案数组 - 统一使用选项ID
      const correctAnswers = updatedOptions
        .filter(option => option.is_correct)
        .map(option => option.id);
      
      return {
        ...prev,
        options: updatedOptions,
        correct_answers: correctAnswers
      };
    });
  };

  const handleProblemTypeChange = (type) => {
    setProblemForm(prev => {
      if (type === 'choice') {
        // 切换到选择题时，初始化至少两个选项
        return {
          ...prev,
          type,
          options: [
            { id: 'A', text: '', is_correct: false },
            { id: 'B', text: '', is_correct: false }
          ],
          correct_answers: [],
          is_multiple_choice: false
        };
      } else if (type === 'judge') {
        // 切换到判断题时，初始化两个固定选项
        return {
          ...prev,
          type,
          options: [
            { id: 'A', text: '正确', is_correct: false },
            { id: 'B', text: '错误', is_correct: false }
          ],
          correct_answers: [],
          is_multiple_choice: false
        };
      } else if (type === 'short_answer') {
        // 切换到简答题时，清空选项相关字段，添加答案字段
        return {
          ...prev,
          type,
          options: [],
          correct_answers: [],
          is_multiple_choice: false,
          answer: '' // 简答题答案
        };
      } else {
        // 切换到其他题型时，清空选择题相关字段
        return {
          ...prev,
          type,
          options: [],
          correct_answers: [],
          is_multiple_choice: false
        };
      }
    });
  };



  // 获取当前选中专业对应的班级列表（用于选择器显示）
  const getCurrentMajorClasses = () => {
    if (!selectedMajor) return [];
    
    const majorId = selectedMajor;
    const filteredClasses = classes.filter(classItem => {
      const classMajorId = classItem.major_id;
      const isMatch = classMajorId === majorId || classMajorId === parseInt(majorId) || parseInt(classMajorId) === majorId;
      return isMatch;
    });
    
    return filteredClasses;
  };



  // 获取添加学生表单中选中学校对应的院部列表
  const getAddStudentSchoolDepartments = () => {
    if (!addStudentForm.school_id) return [];
    
    const schoolId = addStudentForm.school_id;
    const filteredDepartments = departments.filter(department => {
      const deptSchoolId = department.school_id;
      const isMatch = deptSchoolId === schoolId || deptSchoolId === parseInt(schoolId) || parseInt(deptSchoolId) === schoolId;
      return isMatch;
    });
    
    return filteredDepartments;
  };

  // 获取添加学生表单中选中院部对应的专业列表
  const getAddStudentDepartmentMajors = () => {
    if (!addStudentForm.department_id) return [];
    
    const departmentId = addStudentForm.department_id;
    const filteredMajors = majors.filter(major => {
      const majorDeptId = major.department_id;
      const isMatch = majorDeptId === departmentId || majorDeptId === parseInt(departmentId) || parseInt(majorDeptId) === departmentId;
      return isMatch;
    });
    
    return filteredMajors;
  };

  // 获取添加学生表单中选中专业对应的班级列表
  const getAddStudentMajorClasses = () => {
    if (!addStudentForm.major_id) return [];
    
    const majorId = addStudentForm.major_id;
    const filteredClasses = classes.filter(classItem => {
      const classMajorId = classItem.major_id;
      const isMatch = classMajorId === majorId || classMajorId === parseInt(majorId) || parseInt(classMajorId) === majorId;
      return isMatch;
    });
    
    return filteredClasses;
  };

  // 获取编辑学生表单中选中学校对应的专业列表
  const getEditStudentSchoolMajors = () => {
    if (!editForm.school_id) return [];
    
    const schoolId = editForm.school_id;
    const filteredMajors = majors.filter(major => {
      const majorSchoolId = major.school_id;
      const isMatch = majorSchoolId === schoolId || majorSchoolId === parseInt(schoolId) || parseInt(majorSchoolId) === schoolId;
      return isMatch;
    });
    
    return filteredMajors;
  };

  // 获取编辑学生表单中选中专业对应的班级列表
  const getEditStudentMajorClasses = () => {
    if (!editForm.major_id) return [];
    
    const majorId = editForm.major_id;
    const filteredClasses = classes.filter(classItem => {
      const classMajorId = classItem.major_id;
      const isMatch = classMajorId === majorId || classMajorId === parseInt(majorId) || parseInt(classMajorId) === majorId;
      return isMatch;
    });
    
    return filteredClasses;
  };

  // 获取当前选中学校对应的院部列表
  const getCurrentSchoolDepartments = () => {
    if (!selectedSchool) return [];
    
    const schoolId = selectedSchool;
    const filteredDepartments = departments.filter(department => {
      const deptSchoolId = department.school_id;
      const isMatch = deptSchoolId === schoolId || deptSchoolId === parseInt(schoolId) || parseInt(deptSchoolId) === schoolId;
      return isMatch;
    });
    
    return filteredDepartments;
  };

  // 获取当前选中院部对应的专业列表
  const getCurrentDepartmentMajors = () => {
    if (!selectedDepartment) return [];
    
    const departmentId = selectedDepartment;
    const filteredMajors = majors.filter(major => {
      const majorDeptId = major.department_id;
      const isMatch = majorDeptId === departmentId || majorDeptId === parseInt(departmentId) || parseInt(majorDeptId) === departmentId;
      return isMatch;
    });
    
    return filteredMajors;
  };

  // 智能选题处理函数
  const handleAiSelectProblems = async () => {
    if (!aiSelectionForm.requirements.trim()) {
      setError('请输入选题需求描述');
      return;
    }

    if (!editingCourse) {
      setError('请先选择课程');
      return;
    }

    try {
      setIsAiSelecting(true);
      setError('');
      
      const result = await aiSelectProblems({
        requirements: aiSelectionForm.requirements,
        course_id: editingCourse.id,
        problem_count: aiSelectionForm.problem_count
      });

      setAiSelectedProblems(result.selected_problems || []);
      setAiSelectionResult(result);
      setSuccess('AI智能选题成功！');
      
      // 自动将AI选择的题目添加到作业表单中
      const selectedProblemIds = result.selected_problems.map(p => p.problem_id);
      setAssignmentForm(prev => ({
        ...prev,
        problem_ids: [...new Set([...prev.problem_ids, ...selectedProblemIds])]
      }));

    } catch (error) {
      setError(error.message || 'AI选题失败，请重试');
      console.error('AI选题失败:', error);
    } finally {
      setIsAiSelecting(false);
    }
  };

  const handlePreviewAiSelection = async () => {
    if (aiSelectedProblems.length === 0) {
      setError('没有AI选择的题目可预览');
      return;
    }

    try {
      const result = await previewAiSelectedProblems({
        selected_problem_ids: aiSelectedProblems.map(p => p.problem_id)
      });
      
      // 可以在这里显示预览结果
      console.log('AI选题预览结果:', result);
      
    } catch (error) {
      setError(error.message || '预览失败');
      console.error('预览失败:', error);
    }
  };

  const handleApplyAiSelection = () => {
    if (aiSelectedProblems.length === 0) {
      setError('没有AI选择的题目可应用');
      return;
    }

    // 将AI选择的题目应用到作业表单
    const selectedProblemIds = aiSelectedProblems.map(p => p.problem_id);
    setAssignmentForm(prev => ({
      ...prev,
      problem_ids: [...new Set([...prev.problem_ids, ...selectedProblemIds])]
    }));

    setSuccess(`已应用AI选择的${aiSelectedProblems.length}道题目`);
  };

  const handleClearAiSelection = () => {
    setAiSelectedProblems([]);
    setAiSelectionResult(null);
    setAiSelectionForm({
      requirements: '',
      problem_count: 3
    });
  };

  // 作业创建处理函数





  return (
    <div className="teacher-dashboard">
      <div className="dashboard-header">
        <h1>教师管理控制台</h1>
      </div>
      
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('students');
            setActiveSubTab('list');
          }}
        >
          学生管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'problems' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('problems');
            setActiveSubTab('list');
          }}
        >
          题目管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('courses');
            setActiveSubTab('list');
            // 清除课程详情状态
            setEditingCourse(null);
            setEditingAssignmentContext('');
            setAddingStudentContext('');
          }}
        >
          我的课程
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {activeTab === 'students' && renderStudentsTab()}
      {activeTab === 'problems' && renderProblemsTab()}
      {activeTab === 'courses' && renderCoursesTab()}
      
      {/* 独立的布置作业表单面板 */}
      {activeTab === 'courses' && activeSubTab === 'create-assignment' && editingCourse && (
        <div className="tab-content">
          <div className="section-header">
            <h3>📝 布置作业（{editingCourse.name}）</h3>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('detail')}
            >
              ← 返回课程详情
            </button>
          </div>
          
          <div className="assignment-form">
            <div className="form-row">
              <div className="form-group">
                <label>作业名称：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入作业名称"
                  value={assignmentForm.name}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>课程：</label>
                <input 
                  type="text" 
                  value={editingCourse.name}
                  disabled
                  className="disabled-input"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>作业描述：<span className="required-mark">*</span></label>
              <textarea
                placeholder="请输入作业描述"
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
            
            <div className="form-group">
              <label>作业要求：<span className="required-mark">*</span></label>
              <textarea
                placeholder="请输入作业要求"
                value={assignmentForm.requirements}
                onChange={(e) => setAssignmentForm(prev => ({ ...prev, requirements: e.target.value }))}
                rows={4}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>截止时间：<span className="required-mark">*</span></label>
                <input 
                  type="datetime-local" 
                  value={assignmentForm.due_date}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
            
            {/* 补交作业设置 */}
            <div className="overdue-settings-section">
              <h4>📝 补交作业设置</h4>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={assignmentForm.allow_overdue_submission}
                    onChange={(e) => setAssignmentForm(prev => ({ 
                      ...prev, 
                      allow_overdue_submission: e.target.checked 
                    }))}
                  />
                  <span>允许补交作业</span>
                </label>
                <div className="form-help">
                  勾选此项后，学生可以在截止时间后补交作业（需要教师特别授权）
                </div>
              </div>
              
              {assignmentForm.allow_overdue_submission && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>补交截止时间：</label>
                      <input 
                        type="datetime-local" 
                        value={assignmentForm.overdue_deadline}
                        onChange={(e) => setAssignmentForm(prev => ({ 
                          ...prev, 
                          overdue_deadline: e.target.value 
                        }))}
                        min={assignmentForm.due_date}
                      />
                      <div className="form-help">
                        设置补交的最终截止时间，必须晚于正常截止时间
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label>逾期得分比例：</label>
                      <div className="score-ratio-control">
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.1"
                          value={assignmentForm.overdue_score_ratio}
                          onChange={(e) => setAssignmentForm(prev => ({ 
                            ...prev, 
                            overdue_score_ratio: parseFloat(e.target.value) 
                          }))}
                        />
                        <span className="score-ratio-display">
                          {Math.round(assignmentForm.overdue_score_ratio * 100)}%
                        </span>
                      </div>
                      <div className="form-help">
                        逾期提交的作业将按此比例得分（0% = 不得分，100% = 正常得分）
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>补交说明：</label>
                    <div className="overdue-info-box">
                      <p>💡 <strong>补交机制说明：</strong></p>
                      <ul>
                        <li>只有被教师添加到白名单的学生可以补交</li>
                        <li>补交截止时间后，系统将拒绝所有补交请求</li>
                        <li>逾期提交的作业会标记为"逾期提交"</li>
                        <li>补交作业的得分将按设定比例计算</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* 白名单管理（仅在编辑模式下显示） */}
            {isEditingAssignment && editingAssignment && assignmentForm.allow_overdue_submission && (
              <div className="whitelist-section">
                <AssignmentWhitelistManager 
                  assignment={editingAssignment}
                  onUpdate={() => {
                    // 刷新作业数据
                    if (editingCourse) {
                      getCourseAssignments().then(data => {
                        setAssignments(data.assignments || []);
                      });
                    }
                  }}
                />
              </div>
            )}
            
            <div className="form-group">
              <label>选择题目：</label>
              
              {/* 智能选题功能 */}
              <div className="ai-selection-section">
                <div className="ai-selection-header">
                  <h4>🤖 AI智能选题</h4>
                  <p className="ai-selection-desc">输入选题需求，AI将自动从题目库中选择最合适的题目</p>
                </div>
                
                <div className="ai-selection-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>选题需求描述：</label>
                      <textarea
                        placeholder="例如：需要3道关于数组和循环的题目，难度从简单到困难，适合大一学生"
                        value={aiSelectionForm.requirements}
                        onChange={(e) => setAiSelectionForm(prev => ({ ...prev, requirements: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>题目数量：</label>
                      <select
                        value={aiSelectionForm.problem_count}
                        onChange={(e) => setAiSelectionForm(prev => ({ ...prev, problem_count: parseInt(e.target.value) }))}
                      >
                        <option value={1}>1题</option>
                        <option value={2}>2题</option>
                        <option value={3}>3题</option>
                        <option value={4}>4题</option>
                        <option value={5}>5题</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="ai-selection-actions">
                    <button 
                      className="ai-select-btn"
                      onClick={handleAiSelectProblems}
                      disabled={isAiSelecting || !aiSelectionForm.requirements.trim()}
                    >
                      {isAiSelecting ? 'AI选题中...' : '🤖 开始AI选题'}
                    </button>
                    
                    {aiSelectedProblems.length > 0 && (
                      <>
                        <button 
                          className="preview-btn"
                          onClick={handlePreviewAiSelection}
                        >
                          👁️ 预览结果
                        </button>
                        
                        <button 
                          className="apply-btn"
                          onClick={handleApplyAiSelection}
                        >
                          ✅ 应用选题
                        </button>
                        
                        <button 
                          className="clear-btn"
                          onClick={handleClearAiSelection}
                        >
                          🗑️ 清空结果
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* AI选题结果展示 */}
                {aiSelectionResult && aiSelectedProblems.length > 0 && (
                  <div className="ai-selection-result">
                    <h5>🎯 AI选题结果</h5>
                    <div className="ai-selected-problems">
                      {aiSelectedProblems.map((selected, index) => {
                        const sourceList = allProblems.length > 0 ? allProblems : problems;
                        const problem = sourceList.find(p => p.id === selected.problem_id);
                        return problem ? (
                          <div key={selected.problem_id} className="ai-selected-problem">
                            <div className="problem-info">
                              <span className="problem-number">{index + 1}</span>
                              <span className="problem-title">{problem.title}</span>
                              <span className={`difficulty-badge ${problem.difficulty}`}>
                                {problem.difficulty === 'easy' ? '简单' : 
                                 problem.difficulty === 'medium' ? '中等' : '困难'}
                              </span>
                            </div>
                            <div className="ai-reason">
                              <strong>选择理由：</strong>{selected.reason}
                            </div>
                            <div className="ai-details">
                              <span>难度：{selected.difficulty_level}</span>
                              <span>概念：{selected.concept_coverage}</span>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                    
                    {aiSelectionResult.selection_summary && (
                      <div className="ai-summary">
                        <strong>AI选题总结：</strong>
                        {aiSelectionResult.selection_summary}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="problem-selection">
                {(allProblems.length > 0 ? allProblems : problems).map(problem => (
                  <label key={problem.id} className="problem-checkbox">
                    <input 
                      type="checkbox" 
                      value={problem.id}
                      checked={assignmentForm.problem_ids.includes(problem.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignmentForm(prev => ({ 
                            ...prev, 
                            problem_ids: [...prev.problem_ids, problem.id] 
                          }));
                        } else {
                          setAssignmentForm(prev => ({ 
                            ...prev, 
                            problem_ids: prev.problem_ids.filter(id => id !== problem.id) 
                          }));
                        }
                      }}
                    />
                    <span className="problem-title">{problem.title}</span>
                    <span className={`difficulty-badge ${problem.difficulty}`}>
                      {problem.difficulty === 'easy' ? '简单' : 
                       problem.difficulty === 'medium' ? '中等' : '困难'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleCreateAssignment}
                disabled={loading || !assignmentForm.name || !assignmentForm.description || !assignmentForm.requirements || !assignmentForm.due_date || !assignmentForm.course_id}
              >
                {loading ? '创建中...' : '布置作业'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 独立的添加学生到课程表单面板 */}
      {activeTab === 'courses' && activeSubTab === 'add-student-to-course' && editingCourse && (
        <div className="tab-content">
          <div className="section-header">
            <h3>👥 添加学生到课程：{editingCourse.name}</h3>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('detail')}
            >
              ← 返回课程详情
            </button>
          </div>
          
          <div className="add-student-to-course-form">
            <div className="form-help">
              <p>请选择要添加到该课程的学生：</p>
              <p>注意：只能添加已存在的学生账号</p>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>学号：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学号"
                  value={addStudentForm.student_no}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, student_no: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>姓名：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学生姓名"
                  value={addStudentForm.name}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleAddStudentToCourse}
                disabled={loading || !addStudentForm.student_no || !addStudentForm.name}
              >
                {loading ? '添加中...' : '添加学生到课程'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 编辑学生表单 - 全局显示 */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>编辑学生：{editingUser.name}（学号{editingUser.username}）</h3>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>邮箱：</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>手机号：</label>
                  <input type="tel" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>学校：</label>
                  <select value={editForm.school_id} onChange={(e) => {
                    const val = e.target.value;
                    setEditForm(prev => ({ ...prev, school_id: val, major_id: '', class_id: '' }));
                  }}>
                    <option value="">请选择学校</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>专业：</label>
                  <select value={editForm.major_id} onChange={(e) => {
                    const val = e.target.value;
                    setEditForm(prev => ({ ...prev, major_id: val, class_id: '' }));
                  }} disabled={!editForm.school_id}>
                    <option value="">请选择专业</option>
                    {getEditStudentSchoolMajors().map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>班级：</label>
                  <select value={editForm.class_id} onChange={(e) => setEditForm(prev => ({ ...prev, class_id: e.target.value }))} disabled={!editForm.major_id}>
                    <option value="">请选择班级</option>
                    {getEditStudentMajorClasses().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>重置密码（可选）：</label>
                  <input type="password" value={editForm.new_password} onChange={(e) => setEditForm(prev => ({ ...prev, new_password: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={handleCancelEditStudent}>取消</button>
              <button className="submit-btn" onClick={handleSaveStudent} disabled={loading}>{loading ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardPage;

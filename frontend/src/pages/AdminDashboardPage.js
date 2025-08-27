import React, { useState, useEffect } from 'react';
import { getUsers, getSchools, getMajors, getClasses, getDepartments, registerTeacher, updateUser, deleteUser, getAllCourses, createCourse, updateCourse, deleteCourse, createSchool, updateSchool, deleteSchool, createDepartment, updateDepartment, deleteDepartment, createMajor, updateMajor, deleteMajor, createClass, updateClass, deleteClass } from '../services/api';
import './AdminDashboardPage.css';
import WhaleIcon from '../components/WhaleIcon';

const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('teachers');
  const [activeSubTab, setActiveSubTab] = useState('list');
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [majors, setMajors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 编辑教师相关状态
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
    school_id: '',
    department_id: '',
    is_active: true,
    new_password: ''
  });

  // 添加教师相关状态
  const [addTeacherForm, setAddTeacherForm] = useState({
    job_no: '',
    name: '',
    password: '',
    email: '',
    phone: '',
    school_id: '',
    department_id: ''
  });

  // 滚动动画相关状态
  const [scrollAnimations, setScrollAnimations] = useState({
    formVisible: false,
    bottomFormVisible: false
  });

  // 课程相关状态
  const [courses, setCourses] = useState([]);
  const [courseForm, setCourseForm] = useState({
    name: '',
    description: '',
    teacher_id: '',
    teaching_class_name: ''
  });

  // 编辑课程状态
  const [editingCourse, setEditingCourse] = useState(null);
  const [isEditingCourse, setIsEditingCourse] = useState(false);

  // 组织架构管理相关状态
  const [departments, setDepartments] = useState([]);
  const [newSchoolForm, setNewSchoolForm] = useState({ name: '', code: '' });
  const [newDepartmentForm, setNewDepartmentForm] = useState({ name: '', code: '', school_id: '' });
  const [newMajorForm, setNewMajorForm] = useState({ name: '', code: '', department_id: '', school_id: '' });
  const [newClassForm, setNewClassForm] = useState({ name: '', grade: '', major_id: '', department_id: '' });
  const [editingSchool, setEditingSchool] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [editingMajor, setEditingMajor] = useState(null);
  const [editingClass, setEditingClass] = useState(null);
  // 查看院部下级组织
  const [viewingDepartment, setViewingDepartment] = useState(null);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [addingClassForMajor, setAddingClassForMajor] = useState(null);

  // 平滑关闭模态框
  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setViewingDepartment(null);
      setIsClosingModal(false);
      setAddingClassForMajor(null);
    }, 250); // 与CSS动画时长匹配
  };

  // 为指定专业添加班级
  const handleAddClassForMajor = (major) => {
    setAddingClassForMajor(major);
    setNewClassForm({
      name: '',
      grade: '',
      major_id: major.id,
      department_id: viewingDepartment.id
    });
  };

  // 保存班级
  const handleSaveClassForMajor = async () => {
    if (!newClassForm.name.trim()) {
      alert('请输入班级名称');
      return;
    }

    try {
      setLoading(true);
      await createClass(newClassForm);
      setSuccess('班级创建成功！');
      setAddingClassForMajor(null);
      setNewClassForm({ name: '', grade: '', major_id: '', department_id: '' });
      fetchInitialData(); // 刷新数据
    } catch (error) {
      setError(error?.response?.data?.error || '创建班级失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除班级（从院部模态框）
  const handleDeleteClassFromModal = async (classId, className) => {
    if (!window.confirm(`确定要删除班级"${className}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteClass(classId);
      setSuccess('班级删除成功！');
      fetchInitialData(); // 刷新数据
    } catch (error) {
      setError(error?.response?.data?.error || '删除班级失败');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchInitialData();
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

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 从真实API获取数据
      try {
        const schoolsData = await getSchools();
        setSchools(schoolsData);
        console.log('从API获取的学校数据:', schoolsData);
      } catch (apiError) {
        console.warn('API获取学校数据失败:', apiError);
        setSchools([]);
      }
      
      // 尝试从API获取教师数据
      try {
        const teachersData = await getUsers(1, 50, 'teacher');
        setTeachers(teachersData.users);
      } catch (apiError) {
        console.warn('API获取教师数据失败:', apiError);
        setTeachers([]);
      }

      // 尝试从API获取课程数据
      try {
        const coursesData = await getAllCourses(1, 50);
        setCourses(coursesData.courses || []);
      } catch (apiError) {
        console.warn('API获取课程数据失败:', apiError);
        setCourses([]);
      }

      // 组织数据用于组织架构管理（与课程创建分离）
      try {
        const departmentsData = await getDepartments();
        setDepartments(departmentsData);
        console.log('从API获取的院部数据:', departmentsData);
      } catch (apiError) {
        console.warn('API获取院部数据失败:', apiError);
        setDepartments([]);
      }

      try {
        const majorsData = await getMajors();
        setMajors(majorsData);
        console.log('从API获取的专业数据:', majorsData);
      } catch (apiError) {
        console.warn('API获取专业数据失败:', apiError);
        setMajors([]);
      }

      try {
        const classesData = await getClasses();
        setClasses(classesData);
        console.log('从API获取的班级数据:', classesData);
      } catch (apiError) {
        console.warn('API获取班级数据失败:', apiError);
        setClasses([]);
      }
      
    } catch (error) {
      setError(error?.response?.data?.error || '获取数据失败');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolChange = async (schoolId) => {
    console.log('学校选择改变:', schoolId);
    setAddTeacherForm(prev => ({ ...prev, school_id: schoolId, department_id: '' }));
    
    if (schoolId) {
      try {
        const departmentsData = await getDepartments(schoolId);
        setDepartments(departmentsData);
        console.log('从API获取的院部数据:', departmentsData);
      } catch (error) {
        console.error('Error fetching departments:', error);
        setDepartments([]);
      }
    } else {
      setDepartments([]);
    }
  };

  // 课程相关处理函数
  const handleCourseSchoolChange = async (schoolId) => {
    setCourseForm(prev => ({ 
      ...prev, 
      school_id: schoolId,
      department_id: '',
      major_id: '',
      class_id: ''
    }));
    
    if (schoolId) {
      try {
        const departmentsData = await getDepartments(schoolId);
        setDepartments(departmentsData);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    } else {
      setDepartments([]);
    }
  };

  const handleCourseDepartmentChange = async (departmentId) => {
    setCourseForm(prev => ({ 
      ...prev, 
      department_id: departmentId,
      major_id: '',
      class_id: ''
    }));
    
    if (departmentId) {
      try {
        const majorsData = await getMajors();
        // 过滤出属于该院部的专业
        const filteredMajors = majorsData.filter(major => 
          major.department_id == departmentId && 
          major.school_id == courseForm.school_id
        );
        setMajors(filteredMajors);
      } catch (error) {
        console.error('Error fetching majors:', error);
      }
    } else {
      setMajors([]);
    }
  };

  const handleCourseMajorChange = async (majorId) => {
    setCourseForm(prev => ({ 
      ...prev, 
      major_id: majorId,
      class_id: ''
    }));
    
    if (majorId) {
      try {
        const classesData = await getClasses(majorId);
        setClasses(classesData);
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    } else {
      setClasses([]);
    }
  };

  const handleCreateCourse = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 仅提交教学班名，不再强制依赖行政班
      const submitData = {
        name: courseForm.name,
        description: courseForm.description || '',
        teacher_id: courseForm.teacher_id,
        teaching_class_name: (courseForm.teaching_class_name || '').trim() || null
      };
      
      if (isEditingCourse && editingCourse) {
        await updateCourse(editingCourse.id, submitData);
        setSuccess('课程更新成功！');
      } else {
        await createCourse(submitData);
        setSuccess('课程创建成功！');
      }
      
      // 重置表单
      setCourseForm({
        name: '',
        description: '',
        teacher_id: '',
        teaching_class_name: ''
      });
      
      setIsEditingCourse(false);
      setEditingCourse(null);
      
      // 刷新课程列表
      const coursesData = await getAllCourses(1, 50);
      setCourses(coursesData.courses || []);
      
      // 切换到课程列表
      setActiveSubTab('list');
      
    } catch (error) {
      console.error('课程创建/更新失败:', error);
      setError(error.response?.data?.error || (isEditingCourse ? '更新课程失败' : '创建课程失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditCourse = (course) => {
    setEditingCourse(course);
    setCourseForm({
      name: course.name,
      description: course.description || '',
      teacher_id: course.teacher_id || '',
      teaching_class_name: course.teaching_class_name || course.display_class_name || ''
    });
    setIsEditingCourse(true);
    setActiveSubTab('add');
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('确定要删除该课程吗？此操作不可恢复。')) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await deleteCourse(courseId);
      setSuccess('课程已删除');
      
      // 刷新课程列表
      const coursesData = await getAllCourses(1, 50);
      setCourses(coursesData.courses || []);
      
    } catch (error) {
      setError(error.response?.data?.error || '删除课程失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await registerTeacher(addTeacherForm);
      
      setSuccess('教师账号创建成功！');
      
      // 重置表单
      setAddTeacherForm({
        job_no: '',
        name: '',
        password: '',
        email: '',
        phone: '',
        school_id: '',
        department_id: ''
      });
      
      // 刷新教师列表
      const teachersData = await getUsers(1, 50, 'teacher');
      setTeachers(teachersData.users);
      
      // 切换到教师列表
      setActiveSubTab('list');
      
    } catch (error) {
      setError(error.response?.data?.error || '创建教师账号失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTeacherClick = (teacher) => {
    setEditingTeacher(teacher);
    setEditForm({
      email: teacher.email || '',
      phone: teacher.phone || '',
      school_id: teacher.school_id || '',
      department_id: teacher.department_id || '',
      is_active: !!teacher.is_active,
      new_password: ''
    });
    setError('');
    setSuccess('');
  };

  const handleSaveTeacher = async () => {
    if (!editingTeacher) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await updateUser(editingTeacher.id, editForm);
      setSuccess('教师信息已更新');
      // 刷新列表
      const teachersData = await getUsers(1, 50, 'teacher');
      setTeachers(teachersData.users);
      setEditingTeacher(null);
    } catch (error) {
      setError(error.response?.data?.error || '更新教师信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditTeacher = () => {
    setEditingTeacher(null);
    setEditForm({ email: '', phone: '', school_id: '', department_id: '', is_active: true, new_password: '' });
  };

  const handleDeleteTeacher = async (userId) => {
    if (!window.confirm('确定要删除该教师吗？此操作不可恢复。')) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await deleteUser(userId);
      setSuccess('教师已删除');
      
      // 刷新教师列表
      const teachersData = await getUsers(1, 50, 'teacher');
      setTeachers(teachersData.users);
      
      // 同时刷新课程列表，确保数据一致性
      try {
        const coursesData = await getAllCourses(1, 50);
        setCourses(coursesData.courses || []);
      } catch (apiError) {
        console.warn('刷新课程列表失败:', apiError);
      }
    } catch (error) {
      setError(error.response?.data?.error || '删除教师失败');
    } finally {
      setLoading(false);
    }
  };

  // 组织架构管理相关处理函数
  
  // 当编辑模态框打开时，初始化表单数据
  const initializeEditForms = () => {
    if (editingSchool) {
      if (editingSchool.id) {
        // 编辑模式
        setNewSchoolForm({ name: editingSchool.name, code: editingSchool.code || '' });
      } else {
        // 添加模式
        setNewSchoolForm({ name: '', code: '' });
      }
    }
    
    if (editingDepartment) {
      if (editingDepartment.id) {
        // 编辑模式
        setNewDepartmentForm({ 
          name: editingDepartment.name, 
          code: editingDepartment.code || '', 
          school_id: editingDepartment.school_id || '' 
        });
      } else {
        // 添加模式 - 如果是从学校节点添加的，预填充学校ID
        setNewDepartmentForm({ 
          name: '', 
          code: '', 
          school_id: editingDepartment.school_id || '' 
        });
      }
    }
    
    if (editingMajor) {
      if (editingMajor.id) {
        // 编辑模式
        setNewMajorForm({ 
          name: editingMajor.name, 
          code: editingMajor.code || '', 
          department_id: editingMajor.department_id || '', 
          school_id: editingMajor.school_id || '' 
        });
      } else {
        // 添加模式 - 如果是从院部节点添加的，预填充院部和学校ID
        setNewMajorForm({ 
          name: '', 
          code: '', 
          department_id: editingMajor.department_id || '', 
          school_id: editingMajor.school_id || '' 
        });
      }
    }
    
    if (editingClass) {
      if (editingClass.id) {
        // 编辑模式
        setNewClassForm({ 
          name: editingClass.name, 
          grade: editingClass.grade || '', 
          major_id: editingClass.major_id || '', 
          department_id: editingClass.department_id || '' 
        });
      } else {
        // 添加模式 - 如果是从专业节点添加的，预填充专业和院部ID
        setNewClassForm({ 
          name: '', 
          grade: '', 
          major_id: editingClass.major_id || '', 
          department_id: editingClass.department_id || '' 
        });
      }
    }
  };

  // 监听编辑状态变化，初始化表单
  useEffect(() => {
    initializeEditForms();
  }, [editingSchool, editingDepartment, editingMajor, editingClass]);

  const handleSaveSchool = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      if (editingSchool.id) {
        // 更新学校
        await updateSchool(editingSchool.id, newSchoolForm);
        setSuccess('学校更新成功！');
      } else {
        // 创建学校
        await createSchool(newSchoolForm);
        setSuccess('学校创建成功！');
      }
      
      // 刷新学校列表
      const schoolsData = await getSchools();
      setSchools(schoolsData);
      
      // 重置表单
      setNewSchoolForm({ name: '', code: '' });
      setEditingSchool(null);
      
    } catch (error) {
      setError(error.response?.data?.error || '保存学校失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDepartment = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      if (editingDepartment.id) {
        // 更新院部
        await updateDepartment(editingDepartment.id, newDepartmentForm);
        setSuccess('院部更新成功！');
      } else {
        // 创建院部
        await createDepartment(newDepartmentForm);
        setSuccess('院部创建成功！');
      }
      
      // 刷新院部列表
      const departmentsData = await getDepartments();
      setDepartments(departmentsData);
      
      // 重置表单
      setNewDepartmentForm({ name: '', code: '', school_id: '' });
      setEditingDepartment(null);
      
    } catch (error) {
      setError(error.response?.data?.error || '保存院部失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMajor = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      if (editingMajor.id) {
        // 更新专业
        await updateMajor(editingMajor.id, newMajorForm);
        setSuccess('专业更新成功！');
      } else {
        // 创建专业
        await createMajor(newMajorForm);
        setSuccess('专业创建成功！');
      }
      
      // 刷新专业列表
      const majorsData = await getMajors();
      setMajors(majorsData);
      
      // 重置表单
      setNewMajorForm({ name: '', code: '', department_id: '', school_id: '' });
      setEditingMajor(null);
      
    } catch (error) {
      setError(error.response?.data?.error || '保存专业失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClass = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      if (editingClass.id) {
        // 更新班级
        await updateClass(editingClass.id, newClassForm);
        setSuccess('班级更新成功！');
      } else {
        // 创建班级
        await createClass(newClassForm);
        setSuccess('班级创建成功！');
      }
      
      // 刷新班级列表
      const classesData = await getClasses();
      setClasses(classesData);
      
      // 重置表单
      setNewClassForm({ name: '', grade: '', major_id: '', department_id: '' });
      setEditingClass(null);
      
    } catch (error) {
      setError(error.response?.data?.error || '保存班级失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除组织相关处理函数
  const handleDeleteSchool = async (schoolId) => {
    if (!window.confirm('确定要删除该学校吗？此操作不可恢复。')) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await deleteSchool(schoolId);
      setSuccess('学校删除成功！');
      
      // 刷新学校列表
      const schoolsData = await getSchools();
      setSchools(schoolsData);
      
    } catch (error) {
      setError(error.response?.data?.error || '删除学校失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (!window.confirm('确定要删除该院部吗？此操作不可恢复。')) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await deleteDepartment(departmentId);
      setSuccess('院部删除成功！');
      
      // 刷新院部列表
      const departmentsData = await getDepartments();
      setDepartments(departmentsData);
      
    } catch (error) {
      setError(error.response?.data?.error || '删除院部失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMajor = async (majorId) => {
    if (!window.confirm('确定要删除该专业吗？此操作不可恢复。')) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await deleteMajor(majorId);
      setSuccess('专业删除成功！');
      
      // 刷新专业列表
      const majorsData = await getMajors();
      setMajors(majorsData);
      
    } catch (error) {
      setError(error.response?.data?.error || '删除专业失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm('确定要删除该班级吗？此操作不可恢复。')) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await deleteClass(classId);
      setSuccess('班级删除成功！');
      
      // 刷新班级列表
      const classesData = await getClasses();
      setClasses(classesData);
      
    } catch (error) {
      setError(error.response?.data?.error || '删除班级失败');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>管理员控制台</h1>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'teachers' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('teachers');
            setActiveSubTab('list');
            // 清除课程相关状态
            setEditingCourse(null);
          }}
        >
          教师管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('courses');
            setActiveSubTab('list');
            // 清除教师相关状态
            setEditingTeacher(null);
          }}
        >
          课程管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'organization' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('organization');
            setActiveSubTab('schools');
          }}
        >
          组织架构管理
        </button>
      </div>

      {activeTab === 'teachers' && (
        <div className="tab-content">
          <div className="sub-tabs">
            <button 
              className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('list')}
            >
              教师列表
            </button>
            <button 
              className={`sub-tab-btn ${activeSubTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('add')}
            >
              添加教师
            </button>
          </div>

          {activeSubTab === 'list' && (
            <div className="section-content">
              <div className="section-header">
                <h2>教师列表</h2>
                <button 
                  className="add-btn"
                  onClick={() => setActiveSubTab('add')}
                >
                  添加教师
                </button>
              </div>
                
                <div className="teachers-table">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>工号</th>
                        <th>姓名</th>
                        <th>邮箱</th>
                        <th>学校</th>
                        <th>院部</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map(teacher => (
                        <tr key={teacher.id}>
                          <td>{teacher.id}</td>
                          <td>{teacher.username}</td>
                          <td>{teacher.name}</td>
                          <td>{teacher.email || '-'}</td>
                          <td>{teacher.school_name || '-'}</td>
                          <td>{teacher.department_name || '-'}</td>
                          <td>
                            <span className={`status-badge ${teacher.is_active ? 'active' : 'inactive'}`}>
                              {teacher.is_active ? '活跃' : '禁用'}
                            </span>
                          </td>
                          <td>
                            <button className="action-btn edit" onClick={() => handleEditTeacherClick(teacher)}>编辑</button>
                            <button className="action-btn delete" onClick={() => handleDeleteTeacher(teacher.id)}>删除</button>
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
                <h2>➕ 添加教师</h2>
                <div className="header-actions">
                  <button 
                    className="debug-btn"
                    onClick={() => {
                      console.log('当前状态:', { schools, departments, addTeacherForm });
                      alert(`学校数量: ${schools.length}\n院部数量: ${departments.length}\n选择的学校ID: ${addTeacherForm.school_id}`);
                    }}
                  >
                    🐛 调试信息
                  </button>
                  <button 
                    className="secondary-btn"
                    onClick={() => setActiveSubTab('list')}
                  >
                    ← 返回教师列表
                  </button>
                </div>
              </div>
                
                <div className={`add-teacher-form ${scrollAnimations.formVisible ? 'form-visible' : ''}`}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>工号：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入工号"
                        value={addTeacherForm.job_no}
                        onChange={(e) => setAddTeacherForm(prev => ({ ...prev, job_no: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>姓名：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入教师姓名"
                        value={addTeacherForm.name}
                        onChange={(e) => setAddTeacherForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>密码：<span className="required-mark">*</span></label>
                      <input 
                        type="password" 
                        placeholder="请输入初始密码"
                        value={addTeacherForm.password}
                        onChange={(e) => setAddTeacherForm(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>邮箱：</label>
                      <input 
                        type="email" 
                        placeholder="请输入邮箱地址"
                        value={addTeacherForm.email}
                        onChange={(e) => setAddTeacherForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>手机号：</label>
                      <input 
                        type="tel" 
                        placeholder="请输入手机号码"
                        value={addTeacherForm.phone}
                        onChange={(e) => setAddTeacherForm(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>学校：<span className="required-mark">*</span></label>
                      <select 
                        value={addTeacherForm.school_id} 
                        onChange={(e) => handleSchoolChange(e.target.value)}
                      >
                        <option value="">请选择学校</option>
                        {schools.map(school => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                      <small>可用学校数量: {schools.length}</small>
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>院部：<span className="required-mark">*</span></label>
                      <select 
                        value={addTeacherForm.department_id} 
                        onChange={(e) => setAddTeacherForm(prev => ({ ...prev, department_id: e.target.value }))}
                        disabled={!addTeacherForm.school_id}
                      >
                        <option value="">请选择院部</option>
                        {departments.map(department => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                      <small>可用院部数量: {departments.length} | 学校ID: {addTeacherForm.school_id}</small>
                    </div>
                    
                    <div className="form-group">
                      <label>&nbsp;</label>
                      <div className="form-help">
                        <p>教师账号创建后，工号、姓名、学校、院部信息不可修改</p>
                        <p>教师只能修改自己的密码</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`form-actions ${scrollAnimations.bottomFormVisible ? 'bottom-form-visible' : ''}`}>
                    <button 
                      className="submit-btn"
                      onClick={handleAddTeacher}
                      disabled={loading || !addTeacherForm.job_no || !addTeacherForm.name || !addTeacherForm.password || !addTeacherForm.school_id || !addTeacherForm.department_id}
                    >
                      {loading ? '添加中...' : '添加教师'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {activeTab === 'courses' && (
        <div className="tab-content">
          <div className="sub-tabs">
            <button 
              className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('list')}
            >
              课程列表
            </button>
            <button 
              className={`sub-tab-btn ${activeSubTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('add')}
            >
              添加课程
            </button>
          </div>

          {activeSubTab === 'list' && (
            <div className="section-content">
              <div className="section-header">
                <h2>课程列表</h2>
                <button 
                  className="add-btn"
                  onClick={() => setActiveSubTab('add')}
                >
                  添加课程
                </button>
              </div>
                
                <div className="courses-table">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>课程名称</th>
                        <th>描述</th>
                        <th>教师工号</th>
                        <th>教师姓名</th>
                        <th>班级</th>
                        <th>专业</th>
                        <th>院部</th>
                        <th>学校</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map(course => (
                        <tr key={course.id}>
                          <td>{course.id}</td>
                          <td>{course.name}</td>
                          <td>{course.description || '-'}</td>
                          <td>{course.teacher_username || '-'}</td>
                          <td>{course.teacher_name || '-'}</td>
                          <td>{course.display_class_name || course.teaching_class_name || course.class_name || '-'}</td>
                          <td>{course.major_name || '-'}</td>
                          <td>{course.department_name || '-'}</td>
                          <td>{course.school_name || '-'}</td>
                          <td>
                            <button className="action-btn edit" onClick={() => handleEditCourse(course)}>编辑</button>
                            <button className="action-btn delete" onClick={() => handleDeleteCourse(course.id)}>删除</button>
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
                <h2>{isEditingCourse ? '✏️ 编辑课程' : '➕ 添加课程'}</h2>
                <div className="header-actions">
                  <button 
                    className="debug-btn"
                    onClick={() => {
                      console.log('当前状态:', { schools, departments, majors, courseForm });
                      alert(`学校数量: ${schools.length}\n院部数量: ${departments.length}\n专业数量: ${majors.length}\n选择的学校ID: ${courseForm.school_id}\n选择的院部ID: ${courseForm.department_id}`);
                    }}
                  >
                    🐛 调试信息
                  </button>
                  <button 
                    className="secondary-btn"
                    onClick={() => setActiveSubTab('list')}
                  >
                    ← 返回课程列表
                  </button>
                </div>
              </div>
                
                <div className="add-course-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>课程名称：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入课程名称"
                        value={courseForm.name}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>课程描述：</label>
                      <textarea 
                        placeholder="请输入课程描述"
                        value={courseForm.description}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>授课教师：<span className="required-mark">*</span></label>
                      <select 
                        value={courseForm.teacher_id} 
                        onChange={(e) => setCourseForm(prev => ({ ...prev, teacher_id: e.target.value }))}
                      >
                        <option value="">请选择授课教师</option>
                        {teachers.map(teacher => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name}（{teacher.username}）
                          </option>
                        ))}
                      </select>
                      <small>可用教师数量: {teachers.length}</small>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>教学班名称（自定义）：</label>
                      <input 
                        type="text" 
                        placeholder="例如：2024-春 数据结构(1)"
                        value={courseForm.teaching_class_name}
                        onChange={(e) => setCourseForm(prev => ({ ...prev, teaching_class_name: e.target.value }))}
                      />
                      <small>不再从行政班中选择；此处填写教学班名</small>
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      className="submit-btn"
                      onClick={handleCreateCourse}
                      disabled={loading || !courseForm.name || !courseForm.teacher_id}
                    >
                      {loading ? (isEditingCourse ? '更新中...' : '创建中...') : (isEditingCourse ? '更新课程' : '创建课程')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

            {activeTab === 'organization' && (
        <div className="tab-content">
          <div className="section-content">
            <div className="section-header">
              <h2>🏛️ 组织架构管理</h2>
              <button 
                className="add-btn"
                onClick={() => setEditingSchool({})}
              >
                添加组织
              </button>
            </div>
            
            {/* 组织架构树形展示 */}
            <div className="organization-tree">
              {schools.map(school => (
                <div key={school.id} className="school-node">
                  <div className="school-header">
                    <h3>🏫 {school.name}</h3>
                    <div className="school-actions">
                      <button className="action-btn edit" onClick={() => setEditingSchool(school)}>编辑</button>
                      <button className="action-btn delete" onClick={() => handleDeleteSchool(school.id)}>删除</button>
                      <button className="action-btn add" onClick={() => setEditingDepartment({ school_id: school.id })}>+ 添加院部</button>
                    </div>
                  </div>
                  
                  {/* 该学校下的院部（点击查看下级组织） */}
                  {departments.filter(d => d.school_id === school.id).map(department => (
                    <div key={department.id} className="department-node">
                      <div 
                        className="department-header"
                        onClick={() => setViewingDepartment({ ...department, school_name: school.name })}
                        role="button"
                        title="点击查看该院部的下级组织"
                      >
                        <h4>🏢 {department.name}</h4>
                        <div className="department-actions">
                          <button className="action-btn edit" onClick={(e) => { e.stopPropagation(); setEditingDepartment(department); }}>编辑</button>
                          <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(department.id); }}>删除</button>
                          <button className="action-btn add" onClick={(e) => { e.stopPropagation(); setEditingMajor({ school_id: school.id, department_id: department.id }); }}>+ 添加专业</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingTeacher && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>编辑教师：{editingTeacher.name}（工号 {editingTeacher.username}）</h3>
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
                  <select value={editForm.school_id} onChange={async (e) => {
                    const val = e.target.value;
                    setEditForm(prev => ({ ...prev, school_id: val, department_id: '' }));
                    if (val) {
                      const departmentsData = await getDepartments(val);
                      setDepartments(departmentsData);
                    } else {
                      setDepartments([]);
                    }
                  }}>
                    <option value="">请选择学校</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>院部：</label>
                  <select value={editForm.department_id} onChange={(e) => setEditForm(prev => ({ ...prev, department_id: e.target.value }))} disabled={!editForm.school_id}>
                    <option value="">请选择院部</option>
                    {departments.filter(dept => dept.school_id === editForm.school_id).map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>启用状态：</label>
                  <select value={editForm.is_active ? '1' : '0'} onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.value === '1' }))}>
                    <option value="1">启用</option>
                    <option value="0">禁用</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>重置密码（可选）：</label>
                  <input type="password" value={editForm.new_password} onChange={(e) => setEditForm(prev => ({ ...prev, new_password: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={handleCancelEditTeacher}>取消</button>
              <button className="submit-btn" onClick={handleSaveTeacher} disabled={loading}>{loading ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 学校编辑模态框 */}
      {editingSchool && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingSchool.id ? '编辑学校' : '添加学校'}</h3>
              {!editingSchool.id && <p className="modal-subtitle">创建新的学校</p>}
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>学校名称：<span className="required-mark">*</span></label>
                  <input 
                    type="text" 
                    placeholder="请输入学校名称"
                    value={newSchoolForm.name}
                    onChange={(e) => setNewSchoolForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>学校代码：</label>
                  <input 
                    type="text" 
                    placeholder="请输入学校代码（可选）"
                    value={newSchoolForm.code}
                    onChange={(e) => setNewSchoolForm(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setEditingSchool(null)}>取消</button>
              <button className="submit-btn" onClick={() => handleSaveSchool()} disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 院部编辑模态框 */}
      {editingDepartment && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingDepartment.id ? '编辑院部' : '添加院部'}</h3>
              {!editingDepartment.id && editingDepartment.school_id && (
                <p className="modal-subtitle">
                  为学校 "{schools.find(s => s.id == editingDepartment.school_id)?.name}" 添加院部
                </p>
              )}
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>院部名称：<span className="required-mark">*</span></label>
                  <input 
                    type="text" 
                    placeholder="请输入院部名称"
                    value={newDepartmentForm.name}
                    onChange={(e) => setNewDepartmentForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>院部代码：</label>
                  <input 
                    type="text" 
                    placeholder="请输入院部代码（可选）"
                    value={newDepartmentForm.code}
                    onChange={(e) => setNewDepartmentForm(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>所属学校：<span className="required-mark">*</span></label>
                  <select 
                    value={newDepartmentForm.school_id} 
                    onChange={(e) => setNewDepartmentForm(prev => ({ ...prev, school_id: e.target.value }))}
                  >
                    <option value="">请选择学校</option>
                    {schools.map(school => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setEditingDepartment(null)}>取消</button>
              <button className="submit-btn" onClick={() => handleSaveDepartment()} disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 专业编辑模态框 */}
      {editingMajor && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingMajor.id ? '编辑专业' : '添加专业'}</h3>
              {!editingMajor.id && editingMajor.department_id && (
                <p className="modal-subtitle">
                  为院部 "{departments.find(d => d.id == editingMajor.department_id)?.name}" 添加专业
                </p>
              )}
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>专业名称：<span className="required-mark">*</span></label>
                  <input 
                    type="text" 
                    placeholder="请输入专业名称"
                    value={newMajorForm.name}
                    onChange={(e) => setNewMajorForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>专业代码：</label>
                  <input 
                    type="text" 
                    placeholder="请输入专业代码（可选）"
                    value={newMajorForm.code}
                    onChange={(e) => setNewMajorForm(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>所属院部：</label>
                  <select 
                    value={newMajorForm.department_id} 
                    onChange={(e) => setNewMajorForm(prev => ({ ...prev, department_id: e.target.value }))}
                  >
                    <option value="">请选择院部（可选）</option>
                    {departments.map(department => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>所属学校：<span className="required-mark">*</span></label>
                  <select 
                    value={newMajorForm.school_id} 
                    onChange={(e) => setNewMajorForm(prev => ({ ...prev, school_id: e.target.value }))}
                  >
                    <option value="">请选择学校</option>
                    {schools.map(school => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setEditingMajor(null)}>取消</button>
              <button className="submit-btn" onClick={() => handleSaveMajor()} disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 班级编辑模态框 */}
      {editingClass && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingClass.id ? '编辑班级' : '添加班级'}</h3>
              {!editingClass.id && editingClass.major_id && (
                <p className="modal-subtitle">
                  为专业 "{majors.find(m => m.id == editingClass.major_id)?.name}" 添加班级
                </p>
              )}
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>班级名称：<span className="required-mark">*</span></label>
                  <input 
                    type="text" 
                    placeholder="请输入班级名称"
                    value={newClassForm.name}
                    onChange={(e) => setNewClassForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>年级：</label>
                  <input 
                    type="text" 
                    placeholder="请输入年级（可选）"
                    value={newClassForm.grade}
                    onChange={(e) => setNewClassForm(prev => ({ ...prev, grade: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>所属专业：</label>
                  <select 
                    value={newClassForm.major_id} 
                    onChange={(e) => setNewClassForm(prev => ({ ...prev, major_id: e.target.value }))}
                  >
                    <option value="">请选择专业（可选）</option>
                    {majors.map(major => (
                      <option key={major.id} value={major.id}>
                        {major.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>所属院部：</label>
                  <select 
                    value={newClassForm.department_id} 
                    onChange={(e) => setNewClassForm(prev => ({ ...prev, department_id: e.target.value }))}
                  >
                    <option value="">请选择院部（可选）</option>
                    {departments.map(department => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={() => setEditingClass(null)}>取消</button>
              <button className="submit-btn" onClick={() => handleSaveClass()} disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 院部下级组织查看模态框 */}
      {viewingDepartment && (
        <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={handleCloseModal}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>院部下级组织：{viewingDepartment.name}</h3>
              <p className="modal-subtitle">所属学校：{viewingDepartment.school_name || '-'} | 院部ID：{viewingDepartment.id}</p>
            </div>
            <div className="modal-body">
              {(() => {
                const deptMajors = majors.filter(m => m.department_id == viewingDepartment.id);
                if (deptMajors.length === 0) {
                  return <p>暂无专业。</p>;
                }
                return (
                  <div className="dept-children">
                    {deptMajors.map(m => {
                      const majorClasses = classes.filter(c => c.major_id == m.id);
                      return (
                        <div key={m.id} className="dept-major-block">
                          <div className="dept-major-header">📚 {m.name}（ID: {m.id}）<span className="count">班级数：{majorClasses.length}</span></div>
                          {majorClasses.length > 0 ? (
                            <ul className="dept-class-list">
                              {majorClasses.map(c => (
                                <li key={c.id} className="class-item">
                                  <span className="class-info">👥 {c.name}（ID: {c.id}）</span>
                                  <button 
                                    className="delete-class-btn"
                                    onClick={() => handleDeleteClassFromModal(c.id, c.name)}
                                    disabled={loading}
                                    title={`删除班级"${c.name}"`}
                                  >
                                    🗑️
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="empty">该专业暂无班级</div>
                          )}
                          
                          {/* 添加班级按钮 */}
                          <div className="dept-major-actions">
                            <button 
                              className="add-class-btn"
                              onClick={() => handleAddClassForMajor(m)}
                              disabled={addingClassForMajor?.id === m.id}
                            >
                              {addingClassForMajor?.id === m.id ? '添加中...' : '➕ 添加班级'}
                            </button>
                          </div>

                          {/* 添加班级表单 */}
                          {addingClassForMajor?.id === m.id && (
                            <div className="add-class-form">
                              <div className="form-row">
                                <div className="form-group">
                                  <label>班级名称：<span className="required-mark">*</span></label>
                                  <input 
                                    type="text" 
                                    placeholder="请输入班级名称"
                                    value={newClassForm.name}
                                    onChange={(e) => setNewClassForm(prev => ({ ...prev, name: e.target.value }))}
                                  />
                                </div>
                                <div className="form-group">
                                  <label>年级：</label>
                                  <input 
                                    type="text" 
                                    placeholder="请输入年级（可选）"
                                    value={newClassForm.grade}
                                    onChange={(e) => setNewClassForm(prev => ({ ...prev, grade: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="form-actions">
                                <button 
                                  className="secondary-btn small"
                                  onClick={() => setAddingClassForMajor(null)}
                                >
                                  取消
                                </button>
                                <button 
                                  className="submit-btn small"
                                  onClick={handleSaveClassForMajor}
                                  disabled={loading || !newClassForm.name.trim()}
                                >
                                  {loading ? '保存中...' : '保存'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={handleCloseModal}>关闭</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default AdminDashboardPage;

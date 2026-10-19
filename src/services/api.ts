import { User, DocForm, Post, AuditLog } from '../types';
import { db } from '../lib/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const defaultSeedForms: DocForm[] = [
  {
    id: 'form-user-1',
    title: '기관 이용신청서 및 개인정보 수집·이용 동의서',
    category: '이용자 양식',
    department: '상담사례관리팀',
    description: '복지관 및 기관 프로그램 신규 등록 이용인을 위한 기본 이용신청서 및 개인정보 동의 양식입니다.',
    fileName: '이용자_서비스이용신청서.hwp',
    fileExt: 'hwp',
    filePath: '이용자_서비스이용신청서.hwp',
    fileSize: 46200,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 19,
    isOfficial: true,
  },
  {
    id: 'form-user-2',
    title: '서비스 제공계약서 및 이용자 권리보호 서약서',
    category: '이용자 양식',
    department: '재활사업팀',
    description: '개별 맞춤 재활 및 복지 서비스 제공에 따른 권리 고지 및 표준 이용계약 서식입니다.',
    fileName: '이용자_서비스제공계약서.hwp',
    fileExt: 'hwp',
    filePath: '이용자_서비스제공계약서.hwp',
    fileSize: 42100,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 12,
    isOfficial: true,
  },
  {
    id: 'form-user-3',
    title: '서비스 변경 및 종결(퇴소) 신청서',
    category: '이용자 양식',
    department: '상담사례관리팀',
    description: '기존 이용 중인 서비스의 시간/종류 변경이나 자진 종결 시 제출하는 양식입니다.',
    fileName: '이용자_서비스변경종결신청서.hwp',
    fileExt: 'hwp',
    filePath: '이용자_서비스변경종결신청서.hwp',
    fileSize: 37500,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 18,
    isOfficial: true,
  },
  {
    id: 'form-user-4',
    title: '이용자 고충처리 및 건의 접수서',
    category: '이용자 양식',
    department: '기획운영팀',
    description: '기관 시설 이용 중 불편사항 및 개선 건의 시 작성하는 공식 접수 서식입니다.',
    fileName: '이용자_고충접수서.hwp',
    fileExt: 'hwp',
    filePath: '이용자_고충접수서.hwp',
    fileSize: 35000,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 18,
    isOfficial: true,
  },
  {
    id: 'form-act-1',
    title: '장애인활동지원 급여제공기록지 (표준서식)',
    category: '활동지원사 양식',
    department: '활동지원팀',
    description: '활동보조, 방문목욕, 방문간호 등 급여 제공 내역을 일자별·시간대별로 기록하는 필수 법정 서식입니다.',
    fileName: '활동지원_급여제공기록지.hwp',
    fileExt: 'hwp',
    filePath: '활동지원_급여제공기록지.hwp',
    fileSize: 53200,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 9,
    isOfficial: true,
  },
  {
    id: 'form-act-2',
    title: '활동지원사 근무상황부 및 출근부',
    category: '활동지원사 양식',
    department: '활동지원팀',
    description: '월별 배정 수급자별 근무 시간 집계 및 출퇴근 확인용 근무상황부 서식입니다.',
    fileName: '활동지원사_근무상황부_출근부.hwp',
    fileExt: 'hwp',
    filePath: '활동지원사_근무상황부_출근부.hwp',
    fileSize: 48900,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 14,
    isOfficial: true,
  },
  {
    id: 'form-act-3',
    title: '활동지원 업무일지 및 특이사항(응급상황) 보고서',
    category: '활동지원사 양식',
    department: '활동지원팀',
    description: '서비스 제공 중 수급자 건강 이상, 병원 동행, 사고 발생 등 긴급 특이사항 발생 시 보고하는 서식입니다.',
    fileName: '활동지원사_업무일지_보고서.hwp',
    fileExt: 'hwp',
    filePath: '활동지원사_업무일지_보고서.hwp',
    fileSize: 39500,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 14,
    isOfficial: true,
  },
  {
    id: 'form-act-4',
    title: '활동지원 서비스 일정변경 및 휴무 신청서',
    category: '활동지원사 양식',
    department: '활동지원팀',
    description: '사전 협의된 서비스 일정 변경이나 병가, 경조사 등으로 인한 일정 조정 시 제출합니다.',
    fileName: '활동지원_일정변경신청서.hwp',
    fileExt: 'hwp',
    filePath: '활동지원_일정변경신청서.hwp',
    fileSize: 36000,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 17,
    isOfficial: true,
  },
  {
    id: 'form-adm-1',
    title: '기관 표준 기안서 (일반 기안·보고용)',
    category: '행정양식 및 회계서류',
    department: '기획운영팀',
    description: '사내 공문 및 부서간 업무 협조, 결재 상신용 표준 한글 기안 서식입니다.',
    fileName: '기관표준_기안서_서식.hwp',
    fileExt: 'hwp',
    filePath: '기관표준_기안서_서식.hwp',
    fileSize: 42560,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 12,
    isOfficial: true,
  },
  {
    id: 'form-adm-2',
    title: '지출결의서 및 품의서 양식',
    category: '행정양식 및 회계서류',
    department: '운영지원팀/회계',
    description: '물품 구매, 행사비, 사업운영비 집행 전 지출품의 및 집행 후 영수증 첨부 결의서입니다.',
    fileName: '표준_지출품의_및_지출결의서.hwp',
    fileExt: 'hwp',
    filePath: '표준_지출품의_및_지출결의서.hwp',
    fileSize: 51200,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 13,
    isOfficial: true,
  },
  {
    id: 'form-adm-3',
    title: '휴가·연차·출장 신청서 (복무규정 서식)',
    category: '행정양식 및 회계서류',
    department: '인사팀/공통',
    description: '연차휴가, 특별휴가, 공가, 병가 및 대외 출장 신청 시 사용하는 복무 결재서식입니다.',
    fileName: '복무_휴가연차출장신청서.hwp',
    fileExt: 'hwp',
    filePath: '복무_휴가연차출장신청서.hwp',
    fileSize: 38400,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 14,
    isOfficial: true,
  },
  {
    id: 'form-adm-4',
    title: '기관 대외 표준 공문서 양식',
    category: '행정양식 및 회계서류',
    department: '기획운영팀',
    description: '유관기관 및 지자체, 교육청, 협력기관 송부용 공식 수발신 공문서 표제 양식입니다.',
    fileName: '대외_표준공문서_표제양식.hwp',
    fileExt: 'hwp',
    filePath: '대외_표준공문서_표제양식.hwp',
    fileSize: 45056,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 9,
    isOfficial: true,
  },
  {
    id: 'form-adm-5',
    title: '물품 구매(수리) 요구서 및 검수조서',
    category: '행정양식 및 회계서류',
    department: '운영지원팀/자산',
    description: '사무용품, 전자기기, 재활/치료용품 구입 요청 및 납품 완료 후 검수 시 작성하는 서식입니다.',
    fileName: '물품구매요구서_및_검수조서.hwp',
    fileExt: 'hwp',
    filePath: '물품구매요구서_및_검수조서.hwp',
    fileSize: 41200,
    uploadedBy: 'admin-master',
    uploaderName: '시스템관리자',
    createdAt: '2026-10-01T09:00:00.000Z',
    downloadCount: 15,
    isOfficial: true,
  },
];

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ success: boolean; user?: User; message?: string; status?: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '로그인에 실패했습니다.');
    }
    return data;
  },

  async register(payload: {
    username: string;
    password: string;
    name: string;
    department: string;
    position: string;
    phone?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '가입 신청에 실패했습니다.');
    }
    return data;
  },

  // Admin User Management
  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    return data.users || [];
  },

  async approveUser(userId: string, adminName: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${userId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || '승인 처리에 실패했습니다.');
    }
  },

  async banUser(userId: string, adminName: string, reason?: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName, reason }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || '차단 처리에 실패했습니다.');
    }
  },

  async unbanUser(userId: string, adminName: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${userId}/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || '차단 해제에 실패했습니다.');
    }
  },

  async deleteUser(userId: string, adminName: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || '사용자 삭제에 실패했습니다.');
    }
  },

  // Audit Logs (Admin only)
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/admin/audit-logs');
    const data = await res.json();
    return data.logs || [];
  },

  async logClientAudit(payload: {
    userId?: string;
    username?: string;
    name?: string;
    department?: string;
    action: string;
    category: 'AUTH' | 'PDF' | 'IMAGE' | 'FORM' | 'ADMIN' | 'BOARD';
    details: string;
  }): Promise<void> {
    try {
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Failed to log audit event:', e);
    }
  },

  // Forms (Direct client-side Firestore persistence for 100% reliability across refreshes and Vercel deployments)
  async getForms(): Promise<DocForm[]> {
    try {
      const docRef = doc(db, 'forms', 'all_data');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && Array.isArray(docSnap.data()?.items)) {
        return docSnap.data().items as DocForm[];
      } else {
        await setDoc(docRef, { items: defaultSeedForms, updatedAt: new Date().toISOString() });
        return defaultSeedForms;
      }
    } catch (err) {
      console.warn('Firestore getForms fallback:', err);
      return defaultSeedForms;
    }
  },

  async uploadForm(formData: FormData): Promise<DocForm> {
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const department = formData.get('department') as string;
    const description = formData.get('description') as string;
    const uploaderId = formData.get('uploaderId') as string;
    const uploaderName = formData.get('uploaderName') as string;
    const file = formData.get('file') as File | null;

    const fileExt = file ? file.name.split('.').pop() || 'hwp' : 'hwp';
    const newForm: DocForm = {
      id: `form-${Date.now()}`,
      title: title.trim(),
      category: category.trim(),
      department: department ? department.trim() : '공통',
      description: description ? description.trim() : '',
      fileName: file ? file.name : `${title}.${fileExt}`,
      fileExt,
      filePath: file ? file.name : `${title}.${fileExt}`,
      fileSize: file ? file.size : 10240,
      uploadedBy: uploaderId || 'admin-master',
      uploaderName: uploaderName || '시스템관리자',
      createdAt: new Date().toISOString(),
      downloadCount: 0,
      isOfficial: true,
    };

    try {
      const docRef = doc(db, 'forms', 'all_data');
      const docSnap = await getDoc(docRef);
      let currentForms: DocForm[] = docSnap.exists() && Array.isArray(docSnap.data()?.items)
        ? docSnap.data().items
        : [...defaultSeedForms];

      currentForms.unshift(newForm);
      await setDoc(docRef, { items: currentForms, updatedAt: new Date().toISOString() });
      return newForm;
    } catch (err: any) {
      throw new Error(err.message || '양식 업로드 중 오류가 발생했습니다.');
    }
  },

  async deleteForm(id: string, adminName: string): Promise<void> {
    try {
      const docRef = doc(db, 'forms', 'all_data');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && Array.isArray(docSnap.data()?.items)) {
        let currentForms: DocForm[] = docSnap.data().items;
        currentForms = currentForms.filter((f) => f.id !== id);
        await setDoc(docRef, { items: currentForms, updatedAt: new Date().toISOString() });
      }
    } catch (err: any) {
      throw new Error(err.message || '양식 삭제 중 오류가 발생했습니다.');
    }
  },

  async updateForm(id: string, formData: FormData): Promise<DocForm> {
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const department = formData.get('department') as string;
    const description = formData.get('description') as string;
    const file = formData.get('file') as File | null;

    try {
      const docRef = doc(db, 'forms', 'all_data');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && Array.isArray(docSnap.data()?.items)) {
        let currentForms: DocForm[] = docSnap.data().items;
        let updatedForm: DocForm | null = null;
        currentForms = currentForms.map((f) => {
          if (f.id === id) {
            const fileExt = file ? file.name.split('.').pop() || f.fileExt : f.fileExt;
            updatedForm = {
              ...f,
              title: title ? title.trim() : f.title,
              category: category ? category.trim() : f.category,
              department: department ? department.trim() : f.department,
              description: description !== undefined ? description.trim() : f.description,
              fileName: file ? file.name : f.fileName,
              fileExt: file ? fileExt : f.fileExt,
              fileSize: file ? file.size : f.fileSize,
            };
            return updatedForm;
          }
          return f;
        });
        await setDoc(docRef, { items: currentForms, updatedAt: new Date().toISOString() });
        if (updatedForm) return updatedForm;
      }
      throw new Error('해당 양식을 찾을 수 없습니다.');
    } catch (err: any) {
      throw new Error(err.message || '양식 수정 중 오류가 발생했습니다.');
    }
  },

  getFormDownloadUrl(formId: string, user?: User | null): string {
    const params = new URLSearchParams();
    if (user) {
      params.append('userId', user.id);
      params.append('userName', user.name);
      params.append('userDept', user.department);
    }
    return `/api/forms/${formId}/download?${params.toString()}`;
  },

  // Board
  async getPosts(): Promise<Post[]> {
    const res = await fetch('/api/posts');
    const data = await res.json();
    return data.posts || [];
  },

  async getPost(id: string): Promise<Post> {
    const res = await fetch(`/api/posts/${id}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '게시글을 불러올 수 없습니다.');
    }
    return data.post;
  },

  async createPost(payload: {
    title: string;
    category: string;
    content: string;
    authorId: string;
    authorName: string;
    department: string;
    isNotice?: boolean;
  }): Promise<Post> {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '게시글 등록에 실패했습니다.');
    }
    return data.post;
  },

  async addComment(
    postId: string,
    payload: {
      authorId: string;
      authorName: string;
      department: string;
      content: string;
    }
  ): Promise<any> {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '댓글 등록에 실패했습니다.');
    }
    return data.comment;
  },

  async deletePost(postId: string, userId: string, adminName: string): Promise<void> {
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adminName }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || '게시글 삭제에 실패했습니다.');
    }
  },

  async likePost(postId: string, userId?: string): Promise<{ likes: number; hasLiked: boolean }> {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '공감 처리에 실패했습니다.');
    }
    return data;
  },

  async updatePostStatus(postId: string, status: string, adminName: string): Promise<Post> {
    const res = await fetch(`/api/posts/${postId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminName }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '상태 변경에 실패했습니다.');
    }
    return data.post;
  },
};

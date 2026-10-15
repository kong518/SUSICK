import { User, DocForm, Post, AuditLog } from '../types';

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

  // Forms
  async getForms(): Promise<DocForm[]> {
    const res = await fetch('/api/forms');
    const data = await res.json();
    return data.forms || [];
  },

  async uploadForm(formData: FormData): Promise<DocForm> {
    const res = await fetch('/api/forms', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || '양식 업로드에 실패했습니다.');
    }
    return data.form;
  },

  async deleteForm(id: string, adminName: string): Promise<void> {
    const res = await fetch(`/api/forms/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || '양식 삭제에 실패했습니다.');
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

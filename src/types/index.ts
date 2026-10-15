export interface User {
  id: string;
  username: string;
  name: string;
  department: string;
  position: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'banned';
  createdAt: string;
  approvedAt?: string;
  bannedAt?: string;
  lastLoginAt?: string;
}

export interface DocForm {
  id: string;
  title: string;
  category: '이용자 양식' | '활동지원사 양식' | '행정양식' | string;
  department: string;
  description: string;
  fileName: string;
  fileExt: string;
  filePath: string;
  fileSize: number;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
  downloadCount: number;
  isOfficial: boolean;
  rankDelta?: number; // Rank change: positive for up (e.g. +2), negative for down (-1), 0 for same, undefined for new
  isNew?: boolean;
}

export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  department: string;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  category: '기능 개선' | '신규 서식 요청' | '시스템 개선' | '오류·버그 제보' | '사용 문의' | string;
  content: string;
  authorId: string;
  authorName: string;
  department: string;
  createdAt: string;
  views: number;
  likes?: number;
  likedBy?: string[];
  status?: '접수완료' | '검토중' | '반영완료' | '답변완료';
  isNotice: boolean;
  comments: PostComment[];
  attachmentName?: string;
  attachmentPath?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  name: string;
  department: string;
  action: string;
  category: 'AUTH' | 'PDF' | 'IMAGE' | 'FORM' | 'ADMIN' | 'BOARD';
  details: string;
  timestamp: string;
  ip?: string;
}

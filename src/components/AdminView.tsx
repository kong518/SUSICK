import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  Clock,
  History,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  RefreshCw,
  Trash2,
  Filter,
  X,
  Shield,
  Lock,
} from 'lucide-react';
import { User, AuditLog } from '../types';
import { api } from '../services/api';

interface AdminViewProps {
  currentUser: User | null;
  onRefreshPendingCount: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, onRefreshPendingCount }) => {
  const [adminTab, setAdminTab] = useState<'users' | 'audit'>('users');

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [userFilter, setUserFilter] = useState<'all' | 'pending' | 'approved' | 'banned'>('pending');
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Notification / Toast state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal dialog states (Replacing window.prompt / window.confirm)
  const [banModalTarget, setBanModalTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('업무 규정 위반 또는 퇴사');
  const [unbanModalTarget, setUnbanModalTarget] = useState<User | null>(null);
  const [deleteModalTarget, setDeleteModalTarget] = useState<User | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load users
  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const list = await api.getUsers();
      setUsers(list);
      onRefreshPendingCount();
    } catch (err) {
      console.error(err);
      showToast('직원 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Load audit logs
  const loadAuditLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
      showToast('감사 기록을 불러오지 못했습니다.', 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadAuditLogs();
  }, []);

  // Admin actions
  const handleApproveUser = async (user: User) => {
    try {
      await api.approveUser(user.id, currentUser?.name || '시스템관리자');
      showToast(`[${user.name}] 직원의 가입 신청을 승인하였습니다.`, 'success');
      await loadUsers();
      await loadAuditLogs();
    } catch (err: any) {
      showToast(err.message || '승인 처리에 실패했습니다.', 'error');
    }
  };

  const handleConfirmBan = async () => {
    if (!banModalTarget) return;
    try {
      await api.banUser(banModalTarget.id, currentUser?.name || '시스템관리자', banReason);
      showToast(`[${banModalTarget.name}] 직원을 차단(벤) 조치하였습니다.`, 'info');
      setBanModalTarget(null);
      await loadUsers();
      await loadAuditLogs();
    } catch (err: any) {
      showToast(err.message || '차단 처리에 실패했습니다.', 'error');
    }
  };

  const handleConfirmUnban = async () => {
    if (!unbanModalTarget) return;
    try {
      await api.unbanUser(unbanModalTarget.id, currentUser?.name || '시스템관리자');
      showToast(`[${unbanModalTarget.name}] 직원의 차단을 해제하였습니다.`, 'success');
      setUnbanModalTarget(null);
      await loadUsers();
      await loadAuditLogs();
    } catch (err: any) {
      showToast(err.message || '차단 해제에 실패했습니다.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalTarget) return;
    try {
      await api.deleteUser(deleteModalTarget.id, currentUser?.name || '시스템관리자');
      showToast(`[${deleteModalTarget.name}] 계정을 영구 삭제하였습니다.`, 'info');
      setDeleteModalTarget(null);
      await loadUsers();
      await loadAuditLogs();
    } catch (err: any) {
      showToast(err.message || '계정 삭제에 실패했습니다.', 'error');
    }
  };

  // Export audit logs to CSV
  const handleExportAuditLogsToCsv = () => {
    if (auditLogs.length === 0) {
      showToast('내보낼 활동 기록이 없습니다.', 'error');
      return;
    }

    const headers = ['일시', '카테고리', '작업구분', '사용자명', '계정ID', '부서', '활동 상세내용'];
    const rows = auditLogs.map((l) => [
      new Date(l.timestamp).toLocaleString('ko-KR'),
      l.category,
      l.action,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.username.replace(/"/g, '""')}"`,
      `"${l.department.replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `수원시장애인종합복지관_업무감사기록_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('감사 기록 CSV 파일 다운로드가 완료되었습니다.', 'success');
  };

  // Stats
  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const approvedCount = users.filter((u) => u.status === 'approved').length;
  const bannedCount = users.filter((u) => u.status === 'banned').length;

  const filteredUsers = users.filter((u) => {
    const matchStatus = userFilter === 'all' || u.status === userFilter;
    const matchSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.department.toLowerCase().includes(userSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredAuditLogs = auditLogs.filter((l) => {
    const matchCategory = auditFilter === 'ALL' || l.category === auditFilter;
    const matchSearch =
      l.name.toLowerCase().includes(auditSearch.toLowerCase()) ||
      l.username.toLowerCase().includes(auditSearch.toLowerCase()) ||
      l.department.toLowerCase().includes(auditSearch.toLowerCase()) ||
      l.details.toLowerCase().includes(auditSearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Guard: Admin only
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="steep-card-neutral p-12 text-center max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-[#5d2a1a] mx-auto mb-3" />
        <h2 className="font-steep-serif text-xl text-[#17191c]">관리자 전용 구역</h2>
        <p className="text-xs text-[#777b86] mt-1.5 leading-relaxed">
          본 화면은 수원시장애인종합복지관 시스템관리자만 접근할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-4 rounded-[16px] text-xs font-medium flex items-center justify-between shadow-xs transition-all ${
            toastMessage.type === 'success'
              ? 'bg-[#f6ffed] text-[#389e0d] border border-[#b7eb8f]'
              : toastMessage.type === 'error'
              ? 'bg-[#fff1f0] text-[#cf1322] border border-[#ffccc7]'
              : 'bg-[#17191c] text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'info' && <Shield className="w-4 h-4 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-current opacity-70 hover:opacity-100 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner: Steep Editorial Style */}
      <div className="steep-card-neutral p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-[11px] font-semibold text-[#5d2a1a] bg-[#fbe1d1] px-3 py-0.5 rounded-full">
                관리자 전담 승인 및 보안 센터
              </span>
              <span className="text-xs text-[#777b86]">접속자: {currentUser.name}</span>
            </div>
            <h1 className="font-steep-serif text-3xl sm:text-4xl text-[#17191c]">
              회원 승인·차단 관리 및 활동 감사로그
            </h1>
            <p className="text-sm text-[#777b86] mt-2 font-normal max-w-2xl leading-relaxed">
              <strong>오직 시스템관리자만</strong> 신규 등록 직원의 가입을 최종 승인하거나 차단할 수 있습니다.
              기관 내 모든 문서 작업과 파일 다운로드 활동 기록을 전담 감시합니다.
            </p>
          </div>

          {/* Sub Navigation Switcher */}
          <div className="flex items-center space-x-1.5 bg-[#f2f2f3] p-1.5 rounded-full self-start md:self-auto shrink-0">
            <button
              onClick={() => setAdminTab('users')}
              className={`flex items-center space-x-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                adminTab === 'users'
                  ? 'bg-[#17191c] text-white shadow-xs'
                  : 'text-[#777b86] hover:text-[#17191c]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>1. 회원 승인 및 차단</span>
              {pendingCount > 0 && (
                <span className="bg-[#cf1322] text-white text-[10px] px-2 py-0.2 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setAdminTab('audit')}
              className={`flex items-center space-x-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                adminTab === 'audit'
                  ? 'bg-[#17191c] text-white shadow-xs'
                  : 'text-[#777b86] hover:text-[#17191c]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>2. 활동 감사기록 (관리자 전용)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          ADMIN TAB 1: 회원 승인 및 차단 (USER MANAGEMENT)
         ======================================================== */}
      {adminTab === 'users' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="steep-card-neutral p-5">
              <div className="text-xs font-medium text-[#777b86]">전체 등록 계정</div>
              <div className="text-2xl font-bold text-[#17191c] mt-1.5">{users.length}명</div>
            </div>

            <div className="p-5 rounded-[24px] bg-[#fff1f0] border border-[#ffccc7]">
              <div className="text-xs font-semibold text-[#cf1322] flex items-center justify-between">
                <span>승인 대기중 (승인 권한: 관리자)</span>
                {pendingCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#cf1322] animate-ping" />}
              </div>
              <div className="text-2xl font-bold text-[#cf1322] mt-1.5">{pendingCount}명</div>
            </div>

            <div className="p-5 rounded-[24px] bg-[#f6ffed] border border-[#b7eb8f]">
              <div className="text-xs font-semibold text-[#389e0d]">정상 승인 계정</div>
              <div className="text-2xl font-bold text-[#389e0d] mt-1.5">{approvedCount}명</div>
            </div>

            <div className="p-5 rounded-[24px] bg-[#f2f2f3] border border-[#ececec]">
              <div className="text-xs font-semibold text-[#777b86]">차단(벤) 계정</div>
              <div className="text-2xl font-bold text-[#17191c] mt-1.5">{bannedCount}명</div>
            </div>
          </div>

          {/* Filter and Search Bar: Steep Pill Style */}
          <div className="steep-card-neutral p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => setUserFilter('pending')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  userFilter === 'pending'
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'bg-[#f2f2f3] text-[#777b86] hover:text-[#17191c]'
                }`}
              >
                <span>승인 대기 ({pendingCount})</span>
              </button>

              <button
                onClick={() => setUserFilter('approved')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  userFilter === 'approved'
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'bg-[#f2f2f3] text-[#777b86] hover:text-[#17191c]'
                }`}
              >
                <span>정상 승인 ({approvedCount})</span>
              </button>

              <button
                onClick={() => setUserFilter('banned')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  userFilter === 'banned'
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'bg-[#f2f2f3] text-[#777b86] hover:text-[#17191c]'
                }`}
              >
                <span>차단(벤) 목록 ({bannedCount})</span>
              </button>

              <button
                onClick={() => setUserFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  userFilter === 'all'
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'bg-[#f2f2f3] text-[#777b86] hover:text-[#17191c]'
                }`}
              >
                <span>전체 ({users.length})</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 w-full md:w-72">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#979799]" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="이름, 아이디, 부서 검색..."
                  className="steep-input w-full pl-10 text-xs py-2"
                />
              </div>
              <button
                onClick={loadUsers}
                title="새로고침"
                className="p-2 border border-[#ececec] rounded-full hover:bg-[#f2f2f3] text-[#777b86] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User Table */}
          <div className="steep-card-neutral overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f2f2f3] text-[#777b86] uppercase font-semibold border-b border-[#ececec]">
                  <tr>
                    <th className="py-3.5 px-5">성명 / 직책</th>
                    <th className="py-3.5 px-4">계정 ID</th>
                    <th className="py-3.5 px-4">소속 부서</th>
                    <th className="py-3.5 px-4">가입 신청일시</th>
                    <th className="py-3.5 px-4">상태</th>
                    <th className="py-3.5 px-5 text-center">관리 조치 (오직 관리자만 가능)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f3]">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#777b86]">
                        직원 목록을 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#777b86]">
                        조건에 해당하는 사용자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isMasterAdmin = u.username === '시스템관리자' || u.id === 'admin-master';
                      return (
                        <tr key={u.id} className="hover:bg-[#fafafb] transition-colors">
                          <td className="py-4 px-5">
                            <div className="font-semibold text-sm text-[#17191c] flex items-center space-x-2">
                              <span>{u.name}</span>
                              {isMasterAdmin && (
                                <span className="bg-[#17191c] text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                                  최고관리자 (나)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#777b86] mt-0.5">{u.position || '직원'}</div>
                          </td>
                          <td className="py-4 px-4 font-mono text-[#17191c]">{u.username}</td>
                          <td className="py-4 px-4 text-[#777b86]">{u.department}</td>
                          <td className="py-4 px-4 text-[#777b86]">
                            {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                          </td>
                          <td className="py-4 px-4">
                            {u.status === 'pending' && (
                              <span className="inline-flex items-center space-x-1.5 bg-[#fff1f0] text-[#cf1322] border border-[#ffccc7] font-semibold px-2.5 py-1 rounded-full text-[11px]">
                                <Clock className="w-3 h-3 text-[#cf1322]" />
                                <span>승인 대기중</span>
                              </span>
                            )}
                            {u.status === 'approved' && (
                              <span className="inline-flex items-center space-x-1.5 bg-[#f6ffed] text-[#389e0d] border border-[#b7eb8f] font-semibold px-2.5 py-1 rounded-full text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-[#389e0d]" />
                                <span>정상 승인</span>
                              </span>
                            )}
                            {u.status === 'banned' && (
                              <span className="inline-flex items-center space-x-1.5 bg-[#f2f2f3] text-[#777b86] border border-[#ececec] font-semibold px-2.5 py-1 rounded-full text-[11px]">
                                <XCircle className="w-3 h-3 text-[#777b86]" />
                                <span>차단(벤)됨</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-center">
                            {isMasterAdmin ? (
                              <span className="text-[11px] text-[#979799] font-medium">
                                보호된 최고 관리자
                              </span>
                            ) : (
                              <div className="flex items-center justify-center space-x-2">
                                {/* Approve Button */}
                                {u.status === 'pending' && (
                                  <button
                                    onClick={() => handleApproveUser(u)}
                                    className="px-3 py-1.5 bg-[#17191c] hover:bg-[#2c2f35] text-white font-medium rounded-full transition-all text-xs flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>승인 완료</span>
                                  </button>
                                )}

                                {/* Ban Button */}
                                {u.status === 'approved' && (
                                  <button
                                    onClick={() => {
                                      setBanModalTarget(u);
                                      setBanReason('업무 규정 위반 또는 퇴사');
                                    }}
                                    className="px-3 py-1.5 bg-white hover:bg-[#fff1f0] text-[#cf1322] border border-[#ffccc7] font-medium rounded-full transition-all text-xs flex items-center space-x-1.5 cursor-pointer"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>벤(차단)</span>
                                  </button>
                                )}

                                {/* Unban Button */}
                                {u.status === 'banned' && (
                                  <button
                                    onClick={() => setUnbanModalTarget(u)}
                                    className="px-3 py-1.5 bg-white hover:bg-[#f2f2f3] text-[#17191c] border border-[#ececec] font-medium rounded-full transition-all text-xs flex items-center space-x-1.5 cursor-pointer"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>차단 해제</span>
                                  </button>
                                )}

                                {/* Delete User */}
                                <button
                                  onClick={() => setDeleteModalTarget(u)}
                                  title="계정 영구 삭제"
                                  className="p-1.5 text-[#979799] hover:text-[#cf1322] rounded-full hover:bg-[#f2f2f3] cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ADMIN TAB 2: 활동 기록 및 감사로그 (AUDIT LOGS)
         ======================================================== */}
      {adminTab === 'audit' && (
        <div className="space-y-4">
          {/* Top Bar with Export & Filter */}
          <div className="steep-card-neutral p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
              {['ALL', 'AUTH', 'PDF', 'IMAGE', 'FORM', 'BOARD', 'ADMIN'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAuditFilter(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    auditFilter === cat
                      ? 'bg-[#17191c] text-white shadow-xs'
                      : 'bg-[#f2f2f3] text-[#777b86] hover:text-[#17191c]'
                  }`}
                >
                  {cat === 'ALL'
                    ? '전체 활동'
                    : cat === 'AUTH'
                    ? '로그인/가입'
                    : cat === 'PDF'
                    ? 'PDF 작업'
                    : cat === 'IMAGE'
                    ? '누끼따기'
                    : cat === 'FORM'
                    ? '양식 다운로드'
                    : cat === 'BOARD'
                    ? '건의사항 게시판'
                    : '관리자 조치'}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto">
              <div className="relative w-full md:w-60">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#979799]" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="작업자, 내용 검색..."
                  className="steep-input w-full pl-10 text-xs py-2"
                />
              </div>

              <button
                onClick={handleExportAuditLogsToCsv}
                className="btn-steep-primary text-xs py-2 px-4 whitespace-nowrap cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                <span>엑셀(CSV) 다운로드</span>
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="steep-card-neutral overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f2f2f3] text-[#777b86] uppercase font-semibold border-b border-[#ececec]">
                  <tr>
                    <th className="py-3.5 px-5 w-44">발생 일시</th>
                    <th className="py-3.5 px-4 w-32">구분</th>
                    <th className="py-3.5 px-4 w-44">수행 사용자</th>
                    <th className="py-3.5 px-4 w-36">소속 부서</th>
                    <th className="py-3.5 px-5">활동 상세 내용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2f2f3]">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#777b86]">
                        활동 감사 기록을 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#777b86]">
                        해당 조건의 활동 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      return (
                        <tr key={log.id} className="hover:bg-[#fafafb] transition-colors">
                          <td className="py-3.5 px-5 text-[#777b86] whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('ko-KR')}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f2f2f3] text-[#17191c] border border-[#ececec]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-[#17191c]">{log.name}</span>{' '}
                            <span className="text-[#979799] text-[11px]">({log.username})</span>
                          </td>
                          <td className="py-3.5 px-4 text-[#777b86]">{log.department}</td>
                          <td className="py-3.5 px-5 text-[#17191c] font-medium leading-relaxed">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: Ban User Dialog (Replaces window.prompt)
         ======================================================== */}
      {banModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17191c]/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#ececec] max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#cf1322]">
                <UserX className="w-5 h-5" />
                <h3 className="font-steep-serif text-lg font-bold">직원 이용 차단(벤)</h3>
              </div>
              <button
                onClick={() => setBanModalTarget(null)}
                className="text-[#979799] hover:text-[#17191c] p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#777b86] leading-relaxed">
              <strong>{banModalTarget.name}</strong> ({banModalTarget.department}) 직원의 시스템 접근을 차단합니다.
              차단된 계정은 로그인할 수 없습니다.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#777b86] mb-1.5">
                차단 사유 입력
              </label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="차단 사유 (예: 퇴사, 규정 위반 등)"
                className="steep-input w-full text-xs"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setBanModalTarget(null)}
                className="btn-steep-subtle text-xs py-2 px-4 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmBan}
                className="px-4 py-2 bg-[#cf1322] hover:bg-[#a8071a] text-white text-xs font-semibold rounded-full cursor-pointer transition-colors"
              >
                차단(벤) 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: Unban User Dialog (Replaces window.confirm)
         ======================================================== */}
      {unbanModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17191c]/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#ececec] max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#17191c]">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-steep-serif text-lg font-bold">차단 해제 확인</h3>
              </div>
              <button
                onClick={() => setUnbanModalTarget(null)}
                className="text-[#979799] hover:text-[#17191c] p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#777b86] leading-relaxed">
              <strong>{unbanModalTarget.name}</strong> 직원의 차단을 해제하고 정상 승인 상태로 복원하시겠습니까?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setUnbanModalTarget(null)}
                className="btn-steep-subtle text-xs py-2 px-4 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmUnban}
                className="btn-steep-primary text-xs py-2 px-4 cursor-pointer"
              >
                차단 해제 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: Delete User Dialog (Replaces window.confirm)
         ======================================================== */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17191c]/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#ececec] max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#cf1322]">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-steep-serif text-lg font-bold">계정 영구 삭제</h3>
              </div>
              <button
                onClick={() => setDeleteModalTarget(null)}
                className="text-[#979799] hover:text-[#17191c] p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#777b86] leading-relaxed">
              <strong>{deleteModalTarget.name}</strong> ({deleteModalTarget.username}) 직원의 계정을 영구 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteModalTarget(null)}
                className="btn-steep-subtle text-xs py-2 px-4 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-[#cf1322] hover:bg-[#a8071a] text-white text-xs font-semibold rounded-full cursor-pointer transition-colors"
              >
                영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

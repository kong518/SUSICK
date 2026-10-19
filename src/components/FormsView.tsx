import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Plus,
  Trash2,
  Search,
  Building,
  Upload,
  X,
  AlertCircle,
  Flame,
  CheckCircle2,
  TrendingUp,
  Pencil,
  Printer,
} from 'lucide-react';
import { DocForm, User } from '../types';
import { api } from '../services/api';

interface FormsViewProps {
  currentUser: User | null;
}

export const FormsView: React.FC<FormsViewProps> = ({ currentUser }) => {
  const [forms, setForms] = useState<DocForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<'이용자 양식' | '활동지원사 양식' | '행정양식'>('이용자 양식');
  const [uploadDept, setUploadDept] = useState('전부서 공통');
  const [uploadDesc, setUploadDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<DocForm | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<'이용자 양식' | '활동지원사 양식' | '행정양식'>('이용자 양식');
  const [editDept, setEditDept] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModalForm, setDeleteModalForm] = useState<DocForm | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Print modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printForm, setPrintForm] = useState<DocForm | null>(null);

  const handleOpenPrint = (form: DocForm) => {
    setPrintForm(form);
    setIsPrintModalOpen(true);
  };

  const handleOpenEdit = (form: DocForm) => {
    if (!currentUser || (currentUser.role !== 'admin' && form.uploadedBy !== currentUser.id)) {
      showToast('해당 양식 수정 권한이 없습니다.', 'error');
      return;
    }
    setEditingForm(form);
    setEditTitle(form.title);
    setEditCategory(form.category as any);
    setEditDept(form.department);
    setEditDesc(form.description || '');
    setEditFile(null);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm) return;
    setEditError(null);

    if (!editTitle.trim()) {
      setEditError('양식 명칭을 입력해주세요.');
      return;
    }

    setIsEditing(true);
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('category', editCategory);
      formData.append('department', editDept);
      formData.append('description', editDesc);
      if (editFile) {
        formData.append('file', editFile);
      }

      const updated = await api.updateForm(editingForm.id, formData);
      setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setIsEditModalOpen(false);
      showToast(`[${updated.title}] 양식이 수정되었습니다.`, 'success');
    } catch (err: any) {
      setEditError(err.message || '수정 중 오류가 발생했습니다.');
    } finally {
      setIsEditing(false);
    }
  };

  const categories = ['전체', '실시간 TOP 4', '이용자 양식', '활동지원사 양식', '행정양식 및 회계서류'];

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadForms = async () => {
    try {
      setIsLoading(true);
      const data = await api.getForms();
      setForms(data);
    } catch (err) {
      console.error('Failed to load forms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const handleDownloadForm = (form: DocForm) => {
    const downloadUrl = api.getFormDownloadUrl(form.id, currentUser);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = form.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // optimistic download count increment
    setForms((prev) =>
      prev.map((f) => (f.id === form.id ? { ...f, downloadCount: (f.downloadCount || 0) + 1 } : f))
    );
    showToast(`[${form.title}] 서식이 다운로드되었습니다.`, 'success');
  };

  const handleDeleteForm = (form: DocForm) => {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('양식 삭제는 시스템관리자만 가능합니다.', 'error');
      return;
    }
    setDeleteModalForm(form);
  };

  const handleConfirmDeleteForm = async () => {
    if (!deleteModalForm || !currentUser) return;
    try {
      await api.deleteForm(deleteModalForm.id, currentUser.name);
      setForms((prev) => prev.filter((f) => f.id !== deleteModalForm.id));
      showToast(`[${deleteModalForm.title}] 양식을 안전하게 삭제하였습니다.`, 'success');
      setDeleteModalForm(null);
    } catch (err: any) {
      showToast(err.message || '삭제에 실패했습니다.', 'error');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!uploadTitle.trim()) {
      setUploadError('양식 명칭을 입력해주세요.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('category', uploadCategory);
      formData.append('department', uploadDept);
      formData.append('description', uploadDesc);
      formData.append('uploaderId', currentUser?.id || 'admin-master');
      formData.append('uploaderName', currentUser?.name || '시스템관리자');
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const created = await api.uploadForm(formData);
      setForms((prev) => [created, ...prev]);
      setIsUploadModalOpen(false);

      // Reset form
      setUploadTitle('');
      setUploadDesc('');
      setSelectedFile(null);
      showToast(`[${created.title}] 서식이 영구 등록되었습니다.`, 'success');
    } catch (err: any) {
      setUploadError(err.message || '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // Compute TOP 4 ranks (descending download count)
  const sortedByDownloads = [...forms].sort(
    (a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)
  );
  const top4List = sortedByDownloads.slice(0, 4);
  const top4RankMap = new Map<string, number>();
  top4List.forEach((f, idx) => {
    top4RankMap.set(f.id, idx + 1);
  });

  const filteredForms = forms.filter((f) => {
    let matchCategory = true;
    if (selectedCategory === '실시간 TOP 4') {
      matchCategory = top4RankMap.has(f.id);
    } else if (selectedCategory !== '전체') {
      matchCategory = f.category === selectedCategory;
    }

    const matchQuery =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center space-x-2 px-5 py-3 rounded-full text-xs font-semibold shadow-xl transition-all bg-[#17191c] text-white animate-fade-in">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#03c75a]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#ef4444]" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-[24px] bg-white border border-[#e5e7eb] p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#94a3b8] font-bold mb-1">
              Official Document Archive
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17191c] tracking-tight">
              수원시장애인종합복지관 표준 서식 보관함
            </h1>
            <p className="text-xs sm:text-sm text-[#64748b] mt-1.5 font-normal leading-relaxed">
              이용자 양식, 활동지원사 양식, 행정양식을 영구 무손실 보존 상태로 안전하게 다운로드하여 사용하세요.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-5 py-2.5 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs sm:text-sm font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>새 양식 등록</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 pt-5 border-t border-[#f1f5f9] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Category Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1 ${
                  selectedCategory === cat
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'bg-[#f8fafc] text-[#64748b] hover:text-[#17191c] hover:bg-[#f1f5f9] border border-[#e2e8f0]'
                }`}
              >
                {cat === '실시간 TOP 4' && <Flame className="w-3.5 h-3.5 text-[#03c75a]" />}
                <span>{cat}</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="양식명, 부서, 키워드 검색..."
              className="w-full pl-10 pr-4 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-full text-xs focus:outline-none focus:border-[#17191c]"
            />
          </div>
        </div>
      </div>

      {/* Forms Grid */}
      {isLoading ? (
        <div className="rounded-[24px] bg-white border border-[#e5e7eb] p-12 text-center text-[#64748b] shadow-xs">
          <FileText className="w-8 h-8 animate-pulse text-[#17191c] mx-auto mb-2" />
          <p className="text-sm font-medium">양식 목록을 불러오는 중입니다...</p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="rounded-[24px] bg-white border border-[#e5e7eb] p-12 text-center text-[#64748b] shadow-xs">
          <FileText className="w-10 h-10 text-[#94a3b8] mx-auto mb-2" />
          <p className="text-base font-bold text-[#17191c]">해당 조건의 양식이 없습니다.</p>
          <p className="text-xs text-[#64748b] mt-1">다른 검색어나 카테고리를 선택해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredForms.map((form) => {
            const topRank = top4RankMap.get(form.id);

            return (
              <div
                key={form.id}
                className="rounded-[20px] bg-white border border-[#e5e7eb] p-6 flex flex-col justify-between hover:border-[#17191c] hover:shadow-md transition-all group relative"
              >
                <div>
                  {/* Category & Format & Naver Top Rank Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] font-semibold text-[#64748b] bg-[#f1f5f9] px-2.5 py-0.5 rounded-md">
                        {form.category}
                      </span>

                      {/* Naver Real-Time Top Rank Badge */}
                      {topRank && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                            topRank === 1
                              ? 'bg-[#03c75a] text-white'
                              : topRank === 2
                              ? 'bg-[#17191c] text-white'
                              : topRank === 3
                              ? 'bg-[#475569] text-white'
                              : 'bg-[#94a3b8] text-white'
                          }`}
                        >
                          <Flame className="w-2.5 h-2.5" />
                          <span>실시간 {topRank}위</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span className="bg-white text-[#94a3b8] border border-[#e2e8f0] uppercase font-mono text-[10px] px-2 py-0.5 rounded-md">
                        .{form.fileExt}
                      </span>
                      {(currentUser?.role === 'admin' || form.uploadedBy === currentUser?.id) && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(form)}
                            title="양식 수정"
                            className="text-[#94a3b8] hover:text-[#03c75a] transition-colors p-1 rounded-full hover:bg-[#e6f4ea] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteForm(form)}
                            title="양식 삭제"
                            className="text-[#94a3b8] hover:text-[#ef4444] transition-colors p-1 rounded-full hover:bg-[#fee2e2] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    onClick={() => handleDownloadForm(form)}
                    className="font-bold text-base text-[#17191c] group-hover:text-[#03c75a] transition-colors line-clamp-2 cursor-pointer"
                  >
                    {form.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-[#64748b] mt-2 line-clamp-2 leading-relaxed">
                    {form.description || '수원시장애인종합복지관 공식 표준 문서 서식입니다.'}
                  </p>

                  {/* Meta details */}
                  <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#94a3b8]">
                    <span className="flex items-center space-x-1">
                      <Building className="w-3 h-3 text-[#94a3b8]" />
                      <span>{form.department}</span>
                    </span>
                    <span className="font-semibold text-[#1e293b]">다운로드 {form.downloadCount || 0}회</span>
                  </div>
                </div>

                {/* Card Footer: Print & Download Buttons */}
                <div className="mt-4 pt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenPrint(form)}
                    className="py-2.5 px-3 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#17191c] text-xs font-semibold cursor-pointer transition-all flex items-center justify-center space-x-1"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#03c75a]" />
                    <span>바로 인쇄</span>
                  </button>
                  <button
                    onClick={() => handleDownloadForm(form)}
                    className="py-2.5 px-3 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs font-semibold cursor-pointer transition-all flex items-center justify-center space-x-1 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>다운로드</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload New Form Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#e5e7eb] max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
              <div>
                <h2 className="text-lg font-bold text-[#17191c]">새 복지관 서식 등록</h2>
                <p className="text-xs text-[#64748b] mt-0.5">등록된 서식은 안전하게 영구 보존됩니다.</p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-[#94a3b8] hover:text-[#17191c] p-1.5 rounded-full hover:bg-[#e2e8f0] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                  서식 명칭 (제목) *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="예: 2026년도 프로그램 개별지원일지 서식"
                  className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                    구분 카테고리 *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c]"
                  >
                    <option value="이용자 양식">이용자 양식</option>
                    <option value="활동지원사 양식">활동지원사 양식</option>
                    <option value="행정양식 및 회계서류">행정양식 및 회계서류</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                    소관 부서
                  </label>
                  <input
                    type="text"
                    value={uploadDept}
                    onChange={(e) => setUploadDept(e.target.value)}
                    placeholder="예: 활동지원팀"
                    className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                  서식 설명 및 용도
                </label>
                <textarea
                  rows={3}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="서식의 작성 대상 및 관련 법정 지침, 제출 주기 등을 입력하세요."
                  className="w-full p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c] resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                  한글/문서 파일 첨부 (선택)
                </label>
                <div className="border-2 border-dashed border-[#e2e8f0] hover:border-[#17191c] rounded-2xl p-5 text-center transition-colors">
                  <input
                    type="file"
                    id="form-upload-file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label
                    htmlFor="form-upload-file"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <Upload className="w-6 h-6 text-[#94a3b8]" />
                    <span className="text-xs font-semibold text-[#17191c]">
                      {selectedFile ? selectedFile.name : 'HWP, HWPX, PDF, DOCX 파일 선택'}
                    </span>
                    <span className="text-[10px] text-[#94a3b8]">
                      미선택 시 복지관 표준 HWP 포맷으로 자동 생성 보관됩니다.
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#d1d5db] text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                >
                  {isUploading ? '업로드 중...' : '서식 영구 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#e5e7eb] max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
              <div>
                <h2 className="text-lg font-bold text-[#17191c]">복지관 서식 정보 수정</h2>
                <p className="text-xs text-[#64748b] mt-0.5">양식 명칭, 분류, 소관부서, 파일 등을 수정할 수 있습니다.</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:text-[#17191c] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                  양식 명칭 (제목) <span className="text-[#03c75a]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="예: 이용자 서비스 신청서 개정판"
                  className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                    구분 분류 <span className="text-[#03c75a]">*</span>
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c]"
                  >
                    <option value="이용자 양식">이용자 양식</option>
                    <option value="활동지원사 양식">활동지원사 양식</option>
                    <option value="행정양식 및 회계서류">행정양식 및 회계서류</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                    소관 부서
                  </label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    placeholder="예: 활동지원팀"
                    className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                  서식 설명 및 용도
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="서식의 작성 대상 및 관련 법정 지침, 제출 주기 등을 입력하세요."
                  className="w-full p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c] resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1.5">
                  새 한글/문서 파일 교체 첨부 (선택)
                </label>
                <div className="border-2 border-dashed border-[#e2e8f0] hover:border-[#17191c] rounded-2xl p-5 text-center transition-colors">
                  <input
                    type="file"
                    id="form-edit-file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label
                    htmlFor="form-edit-file"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <Upload className="w-6 h-6 text-[#94a3b8]" />
                    <span className="text-xs font-semibold text-[#17191c]">
                      {editFile ? editFile.name : `기존 파일: ${editingForm?.fileName || '선택된 파일 없음'}`}
                    </span>
                    <span className="text-[10px] text-[#94a3b8]">
                      새 파일로 교체하려면 클릭하여 파일을 선택하세요.
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#d1d5db] text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-5 py-2 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                >
                  {isEditing ? '수정 중...' : '수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Form Confirmation Modal */}
      {deleteModalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-sm w-full p-6 shadow-2xl border border-[#e5e7eb] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center font-bold">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#17191c]">서식 삭제 확인</h3>
              <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
                [{deleteModalForm.title}] 양식을 정말 삭제하시겠습니까? 삭제된 양식은 복구할 수 없습니다.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                onClick={() => setDeleteModalForm(null)}
                className="px-4 py-2 rounded-full border border-[#d1d5db] text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDeleteForm}
                className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview & Direct Print Modal */}
      {isPrintModalOpen && printForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] shadow-2xl border border-[#e5e7eb] max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc] print:hidden">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-[#03c75a]" />
                <h2 className="text-base font-bold text-[#17191c]">공식 문서 인쇄 미리보기 (한글·PDF 서식 출력)</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-full bg-[#03c75a] hover:bg-[#02b350] text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>인쇄하기 (PDF 저장)</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white border border-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:text-[#17191c] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Print Document Content Sheet (Styled exactly like an official HWP document) */}
            <div className="p-10 overflow-y-auto bg-gray-50 flex-1 flex justify-center">
              <div className="bg-white w-full max-w-2xl p-12 shadow-md border border-gray-200 text-[#17191c] font-serif space-y-8 print:shadow-none print:border-none print:p-0">
                
                {/* Institution Header */}
                <div className="text-center border-b-2 border-[#17191c] pb-6 space-y-2">
                  <h1 className="text-xl font-black tracking-widest uppercase">수원시장애인종합복지관</h1>
                  <p className="text-xs font-sans text-gray-600">SUWON COMMUNITY REHABILITATION CENTER</p>
                  <div className="text-sm font-bold pt-2 text-[#03c75a]">{printForm.category} · {printForm.department}</div>
                </div>

                {/* Document Title & Metadata Box */}
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-center border border-[#17191c] p-4 bg-gray-50 leading-snug">
                    {printForm.title}
                  </h2>

                  <div className="border border-gray-300 text-xs font-sans">
                    <div className="grid grid-cols-2 border-b border-gray-300">
                      <div className="p-2 border-r border-gray-300 bg-gray-50 font-semibold">문서번호: SW-FORM-2026-{printForm.id.substring(printForm.id.length - 4)}</div>
                      <div className="p-2 bg-gray-50 font-semibold">시행일자: {new Date(printForm.createdAt).toLocaleDateString('ko-KR')}</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="p-2 border-r border-gray-300 bg-gray-50 font-semibold">소관부서: {printForm.department}</div>
                      <div className="p-2 bg-gray-50 font-semibold">첨부파일: {printForm.fileName}</div>
                    </div>
                  </div>
                </div>

                {/* Main Content Body */}
                <div className="space-y-6 pt-2 font-sans text-xs leading-relaxed min-h-[200px] whitespace-pre-wrap">
                  <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-800">
                    <p className="font-bold mb-2">【 서식 개요 및 안내 】</p>
                    <p>{printForm.description || '본 문서는 수원시장애인종합복지관 공식 표준 문서 서식입니다. 규정에 따라 정확하게 작성하여 제출해 주시기 바랍니다.'}</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <p className="font-bold">1. 신청인(작성자) 인적사항</p>
                    <div className="grid grid-cols-2 gap-2 text-gray-700">
                      <div className="border p-2 rounded">성 명: ______________________</div>
                      <div className="border p-2 rounded">연락처: ______________________</div>
                      <div className="col-span-2 border p-2 rounded">주 소: ____________________________________________</div>
                    </div>

                    <p className="font-bold pt-2">2. 주요 내용 및 요청 사항</p>
                    <div className="border p-4 rounded min-h-[100px] text-gray-600">
                      [작성란]
                    </div>
                  </div>
                </div>

                {/* Official Signatures / Approval Table */}
                <div className="pt-8 flex justify-end">
                  <table className="border-collapse border border-gray-400 text-center text-xs font-sans w-64">
                    <tbody>
                      <tr>
                        <td className="border border-gray-400 bg-gray-50 p-1 font-semibold">담당</td>
                        <td className="border border-gray-400 bg-gray-50 p-1 font-semibold">팀장</td>
                        <td className="border border-gray-400 bg-gray-50 p-1 font-semibold">관장</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-400 h-16 align-bottom pb-1 text-gray-500">(서명)</td>
                        <td className="border border-gray-400 h-16 align-bottom pb-1 text-gray-500">(서명)</td>
                        <td className="border border-gray-400 h-16 align-bottom pb-1 font-bold text-[#03c75a]">직인생략</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

            <div className="p-4 border-t border-[#f1f5f9] bg-[#f8fafc] flex items-center justify-between print:hidden">
              <span className="text-[11px] text-[#64748b]">
                * 한글(HWP) 및 PDF 원본과 동일한 공식 서식 레이아웃으로 즉시 인쇄 또는 PDF로 저장하실 수 있습니다.
              </span>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-2 rounded-full border border-[#d1d5db] text-xs font-semibold text-[#64748b] hover:bg-white"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Pin,
  Plus,
  Eye,
  MessageCircle,
  Calendar,
  User as UserIcon,
  Search,
  X,
  Send,
  Trash2,
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  ThumbsUp,
  Tag,
  HelpCircle,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Post, User } from '../types';
import { api } from '../services/api';

interface BoardViewProps {
  currentUser: User | null;
  onOpenLogin?: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({ currentUser, onOpenLogin }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedStatus, setSelectedStatus] = useState('전체');

  // Selected post detail modal
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Write new post modal
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('기능 개선');
  const [newContent, setNewContent] = useState('');
  const [isNoticePin, setIsNoticePin] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Delete confirm modal state
  const [deleteModalPost, setDeleteModalPost] = useState<Post | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const categories = ['전체', '기능 개선', '신규 서식 요청', '시스템 개선', '오류·버그 제보', '사용 문의'];
  const statusList = ['전체', '접수완료', '검토중', '반영완료', '답변완료'];

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const data = await api.getPosts();
      setPosts(data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleOpenPostDetail = async (post: Post) => {
    try {
      const full = await api.getPost(post.id);
      setActivePost(full);
      // update view count in list
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, views: (p.views || 0) + 1 } : p))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleLikePost = async (post: Post, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.likePost(post.id, currentUser?.id);
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, likes: res.likes } : p))
      );
      if (activePost && activePost.id === post.id) {
        setActivePost({ ...activePost, likes: res.likes });
      }
      showToast(res.hasLiked ? '이 제안에 공감하였습니다! 👍' : '공감을 취소했습니다.', 'success');
    } catch (err: any) {
      showToast(err.message || '공감 처리에 실패했습니다.', 'error');
    }
  };

  const handleChangeStatus = async (postId: string, newStatus: string) => {
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('상태 변경은 시스템관리자만 가능합니다.', 'error');
      return;
    }
    try {
      const updated = await api.updatePostStatus(postId, newStatus, currentUser.name);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: newStatus as any } : p)));
      if (activePost && activePost.id === postId) {
        setActivePost({ ...activePost, status: newStatus as any });
      }
      showToast(`건의 상태를 [${newStatus}]로 변경하였습니다.`, 'success');
    } catch (err: any) {
      showToast(err.message || '상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePost || !newCommentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const comment = await api.addComment(activePost.id, {
        authorId: currentUser?.id || 'admin-master',
        authorName: currentUser?.name || '시스템관리자',
        department: currentUser?.department || '운영지원팀',
        content: newCommentText.trim(),
      });

      setActivePost({
        ...activePost,
        comments: [...(activePost.comments || []), comment],
      });
      setNewCommentText('');
      setPosts((prev) =>
        prev.map((p) =>
          p.id === activePost.id ? { ...p, comments: [...(p.comments || []), comment] } : p
        )
      );
      showToast('답변 및 코멘트가 등록되었습니다.', 'success');
    } catch (err: any) {
      showToast(err.message || '답변 등록에 실패했습니다.', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      if (onOpenLogin) onOpenLogin();
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) {
      showToast('제목과 내용을 모두 입력해주세요.', 'error');
      return;
    }

    setIsSubmittingPost(true);
    try {
      const post = await api.createPost({
        title: newTitle,
        category: newCategory,
        content: newContent,
        authorId: currentUser.id,
        authorName: currentUser.name,
        department: currentUser.department,
        isNotice: currentUser.role === 'admin' ? isNoticePin : false,
      });

      setPosts((prev) => [post, ...prev]);
      setIsWriteModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setIsNoticePin(false);
      showToast('프로그램 이용자 건의사항이 성공적으로 등록되었습니다.', 'success');
    } catch (err: any) {
      showToast(err.message || '등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleDeletePost = (post: Post, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const canDelete =
      currentUser && (currentUser.role === 'admin' || currentUser.id === post.authorId);
    if (!canDelete) {
      showToast('본인이 작성한 글이나 관리자만 삭제할 수 있습니다.', 'error');
      return;
    }
    setDeleteModalPost(post);
  };

  const handleConfirmDeletePost = async () => {
    if (!deleteModalPost || !currentUser) return;
    try {
      await api.deletePost(deleteModalPost.id, currentUser.id, currentUser.name);
      setPosts((prev) => prev.filter((p) => p.id !== deleteModalPost.id));
      if (activePost?.id === deleteModalPost.id) {
        setActivePost(null);
      }
      showToast('건의 게시글이 삭제되었습니다.', 'success');
      setDeleteModalPost(null);
    } catch (err: any) {
      showToast(err.message || '삭제에 실패했습니다.', 'error');
    }
  };

  const filteredPosts = posts.filter((p) => {
    const matchCategory = selectedCategory === '전체' || p.category === selectedCategory;
    const matchStatus = selectedStatus === '전체' || (p.status || '접수완료') === selectedStatus;
    const matchQuery =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchStatus && matchQuery;
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case '반영완료':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '검토중':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case '답변완료':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

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

      {/* Top Banner: Clearly State Purpose for Program/Portal Users */}
      <div className="rounded-[24px] bg-white border border-[#e5e7eb] p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs uppercase tracking-widest text-[#94a3b8] font-bold">
                Program User Voice
              </span>
              <span className="text-[11px] text-[#03c75a] bg-[#03c75a]/10 px-2.5 py-0.5 rounded-full font-bold">
                포털 이용자 전용
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17191c] tracking-tight">
              프로그램 이용자 건의사항
            </h1>
            <p className="text-[#64748b] text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              본 포털을 이용하시는 수원시장애인종합복지관 실무자 및 활동지원사 전용 소통 공간입니다. PDF 도구 기능 제안, 추가 희망 서식, 시스템 버그 및 개선 아이디어를 남겨주세요.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setIsWriteModalOpen(true)}
              className="px-5 py-2.5 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs sm:text-sm font-semibold flex items-center space-x-2 cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>새 건의사항 등록</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 pt-5 border-t border-[#f1f5f9] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'bg-[#f8fafc] text-[#64748b] hover:text-[#17191c] hover:bg-[#f1f5f9] border border-[#e2e8f0]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center space-x-2.5">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-full text-xs font-medium text-[#1e293b] focus:outline-none focus:border-[#17191c]"
            >
              {statusList.map((st) => (
                <option key={st} value={st}>
                  {st === '전체' ? '전체 진행상태' : st}
                </option>
              ))}
            </select>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="건의 제목, 작성자, 내용 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-full text-xs focus:outline-none focus:border-[#17191c]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Posts List Cards */}
      <div className="space-y-3.5">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-[#94a3b8]">
            건의사항 목록을 불러오는 중입니다...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-[24px] bg-white border border-[#e5e7eb] py-16 text-center p-6 shadow-xs">
            <MessageSquare className="w-10 h-10 mx-auto text-[#cbd5e1] mb-3" />
            <div className="font-bold text-base text-[#17191c]">등록된 건의사항이 없습니다.</div>
            <p className="text-xs text-[#64748b] mt-1 max-w-sm mx-auto">
              프로그램을 이용하면서 느낀 개선 의견이나 필요한 서식이 있다면 첫 건의를 남겨주세요.
            </p>
            <button
              onClick={() => setIsWriteModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-full bg-[#17191c] text-white text-xs font-semibold cursor-pointer"
            >
              건의글 작성하기
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => handleOpenPostDetail(post)}
              className={`rounded-[20px] bg-white border border-[#e5e7eb] p-5 sm:p-6 transition-all hover:border-[#17191c] hover:shadow-sm cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                post.isNotice ? 'border-l-4 border-l-[#17191c] bg-[#fafafb]' : ''
              }`}
            >
              {/* Left: Badges + Title + Content snippet */}
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  {post.isNotice && (
                    <span className="text-[11px] font-bold text-[#17191c] bg-[#f1f5f9] px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <Pin className="w-3 h-3" />
                      <span>중요 공지</span>
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-0.5 rounded-md">
                    {post.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                      post.status
                    )}`}
                  >
                    {post.status || '접수완료'}
                  </span>
                  <span className="text-xs text-[#94a3b8]">
                    {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-[#17191c] group-hover:text-[#03c75a] transition-colors truncate">
                  {post.title}
                </h3>

                <p className="text-xs text-[#64748b] line-clamp-1 leading-relaxed">
                  {post.content}
                </p>
              </div>

              {/* Right: Author + Likes + Comments + Delete */}
              <div className="flex items-center justify-between sm:justify-end space-x-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f1f5f9]">
                <div className="text-left sm:text-right">
                  <div className="text-xs font-bold text-[#1e293b]">{post.authorName}</div>
                  <div className="text-[11px] text-[#64748b]">{post.department}</div>
                </div>

                {/* Like Button */}
                <button
                  onClick={(e) => handleLikePost(post, e)}
                  title="공감해요"
                  className="px-2.5 py-1 rounded-full bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] text-xs font-semibold text-[#64748b] hover:text-[#17191c] flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{post.likes || 0}</span>
                </button>

                {/* Comments Count */}
                <div className="flex items-center space-x-1 text-xs text-[#64748b]">
                  <MessageCircle className="w-3.5 h-3.5 text-[#94a3b8]" />
                  <span>{post.comments?.length || 0}</span>
                </div>

                {/* Delete button (Author or Admin) */}
                {currentUser && (currentUser.role === 'admin' || currentUser.id === post.authorId) && (
                  <button
                    onClick={(e) => handleDeletePost(post, e)}
                    title="건의 삭제"
                    className="p-1.5 text-[#94a3b8] hover:text-[#ef4444] transition-colors rounded-full hover:bg-[#fee2e2] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Post Detail Modal */}
      {activePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#e5e7eb]">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#f1f5f9] flex items-start justify-between gap-4 bg-[#f8fafc]">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#64748b] bg-white border border-[#e2e8f0] px-2.5 py-0.5 rounded-md">
                    {activePost.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                      activePost.status
                    )}`}
                  >
                    {activePost.status || '접수완료'}
                  </span>
                  {activePost.isNotice && (
                    <span className="text-[11px] font-bold text-[#17191c] bg-white border border-[#e2e8f0] px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <Pin className="w-3 h-3" />
                      <span>중요 공지</span>
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#17191c]">{activePost.title}</h2>
                <div className="text-xs text-[#64748b] flex items-center space-x-3 pt-1">
                  <span className="font-semibold text-[#1e293b]">
                    {activePost.authorName} ({activePost.department})
                  </span>
                  <span>·</span>
                  <span>{new Date(activePost.createdAt).toLocaleString('ko-KR')}</span>
                  <span>·</span>
                  <span>조회 {activePost.views || 0}</span>
                </div>
              </div>

              <button
                onClick={() => setActivePost(null)}
                className="p-1.5 rounded-full text-[#94a3b8] hover:text-[#17191c] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Content text */}
              <div className="text-sm text-[#1e293b] leading-relaxed whitespace-pre-wrap bg-[#fafafb] p-5 rounded-2xl border border-[#f1f5f9]">
                {activePost.content}
              </div>

              {/* Admin Status Changer (Only visible to admin) */}
              {currentUser?.role === 'admin' && (
                <div className="p-4 rounded-xl bg-[#fbe1d1]/30 border border-[#fbe1d1] flex items-center justify-between">
                  <div className="text-xs text-[#5d2a1a]">
                    <span className="font-bold">관리자 상태 지정:</span> 접수된 건의의 진행 단계를 변경합니다.
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {(['접수완료', '검토중', '반영완료', '답변완료'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleChangeStatus(activePost.id, st)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                          activePost.status === st
                            ? 'bg-[#17191c] text-white shadow-xs'
                            : 'bg-white text-[#64748b] border border-[#d1d5db] hover:text-[#17191c]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Like / Upvote Action bar */}
              <div className="flex items-center justify-between pt-2 border-t border-[#f1f5f9]">
                <button
                  onClick={() => handleLikePost(activePost)}
                  className="px-4 py-2 rounded-full bg-[#f8fafc] hover:bg-[#03c75a]/10 hover:text-[#03c75a] border border-[#e2e8f0] text-xs font-bold text-[#1e293b] flex items-center space-x-2 transition-all cursor-pointer"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>공감해요 ({activePost.likes || 0})</span>
                </button>

                <div className="text-xs text-[#94a3b8]">
                  댓글 및 공식 답변 {activePost.comments?.length || 0}개
                </div>
              </div>

              {/* Comments / Admin Answers */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-[#17191c] uppercase tracking-wider">
                  답변 및 소통 내역
                </h4>

                {(!activePost.comments || activePost.comments.length === 0) ? (
                  <p className="text-xs text-[#94a3b8] py-4 text-center">
                    아직 등록된 답변이나 댓글이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {activePost.comments.map((c) => {
                      const isAdm = c.authorName === '시스템관리자' || c.department.includes('기획') || c.department.includes('관리');
                      return (
                        <div
                          key={c.id}
                          className={`p-4 rounded-2xl text-xs space-y-1.5 ${
                            isAdm
                              ? 'bg-[#f0fdf4] border border-[#bbf7d0]'
                              : 'bg-[#f8fafc] border border-[#e2e8f0]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-[#17191c]">{c.authorName}</span>
                              <span className="text-[#64748b] text-[10px]">· {c.department}</span>
                              {isAdm && (
                                <span className="bg-[#03c75a] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                  공식답변
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#94a3b8]">
                              {new Date(c.createdAt).toLocaleString('ko-KR')}
                            </span>
                          </div>
                          <p className="text-[#1e293b] leading-relaxed whitespace-pre-wrap">
                            {c.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comment Input Form */}
                <form onSubmit={handleAddComment} className="pt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="답변 또는 의견을 입력하세요..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-full text-xs focus:outline-none focus:border-[#17191c]"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !newCommentText.trim()}
                      className="px-4 py-2.5 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>작성</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Write New Suggestion Modal */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#e5e7eb] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
              <div>
                <h3 className="text-lg font-bold text-[#17191c]">프로그램 건의사항 등록</h3>
                <p className="text-xs text-[#64748b]">
                  스마트 문서지원 포털의 기능 개선, 양식 등록, 시스템 오류 제보를 작성합니다.
                </p>
              </div>
              <button
                onClick={() => setIsWriteModalOpen(false)}
                className="p-1 rounded-full text-[#94a3b8] hover:text-[#17191c] hover:bg-[#f1f5f9]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1">구분 카테고리</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['기능 개선', '신규 서식 요청', '시스템 개선', '오류·버그 제보', '사용 문의'] as const).map(
                    (cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setNewCategory(cat)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold text-center border cursor-pointer transition-all ${
                          newCategory === cat
                            ? 'bg-[#17191c] text-white border-[#17191c]'
                            : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1">건의 제목</label>
                <input
                  type="text"
                  placeholder="예: [PDF 병합] 첨부문서 상하 순서 변경 버튼 추가 요청"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17191c] mb-1">건의 내용</label>
                <textarea
                  rows={5}
                  placeholder="필요한 기능, 추가 희망 서식 명칭, 또는 발생한 오류 상황을 상세하게 작성해 주시면 개발 및 반영에 큰 도움이 됩니다."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:border-[#17191c] resize-none leading-relaxed"
                  required
                />
              </div>

              {currentUser?.role === 'admin' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="noticePin"
                    checked={isNoticePin}
                    onChange={(e) => setIsNoticePin(e.target.checked)}
                    className="rounded text-[#17191c] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="noticePin" className="text-xs text-[#1e293b] font-medium cursor-pointer">
                    상단 중요 공지글로 고정
                  </label>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#d1d5db] text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc] cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPost}
                  className="px-5 py-2 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                >
                  {isSubmittingPost ? '등록 중...' : '건의사항 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[24px] max-w-sm w-full p-6 shadow-2xl border border-[#e5e7eb] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center font-bold">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#17191c]">건의사항 삭제</h3>
              <p className="text-xs text-[#64748b] mt-1">
                [{deleteModalPost.title}] 건의글을 삭제하시겠습니까?
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                onClick={() => setDeleteModalPost(null)}
                className="px-4 py-2 rounded-full border border-[#d1d5db] text-xs font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDeletePost}
                className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateNickname,
  deleteWriting,
  signOut,
} from '../actions/archive'
import type { WritingItem, ArchiveProfile } from '../actions/archive'

type Props = {
  userId: string
  profile: ArchiveProfile
  writings: WritingItem[]
}

export default function ArchiveClient({ userId, profile, writings }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  // ── 닉네임 수정 ─────────────────────────────────────────────
  const [nickname, setNickname] = useState(profile.nickname)
  const [isEditingNick, setIsEditingNick] = useState(false)
  const [nickInput, setNickInput] = useState(profile.nickname)

  const handleNickSave = async () => {
    if (!nickInput.trim()) return
    setNickname(nickInput.trim())
    setIsEditingNick(false)
    await updateNickname(userId, nickInput.trim())
  }

  // ── 로그아웃 ─────────────────────────────────────────────────
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  // ── 삭제 ─────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<WritingItem | null>(null)
  const [localWritings, setLocalWritings] = useState<WritingItem[]>(writings)

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setLocalWritings((prev) => prev.filter((w) => w.id !== deleteTarget.id))
    setDeleteTarget(null)
    await deleteWriting(userId, deleteTarget.id)
  }

  // ── 검색 ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const showSearch = localWritings.length >= 10

  const filteredWritings = useMemo(() => {
    if (!searchQuery.trim()) return localWritings
    const q = searchQuery.toLowerCase()
    return localWritings.filter(
      (w) =>
        w.body.toLowerCase().includes(q) ||
        (w.topic_content ?? '').toLowerCase().includes(q)
    )
  }, [localWritings, searchQuery])

  const handleWritingTap = (writing: WritingItem) => {
    router.push(`/editor?writingId=${writing.id}&from=archive`)
  }

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      style={{
        maxWidth: '390px',
        margin: '0 auto',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {/* ── 프로필 섹션 ── */}
      <section className="px-5 pt-12 pb-6 border-b border-zinc-100">

        {/* 상단: 아바타 + 닉네임 + 로그아웃 */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="프로필" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                <span className="text-[14px] text-zinc-400">{nickname.charAt(0)}</span>
              </div>
            )}

            <div>
              {isEditingNick ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nickInput}
                    onChange={(e) => setNickInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNickSave() }}
                    className="text-[15px] font-medium text-zinc-900 border-b border-zinc-400 outline-none bg-transparent w-32"
                  />
                  <button onClick={handleNickSave} className="text-[12px] text-zinc-500 hover:text-zinc-900">확인</button>
                  <button onClick={() => { setIsEditingNick(false); setNickInput(nickname) }} className="text-[12px] text-zinc-400 hover:text-zinc-600">취소</button>
                </div>
              ) : (
                <button onClick={() => { setIsEditingNick(true); setNickInput(nickname) }} className="flex items-center gap-1.5 group">
                  <span className="text-[15px] font-medium text-zinc-900">{nickname}님</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-zinc-300 group-hover:text-zinc-500 transition-colors">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <button onClick={() => setShowLogoutModal(true)} className="text-[12px] text-zinc-400 hover:text-zinc-700 transition-colors pt-1">
            로그아웃
          </button>
        </div>

        {/* 통계 */}
        <p className="text-[13px] text-zinc-500 mb-1">
          총 {profile.totalCount}편 썼어요 · 이번 주 {profile.weekCount}편
        </p>
        {profile.lastWrittenDaysAgo !== null && (
          <p className="text-[12px] text-zinc-400">
            마지막으로 쓴 날: {profile.lastWrittenDaysAgo}일 전
          </p>
        )}
      </section>

      {/* ── 글 목록 ── */}
      <section className="flex-1 px-5 pt-5">

        {showSearch && (
          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색"
              className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 rounded-xl text-[14px] text-zinc-800 placeholder:text-zinc-300 outline-none border border-transparent focus:border-zinc-200 transition-colors"
            />
          </div>
        )}

        {localWritings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[14px] text-zinc-400 mb-4">아직 쓴 글이 없어요.</p>
            <button onClick={() => router.push('/')} className="text-[13px] text-zinc-500 hover:text-zinc-800 underline transition-colors">
              첫 글을 써볼까요?
            </button>
          </div>
        ) : filteredWritings.length === 0 ? (
          <p className="text-[13px] text-zinc-400 py-8 text-center">검색 결과가 없어요.</p>
        ) : (
          <ul className="divide-y divide-zinc-50">
            {filteredWritings.map((writing) => (
              <WritingRow
                key={writing.id}
                writing={writing}
                onTap={() => handleWritingTap(writing)}
                onDelete={() => setDeleteTarget(writing)}
              />
            ))}
          </ul>
        )}

        <div className="h-16" />
      </section>

      {/* 홈으로 가기 버튼 — 하단 고정 */}
      <div className="sticky bottom-0 bg-white border-t border-zinc-50 px-5 py-3 flex justify-center"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          홈으로
        </button>
      </div>

      {/* ── 로그아웃 모달 ── */}
      {showLogoutModal && (
        <Modal onClose={() => setShowLogoutModal(false)}>
          <p className="text-[15px] text-zinc-800 mb-1">로그아웃할까요?</p>
          <p className="text-[13px] text-zinc-400 mb-6">작성 중인 글은 자동으로 저장돼요.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 text-[14px] text-zinc-500 hover:bg-zinc-50 transition-colors">취소</button>
            <button onClick={handleLogout} className="flex-1 py-3 rounded-xl bg-zinc-900 text-white text-[14px] hover:bg-zinc-700 transition-colors">로그아웃</button>
          </div>
        </Modal>
      )}

      {/* ── 삭제 모달 ── */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          {deleteTarget.is_system ? (
            <>
              <p className="text-[15px] text-zinc-800 mb-1">처음 쓴 글이에요.</p>
              <p className="text-[13px] text-zinc-400 mb-6">지워도 괜찮아요.</p>
            </>
          ) : (
            <>
              <p className="text-[15px] text-zinc-800 mb-1">이 글을 삭제할까요?</p>
              <p className="text-[13px] text-zinc-400 mb-6">삭제한 글은 복구되지 않아요.</p>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl border border-zinc-200 text-[14px] text-zinc-500 hover:bg-zinc-50 transition-colors">
              {deleteTarget.is_system ? '남겨둘게요' : '취소'}
            </button>
            <button onClick={handleDeleteConfirm} className="flex-1 py-3 rounded-xl bg-zinc-900 text-white text-[14px] hover:bg-zinc-700 transition-colors">
              {deleteTarget.is_system ? '삭제할게요' : '삭제'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── 글 목록 아이템 ────────────────────────────────────────────
function WritingRow({
  writing,
  onTap,
  onDelete,
}: {
  writing: WritingItem
  onTap: () => void
  onDelete: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  // 제목: topic_content 우선 → 없으면 body 첫 줄
  const title = writing.topic_content?.trim() || writing.body.trim().split('\n').filter(Boolean)[0] || '제목 없음'

  // 미리보기: body 첫 2줄
  const bodyLines = writing.body.trim().split('\n').filter(Boolean)
  const preview = bodyLines.slice(0, 2).join(' ')

  const date = new Date(writing.created_at)
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`

  return (
    <li className="py-4 flex items-start justify-between gap-3">
      <button onClick={onTap} className="flex-1 text-left min-w-0">
        {/* 글감(제목) */}
        <p className="text-[13px] font-medium text-zinc-900 truncate mb-1">
          {title}
        </p>
        {/* 본문 미리보기 */}
        {preview && (
          <p className="text-[12px] text-zinc-400 line-clamp-2 leading-relaxed">
            {preview}
          </p>
        )}
      </button>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[11px] text-zinc-300">{dateStr}</span>
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="text-zinc-300 hover:text-zinc-500 transition-colors px-1 text-[12px]"
          >
            •••
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-lg border border-zinc-100 overflow-hidden min-w-[80px]">
                <button
                  onClick={() => { setShowMenu(false); onDelete() }}
                  className="w-full px-4 py-2.5 text-left text-[13px] text-red-400 hover:bg-zinc-50 transition-colors"
                >
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

// ── 모달 ─────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ maxWidth: '390px', margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl px-5 pt-6 pb-8 border-t border-zinc-100">
        {children}
      </div>
    </div>
  )
}

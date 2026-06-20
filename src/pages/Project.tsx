import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  UserPlus, RotateCcw, Users, Calendar, CheckSquare, Square,
  Settings, ChevronRight, ChevronDown, Filter, ArrowUpDown, X
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import PageCard from '@/components/PageCard'
import type { Page, PageStatus, Chapter, MemberRole } from '@/types'
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS } from '@/types'

const ALL_STATUSES: PageStatus[] = [
  'pending_translate', 'translating', 'pending_proofread',
  'proofreading', 'pending_typeset', 'typesetting', 'completed',
]

const PENDING_ROLE_MAP: Record<string, MemberRole> = {
  pending_translate: 'translator',
  pending_proofread: 'proofreader',
  pending_typeset: 'typesetter',
}

const ROLE_COLORS: Record<MemberRole, string> = {
  translator: '#0f3460',
  proofreader: '#16c79a',
  typesetter: '#f5a623',
  leader: '#e94560',
}

type DispatchRole = 'translator' | 'proofreader' | 'typesetter'
const ROLE_ORDER: DispatchRole[] = ['translator', 'proofreader', 'typesetter']

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const getProject = useStore((s) => s.getProject)
  const members = useStore((s) => s.members)
  const currentUserId = useStore((s) => s.currentUserId)
  const getMember = useStore((s) => s.getMember)
  const batchAssign = useStore((s) => s.batchAssign)
  const batchAssignByRole = useStore((s) => s.batchAssignByRole)
  const resetStalePages = useStore((s) => s.resetStalePages)
  const taskLogs = useStore((s) => s.taskLogs)
  const project = projectId ? getProject(projectId) : undefined
  const currentUser = getMember(currentUserId)
  const isLeader = currentUser?.role === 'leader'

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<PageStatus | 'all'>('all')
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'pageNumber' | 'updatedAt'>('pageNumber')
  const [dispatchMode, setDispatchMode] = useState(false)
  const [dispatchTab, setDispatchTab] = useState<'manual' | 'role'>('manual')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assignMemberId, setAssignMemberId] = useState('')
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  const [roleAssignments, setRoleAssignments] = useState<Record<DispatchRole, { memberId: string; chapters: Set<string> }>>({
    translator: { memberId: '', chapters: new Set() },
    proofreader: { memberId: '', chapters: new Set() },
    typesetter: { memberId: '', chapters: new Set() },
  })

  useEffect(() => {
    const s = searchParams.get('status')
    if (s && ALL_STATUSES.includes(s as PageStatus)) setStatusFilter(s as PageStatus)
    const m = searchParams.get('member')
    if (m) setMemberFilter(m)
    const h = searchParams.get('highlight')
    if (h) {
      const ids = new Set(h.split(',').filter(Boolean))
      setHighlightedIds(ids)
      setTimeout(() => setHighlightedIds(new Set()), 5000)
    }
  }, [])

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  const toggleSelect = (pageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  const toggleRoleChapter = (role: DispatchRole, chapterId: string) => {
    setRoleAssignments((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        chapters: (() => {
          const next = new Set(prev[role].chapters)
          if (next.has(chapterId)) next.delete(chapterId)
          else next.add(chapterId)
          return next
        })(),
      },
    }))
  }

  const pages = useMemo(() => {
    if (!project) return []
    let result = selectedChapterId
      ? project.chapters.find((c) => c.id === selectedChapterId)?.pages ?? []
      : project.chapters.flatMap((c) => c.pages)
    if (statusFilter !== 'all') result = result.filter((p) => p.status === statusFilter)
    if (memberFilter !== 'all') result = result.filter((p) => p.assigneeId === memberFilter)
    return [...result].sort((a, b) =>
      sortBy === 'pageNumber' ? a.pageNumber - b.pageNumber : b.updatedAt.localeCompare(a.updatedAt)
    )
  }, [project, selectedChapterId, statusFilter, memberFilter, sortBy])

  const leaderAssignedMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const log of taskLogs) {
      if (log.action === 'assign_by_leader') map.set(log.pageId, true)
    }
    return map
  }, [taskLogs])

  const eligibleRoles = useMemo(() => {
    const roles = new Set<MemberRole>()
    for (const id of selectedIds) {
      const page = pages.find((p) => p.id === id)
      if (page && PENDING_ROLE_MAP[page.status]) roles.add(PENDING_ROLE_MAP[page.status])
    }
    return roles
  }, [selectedIds, pages])

  const eligibleMembers = useMemo(() => {
    if (eligibleRoles.size === 0) return []
    return members.filter((m) => eligibleRoles.has(m.role))
  }, [eligibleRoles, members])

  const rolePendingCounts = useMemo(() => {
    if (!project) return { translator: 0, proofreader: 0, typesetter: 0 }
    const allPages = project.chapters.flatMap((c) => c.pages)
    return {
      translator: allPages.filter((p) => p.status === 'pending_translate' && !p.assigneeId).length,
      proofreader: allPages.filter((p) => p.status === 'pending_proofread' && !p.assigneeId).length,
      typesetter: allPages.filter((p) => p.status === 'pending_typeset' && !p.assigneeId).length,
    }
  }, [project])

  const totalProgress = useMemo(() => {
    if (!project) return { completed: 0, total: 0 }
    const all = project.chapters.flatMap((c) => c.pages)
    return { completed: all.filter((p) => p.status === 'completed').length, total: all.length }
  }, [project])

  const chapterProgress = (chapter: Chapter) => ({
    done: chapter.pages.filter((p) => p.status === 'completed').length,
    total: chapter.pages.length,
  })

  const selectAll = () => setSelectedIds(new Set(pages.map((p) => p.id)))

  const exitDispatch = () => {
    setDispatchMode(false)
    setSelectedIds(new Set())
    setAssignMemberId('')
    setRoleAssignments({
      translator: { memberId: '', chapters: new Set() },
      proofreader: { memberId: '', chapters: new Set() },
      typesetter: { memberId: '', chapters: new Set() },
    } as Record<DispatchRole, { memberId: string; chapters: Set<string> }>)
  }

  const handleBatchAssign = () => {
    if (!assignMemberId) return
    batchAssign(Array.from(selectedIds), assignMemberId)
    setSelectedIds(new Set())
    setAssignMemberId('')
  }

  const handleReset = () => {
    resetStalePages(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleRoleAssignByChapters = (role: DispatchRole) => {
    if (!project || !roleAssignments[role].memberId) return
    const chapterIds = Array.from(roleAssignments[role].chapters)
    if (chapterIds.length === 0) return
    batchAssignByRole(project.id, role, roleAssignments[role].memberId, chapterIds)
    setRoleAssignments((prev) => ({ ...prev, [role]: { memberId: '', chapters: new Set() } } as Record<DispatchRole, { memberId: string; chapters: Set<string> }>))
  }

  const handleRoleAssignByFilter = (role: DispatchRole) => {
    if (!project || !roleAssignments[role].memberId) return
    const filteredPageIds = pages
      .filter((p) => PENDING_ROLE_MAP[p.status] === role && !p.assigneeId)
      .map((p) => p.id)
    if (filteredPageIds.length === 0) return
    batchAssign(filteredPageIds, roleAssignments[role].memberId)
    setRoleAssignments((prev) => ({ ...prev, [role]: { ...prev[role], memberId: '' } } as Record<DispatchRole, { memberId: string; chapters: Set<string> }>))
  }

  if (!project) return <div className="flex items-center justify-center h-full text-txt-muted">项目不存在</div>

  return (
    <div className="flex h-full">
      <aside className="w-64 bg-dark-secondary border-r border-border-dark flex flex-col shrink-0">
        <div className="p-4 border-b border-border-dark">
          <h2 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">章节导航</h2>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          <button
            onClick={() => setSelectedChapterId(null)}
            className={`w-full text-left px-4 py-2 text-sm text-txt-secondary hover:bg-dark-hover transition-colors ${
              selectedChapterId === null ? 'border-l-2 border-accent-red text-txt-primary' : 'border-l-2 border-transparent'
            }`}
          >
            全部章节
          </button>
          {project.chapters.map((chapter) => {
            const expanded = expandedChapters.has(chapter.id)
            const prog = chapterProgress(chapter)
            const active = selectedChapterId === chapter.id
            return (
              <div key={chapter.id}>
                <button
                  onClick={() => { toggleChapter(chapter.id); setSelectedChapterId(chapter.id) }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-dark-hover transition-colors ${
                    active ? 'border-l-2 border-accent-red text-txt-primary' : 'border-l-2 border-transparent text-txt-secondary'
                  }`}
                >
                  {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="truncate flex-1">{chapter.name}</span>
                  <span className="text-xs text-txt-muted shrink-0">{prog.done}/{prog.total} 已完成</span>
                </button>
                {expanded && (
                  <div className="bg-dark-primary/40 py-1">
                    {chapter.pages.map((page) => (
                      <div key={page.id} className="pl-10 pr-4 py-1 text-xs text-txt-muted hover:text-txt-secondary transition-colors">
                        P.{page.pageNumber}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-5 border-b border-border-dark bg-dark-secondary/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-txt-primary">{project.name}</h1>
              <div className="mt-1 flex items-center gap-4 text-sm text-txt-secondary">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />截止日期：{project.deadline}</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />总进度：{totalProgress.completed}/{totalProgress.total} 已完成</span>
              </div>
            </div>
            <div className="w-40">
              <div className="flex justify-between text-xs text-txt-muted mb-1">
                <span>进度</span>
                <span>{totalProgress.total ? Math.round((totalProgress.completed / totalProgress.total) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-dark-primary rounded-full overflow-hidden">
                <div className="h-full bg-accent-green rounded-full transition-all" style={{ width: totalProgress.total ? `${(totalProgress.completed / totalProgress.total) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 py-3 border-b border-border-dark flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-txt-muted" />
            <span className="text-xs text-txt-muted mr-1">状态</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-accent-red text-white' : 'bg-dark-card text-txt-secondary hover:bg-dark-hover'
              }`}
            >
              全部
            </button>
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium text-white transition-opacity ${
                  statusFilter === s ? 'opacity-100 ring-2 ring-white/30' : 'opacity-60 hover:opacity-80'
                }`}
                style={{ backgroundColor: STATUS_COLORS[s] }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-border-dark" />
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="bg-dark-card text-txt-secondary text-xs rounded-lg px-3 py-1.5 border border-border-dark focus:outline-none focus:border-accent-red"
          >
            <option value="all">全部成员</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <div className="h-5 w-px bg-border-dark" />
          <button
            onClick={() => setSortBy(sortBy === 'pageNumber' ? 'updatedAt' : 'pageNumber')}
            className="flex items-center gap-1.5 text-xs text-txt-secondary hover:text-txt-primary transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortBy === 'pageNumber' ? '页码' : '更新时间'}
          </button>
          {isLeader && (
            <>
              <div className="h-5 w-px bg-border-dark" />
              <button
                onClick={() => { dispatchMode ? exitDispatch() : setDispatchMode(true) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  dispatchMode ? 'bg-accent-red text-white' : 'bg-dark-card text-txt-secondary hover:bg-dark-hover'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                {dispatchMode ? '退出调度' : '批量调度'}
              </button>
            </>
          )}
        </div>

        {dispatchMode && isLeader && (
          <div className="border-b border-border-dark bg-dark-secondary/80">
            <div className="flex border-b border-border-dark">
              <button
                onClick={() => setDispatchTab('manual')}
                className={`px-6 py-2.5 text-sm font-medium transition-colors ${
                  dispatchTab === 'manual' ? 'text-accent-red border-b-2 border-accent-red bg-dark-primary/50' : 'text-txt-secondary hover:text-txt-primary'
                }`}
              >
                手动勾选派单
              </button>
              <button
                onClick={() => setDispatchTab('role')}
                className={`px-6 py-2.5 text-sm font-medium transition-colors ${
                  dispatchTab === 'role' ? 'text-accent-red border-b-2 border-accent-red bg-dark-primary/50' : 'text-txt-secondary hover:text-txt-primary'
                }`}
              >
                按角色排班
              </button>
              <button onClick={exitDispatch} className="ml-auto p-2.5 text-txt-muted hover:text-txt-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {dispatchTab === 'manual' ? (
              <div className="px-6 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-txt-secondary font-medium">已选 {selectedIds.size} 页</span>
                <div className="h-5 w-px bg-border-dark" />
                <select
                  value={assignMemberId}
                  onChange={(e) => setAssignMemberId(e.target.value)}
                  className="bg-dark-card text-txt-secondary text-xs rounded-lg px-3 py-1.5 border border-border-dark focus:outline-none focus:border-accent-red"
                >
                  <option value="">选择成员分配</option>
                  {eligibleMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <button
                  onClick={handleBatchAssign}
                  disabled={!assignMemberId || selectedIds.size === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent-green text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  <UserPlus className="w-3.5 h-3.5" />批量分配
                </button>
                <button
                  onClick={handleReset}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-dark-card text-txt-secondary hover:bg-dark-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />重置为待领取
                </button>
                <button
                  onClick={selectAll}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-dark-card text-txt-secondary hover:bg-dark-hover transition-colors"
                >
                  全选当前筛选
                </button>
              </div>
            ) : (
              <div className="px-6 py-4">
                <div className="grid grid-cols-3 gap-4">
                  {ROLE_ORDER.map((role) => {
                    const roleMembers = members.filter((m) => m.role === role)
                    const assignment = roleAssignments[role]
                    return (
                      <div key={role} className="bg-dark-primary rounded-lg p-4 border border-border-dark">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ROLE_COLORS[role] }} />
                            <span className="text-sm font-semibold text-txt-primary">{ROLE_LABELS[role]}</span>
                          </div>
                          <span className="text-xs text-txt-muted bg-dark-card px-2 py-0.5 rounded-full">待派 {rolePendingCounts[role]}</span>
                        </div>
                        <select
                          value={assignment.memberId}
                          onChange={(e) => setRoleAssignments((prev) => ({ ...prev, [role]: { ...prev[role], memberId: e.target.value } }))}
                          className="w-full bg-dark-card text-txt-secondary text-xs rounded-lg px-3 py-2 border border-border-dark focus:outline-none focus:border-accent-red mb-3"
                        >
                          <option value="">选择{ROLE_LABELS[role]}成员</option>
                          {roleMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <div className="mb-3">
                          <div className="text-xs text-txt-muted mb-1.5">按章节批量</div>
                          <div className="max-h-32 overflow-y-auto space-y-1 bg-dark-card rounded-lg p-2">
                            {project.chapters.map((chapter) => (
                              <label key={chapter.id} className="flex items-center gap-2 text-xs text-txt-secondary hover:text-txt-primary cursor-pointer py-1">
                                <input
                                  type="checkbox"
                                  checked={assignment.chapters.has(chapter.id)}
                                  onChange={() => toggleRoleChapter(role, chapter.id)}
                                  className="rounded border-border-dark bg-dark-primary text-accent-red focus:ring-accent-red"
                                />
                                <span className="truncate">{chapter.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => handleRoleAssignByChapters(role)}
                            disabled={!assignment.memberId || assignment.chapters.size === 0}
                            className="w-full text-xs px-3 py-2 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                            style={{ backgroundColor: ROLE_COLORS[role] }}
                          >
                            指派选中章节
                          </button>
                          <button
                            onClick={() => handleRoleAssignByFilter(role)}
                            disabled={!assignment.memberId}
                            className="w-full text-xs px-3 py-2 rounded-lg bg-dark-card text-txt-secondary hover:bg-dark-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            按当前筛选批量
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {pages.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-txt-muted">没有匹配的页面</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {pages.map((page) => {
                const leaderAssigned = leaderAssignedMap.get(page.id) ?? false
                const showCheckbox = dispatchMode && dispatchTab === 'manual'
                if (showCheckbox) {
                  return (
                    <div
                      key={page.id}
                      className={`relative cursor-pointer rounded-xl ${selectedIds.has(page.id) ? 'ring-2 ring-accent-red' : ''} ${highlightedIds.has(page.id) ? 'ring-2 ring-yellow-400 animate-pulse rounded-xl' : ''}`}
                      onClick={() => toggleSelect(page.id)}
                    >
                      <div className="absolute top-2 right-2 z-20">
                        {selectedIds.has(page.id) ? (
                          <CheckSquare className="w-5 h-5 text-accent-red drop-shadow-lg" />
                        ) : (
                          <Square className="w-5 h-5 text-white/70 drop-shadow-lg" />
                        )}
                      </div>
                      <div className="absolute inset-0 z-10 rounded-xl" />
                      <PageCard page={page} projectId={project.id} viewerRole={currentUser?.role} leaderAssigned={leaderAssigned} />
                    </div>
                  )
                }
                return <div key={page.id} className={highlightedIds.has(page.id) ? 'ring-2 ring-yellow-400 animate-pulse rounded-xl' : ''}><PageCard page={page} projectId={project.id} viewerRole={currentUser?.role} leaderAssigned={leaderAssigned} /></div>
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

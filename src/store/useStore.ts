import { create } from 'zustand'
import type { Project, Member, TaskLog, Page, Dialogue, ProofreadComment, PageStatus, MemberRole, TaskAction } from '@/types'
import { MOCK_PROJECTS, MOCK_MEMBERS, MOCK_TASK_LOGS } from '@/data/mockData'
import { STATUS_LABELS, ROLE_LABELS } from '@/types'

interface AppState {
  projects: Project[]
  members: Member[]
  taskLogs: TaskLog[]
  currentUserId: string

  getProject: (id: string) => Project | undefined
  getMember: (id: string) => Member | undefined
  getAllPages: (projectId: string) => Page[]
  getPage: (projectId: string, pageId: string) => { page: Page; chapterId: string } | undefined
  getTaskLogsForPage: (pageId: string) => TaskLog[]

  claimTask: (pageId: string, memberId: string) => boolean
  releaseTask: (pageId: string, memberId: string) => void
  submitTranslation: (pageId: string, dialogues: Dialogue[]) => void
  approveProofread: (pageId: string) => void
  rejectProofread: (pageId: string, comments: ProofreadComment[]) => void
  submitTypeset: (pageId: string, typesetImage: string) => void
  updateDialogue: (pageId: string, dialogueId: string, text: string, isOnomatopoeia: boolean) => void
  addDialogue: (pageId: string) => void
  removeDialogue: (pageId: string, dialogueId: string) => void
  addProofreadComment: (pageId: string, comment: Omit<ProofreadComment, 'id' | 'createdAt'>) => void
  removeProofreadComment: (pageId: string, commentId: string) => void
  confirmComplete: (pageId: string) => void
  batchAssign: (pageIds: string[], memberId: string) => number
  batchAssignByRole: (projectId: string, role: MemberRole, memberId: string, chapterIds?: string[]) => number
  resetStalePages: (pageIds: string[]) => number
  leaderAssign: (pageId: string, memberId: string) => boolean
  leaderReclaim: (pageId: string) => boolean
  leaderSendBack: (pageId: string) => boolean
  leaderChangeAssignee: (pageId: string, memberId: string) => boolean
  reuploadTypeset: (pageId: string, typesetImage: string) => void

  getPagesByStatus: (projectId: string, status: PageStatus) => Page[]
  getPagesByAssignee: (projectId: string, memberId: string) => Page[]
  getOverduePages: (projectId?: string) => Page[]
  getOverduePagesDetailed: (projectId?: string) => { page: Page; projectId: string; chapterName: string; isAssigned: boolean }[]
  getStuckPagesForReminder: (projectId?: string) => {
    assignedOverdue: { page: Page; projectId: string; chapterName: string }[]
    unclaimedForLong: { page: Page; projectId: string; chapterName: string; daysUnclaimed: number }[]
    rejectedNotResumed: { page: Page; projectId: string; chapterName: string; daysSinceRejection: number }[]
  }
  getBottleneckStats: (projectId: string) => { translate: number; proofread: number; typeset: number }
  getMemberTaskCount: (memberId: string) => { active: number; completed: number }
  getRetrospectiveStats: (projectId?: string, chapterId?: string) => {
    stageDurations: { stage: string; avgHours: number; count: number }[]
    memberBacklog: { memberId: string; name: string; role: string; activeCount: number; pageIds: string[]; statusPageIds: Record<string, string[]> }[]
    repeatedRejections: { pageId: string; pageNumber: number; chapterName: string; projectId: string; rejectionCount: number }[]
  }
  getFilteredLogs: (filters: { memberId?: string; action?: TaskAction; projectId?: string; stage?: string }) => TaskLog[]
  getStageStatuses: (stage: string) => PageStatus[]
  exportRetrospectiveCSV: (projectId?: string, chapterId?: string) => string

  setCurrentUser: (id: string) => void
  switchRole: (memberId: string, role: MemberRole) => void
}

const STORAGE_KEY = 'hanhua-kanban-data'

function loadFromStorage(): { projects: Project[]; members: Member[]; taskLogs: TaskLog[] } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return null
}

function saveToStorage(state: { projects: Project[]; members: Member[]; taskLogs: TaskLog[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

function findPageInProjects(projects: Project[], pageId: string): { page: Page; chapterId: string; projectIndex: number; chapterIndex: number; pageIndex: number } | undefined {
  for (let pi = 0; pi < projects.length; pi++) {
    const project = projects[pi]
    for (let ci = 0; ci < project.chapters.length; ci++) {
      const chapter = project.chapters[ci]
      for (let pgi = 0; pgi < chapter.pages.length; pgi++) {
        if (chapter.pages[pgi].id === pageId) {
          return { page: chapter.pages[pgi], chapterId: chapter.id, projectIndex: pi, chapterIndex: ci, pageIndex: pgi }
        }
      }
    }
  }
  return undefined
}

function updatePage(projects: Project[], pageId: string, updater: (page: Page) => Page): Project[] {
  return projects.map(project => ({
    ...project,
    chapters: project.chapters.map(chapter => ({
      ...chapter,
      pages: chapter.pages.map(page => page.id === pageId ? updater(page) : page),
    })),
  }))
}

const STORAGE_VERSION = 'v3'
const stored = loadFromStorage()
const storedVersion = localStorage.getItem(STORAGE_KEY + '_version')
const needsReset = storedVersion !== STORAGE_VERSION
const initialProjects = (stored && !needsReset) ? stored.projects : MOCK_PROJECTS
const initialMembers = (stored && !needsReset) ? stored.members : MOCK_MEMBERS
const initialTaskLogs = (stored && !needsReset) ? stored.taskLogs : MOCK_TASK_LOGS
if (needsReset) {
  localStorage.setItem(STORAGE_KEY + '_version', STORAGE_VERSION)
}

function makeLog(pageId: string, chapterId: string, projectId: string, memberId: string, action: TaskLog['action'], detail?: string): TaskLog {
  return {
    id: generateId(),
    pageId,
    chapterId,
    projectId,
    memberId,
    action,
    detail,
    timestamp: new Date().toISOString(),
  }
}

export const useStore = create<AppState>((set, get) => ({
  projects: initialProjects,
  members: initialMembers,
  taskLogs: initialTaskLogs,
  currentUserId: 'm1',

  getProject: (id) => get().projects.find(p => p.id === id),

  getMember: (id) => get().members.find(m => m.id === id),

  getAllPages: (projectId) => {
    const project = get().projects.find(p => p.id === projectId)
    if (!project) return []
    return project.chapters.flatMap(ch => ch.pages)
  },

  getPage: (projectId, pageId) => {
    const project = get().projects.find(p => p.id === projectId)
    if (!project) return undefined
    for (const ch of project.chapters) {
      const page = ch.pages.find(p => p.id === pageId)
      if (page) return { page, chapterId: ch.id }
    }
    return undefined
  },

  getTaskLogsForPage: (pageId) => {
    return get().taskLogs.filter(l => l.pageId === pageId).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  },

  claimTask: (pageId, memberId) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return false
    if (found.page.assigneeId && found.page.assigneeId !== memberId) return false

    const member = get().members.find(m => m.id === memberId)
    if (!member) return false

    const role = member.role
    const page = found.page
    if (role === 'translator' && page.status !== 'pending_translate') return false
    if (role === 'proofreader' && page.status !== 'pending_proofread') return false
    if (role === 'typesetter' && page.status !== 'pending_typeset') return false

    let newStatus: PageStatus = page.status
    if (role === 'translator') newStatus = 'translating'
    if (role === 'proofreader') newStatus = 'proofreading'
    if (role === 'typesetter') newStatus = 'typesetting'

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, memberId, 'claimed')

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: newStatus,
      assigneeId: memberId,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
    return true
  },

  releaseTask: (pageId, memberId) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return
    if (found.page.assigneeId !== memberId) return

    const page = found.page
    let newStatus: PageStatus = page.status
    if (page.status === 'translating') newStatus = 'pending_translate'
    if (page.status === 'proofreading') newStatus = 'pending_proofread'
    if (page.status === 'typesetting') newStatus = 'pending_typeset'

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, memberId, 'released')

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: newStatus,
      assigneeId: null,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
  },

  submitTranslation: (pageId, dialogues) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, found.page.assigneeId ?? '', 'submitted', `${dialogues.filter(d => d.text).length} 条台词`)

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: 'pending_proofread' as PageStatus,
      assigneeId: null,
      dialogues: dialogues.map(d => ({ ...d, status: 'submitted' as const })),
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
  },

  approveProofread: (pageId) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, found.page.assigneeId ?? '', 'approved')

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: 'pending_typeset' as PageStatus,
      assigneeId: null,
      dialogues: p.dialogues.map(d => ({ ...d, status: 'approved' as const })),
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
  },

  rejectProofread: (pageId, comments) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, found.page.assigneeId ?? '', 'rejected', `${comments.length} 条批注`)

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: 'translating' as PageStatus,
      dialogues: p.dialogues.map(d => ({ ...d, status: 'rejected' as const })),
      proofreadComments: comments,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
  },

  submitTypeset: (pageId, typesetImage) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, found.page.assigneeId ?? '', 'typeset_uploaded')

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: 'completed' as PageStatus,
      assigneeId: null,
      typesetImage,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
  },

  updateDialogue: (pageId, dialogueId, text, isOnomatopoeia) => {
    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      dialogues: p.dialogues.map(d => d.id === dialogueId ? { ...d, text, isOnomatopoeia } : d),
      updatedAt: new Date().toISOString().split('T')[0],
    }))
    saveToStorage({ projects: newProjects, members: get().members, taskLogs: get().taskLogs })
    set({ projects: newProjects })
  },

  addDialogue: (pageId) => {
    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      dialogues: [
        ...p.dialogues,
        { id: generateId(), index: p.dialogues.length + 1, text: '', isOnomatopoeia: false, status: 'draft' as const },
      ],
      updatedAt: new Date().toISOString().split('T')[0],
    }))
    saveToStorage({ projects: newProjects, members: get().members, taskLogs: get().taskLogs })
    set({ projects: newProjects })
  },

  removeDialogue: (pageId, dialogueId) => {
    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      dialogues: p.dialogues.filter(d => d.id !== dialogueId).map((d, i) => ({ ...d, index: i + 1 })),
      updatedAt: new Date().toISOString().split('T')[0],
    }))
    saveToStorage({ projects: newProjects, members: get().members, taskLogs: get().taskLogs })
    set({ projects: newProjects })
  },

  addProofreadComment: (pageId, comment) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return

    const newComment: ProofreadComment = {
      ...comment,
      id: generateId(),
      createdAt: new Date().toISOString().split('T')[0],
    }
    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      proofreadComments: [...p.proofreadComments, newComment],
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'comment_added', comment.content)

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
  },

  removeProofreadComment: (pageId, commentId) => {
    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      proofreadComments: p.proofreadComments.filter(c => c.id !== commentId),
      updatedAt: new Date().toISOString().split('T')[0],
    }))
    saveToStorage({ projects: newProjects, members: get().members, taskLogs: get().taskLogs })
    set({ projects: newProjects })
  },

  confirmComplete: (pageId) => {
    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: 'completed' as PageStatus,
      assigneeId: null,
      updatedAt: new Date().toISOString().split('T')[0],
    }))
    saveToStorage({ projects: newProjects, members: get().members, taskLogs: get().taskLogs })
    set({ projects: newProjects })
  },

  batchAssign: (pageIds, memberId) => {
    const member = get().members.find(m => m.id === memberId)
    if (!member) return 0

    let count = 0
    const newLogs: TaskLog[] = []
    let newProjects = get().projects

    for (const pageId of pageIds) {
      const found = findPageInProjects(newProjects, pageId)
      if (!found) continue
      const page = found.page
      if (page.assigneeId) continue

      let newStatus: PageStatus = page.status
      if (member.role === 'translator' && page.status === 'pending_translate') newStatus = 'translating'
      else if (member.role === 'proofreader' && page.status === 'pending_proofread') newStatus = 'proofreading'
      else if (member.role === 'typesetter' && page.status === 'pending_typeset') newStatus = 'typesetting'
      else continue

      newProjects = updatePage(newProjects, pageId, p => ({
        ...p,
        status: newStatus,
        assigneeId: memberId,
        updatedAt: new Date().toISOString().split('T')[0],
      }))

      newLogs.push(makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'assign_by_leader', `指派给${member.name}（${ROLE_LABELS[member.role]}）`))
      count++
    }

    if (count > 0) {
      const newState = { projects: newProjects, taskLogs: [...get().taskLogs, ...newLogs] }
      saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
      set(newState)
    }
    return count
  },

  resetStalePages: (pageIds) => {
    let count = 0
    const newLogs: TaskLog[] = []
    let newProjects = get().projects

    for (const pageId of pageIds) {
      const found = findPageInProjects(newProjects, pageId)
      if (!found) continue
      const page = found.page
      if (page.status === 'completed') continue

      let newStatus: PageStatus = page.status
      if (['pending_translate', 'translating'].includes(page.status)) newStatus = 'pending_translate'
      else if (['pending_proofread', 'proofreading'].includes(page.status)) newStatus = 'pending_proofread'
      else if (['pending_typeset', 'typesetting'].includes(page.status)) newStatus = 'pending_typeset'
      else continue

      newProjects = updatePage(newProjects, pageId, p => ({
        ...p,
        status: newStatus,
        assigneeId: null,
        updatedAt: new Date().toISOString().split('T')[0],
      }))

      const detail = page.assigneeId ? `从${get().getMember(page.assigneeId)?.name}回收` : '回收至待领取'
      newLogs.push(makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'reclaimed_by_leader', detail))
      count++
    }

    if (count > 0) {
      const newState = { projects: newProjects, taskLogs: [...get().taskLogs, ...newLogs] }
      saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
      set(newState)
    }
    return count
  },

  leaderAssign: (pageId, memberId) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return false
    const member = get().members.find(m => m.id === memberId)
    if (!member) return false

    const page = found.page
    if (page.assigneeId) return false

    let newStatus: PageStatus = page.status
    if (member.role === 'translator' && page.status === 'pending_translate') newStatus = 'translating'
    else if (member.role === 'proofreader' && page.status === 'pending_proofread') newStatus = 'proofreading'
    else if (member.role === 'typesetter' && page.status === 'pending_typeset') newStatus = 'typesetting'
    else return false

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'assign_by_leader', `指派给${member.name}（${ROLE_LABELS[member.role]}）`)

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: newStatus,
      assigneeId: memberId,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
    return true
  },

  batchAssignByRole: (projectId, role, memberId, chapterIds) => {
    const project = get().projects.find(p => p.id === projectId)
    const member = get().members.find(m => m.id === memberId)
    if (!project || !member || member.role !== role) return 0

    let count = 0
    const newLogs: TaskLog[] = []
    let newProjects = get().projects

    const targetStatus: PageStatus | null = role === 'translator' ? 'pending_translate' : role === 'proofreader' ? 'pending_proofread' : role === 'typesetter' ? 'pending_typeset' : null
    if (!targetStatus) return 0

    const activeStatus: PageStatus = role === 'translator' ? 'translating' : role === 'proofreader' ? 'proofreading' : 'typesetting'

    for (const ch of project.chapters) {
      if (chapterIds && !chapterIds.includes(ch.id)) continue
      for (const page of ch.pages) {
        if (page.status !== targetStatus || page.assigneeId) continue

        newProjects = updatePage(newProjects, page.id, p => ({
          ...p,
          status: activeStatus,
          assigneeId: memberId,
          updatedAt: new Date().toISOString().split('T')[0],
        }))

        newLogs.push(makeLog(page.id, ch.id, projectId, get().currentUserId, 'assign_by_leader', `指派给${member.name}（${ROLE_LABELS[member.role]}）`))
        count++
      }
    }

    if (count > 0) {
      const newState = { projects: newProjects, taskLogs: [...get().taskLogs, ...newLogs] }
      saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
      set(newState)
    }
    return count
  },

  leaderReclaim: (pageId) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found || found.page.status === 'completed') return false

    const page = found.page
    let newStatus: PageStatus = page.status
    if (['pending_translate', 'translating'].includes(page.status)) newStatus = 'pending_translate'
    else if (['pending_proofread', 'proofreading'].includes(page.status)) newStatus = 'pending_proofread'
    else if (['pending_typeset', 'typesetting'].includes(page.status)) newStatus = 'pending_typeset'
    else return false

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'reclaimed_by_leader', page.assigneeId ? `从${get().getMember(page.assigneeId)?.name}回收` : '回收至待领取')

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: newStatus,
      assigneeId: null,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
    return true
  },

  leaderSendBack: (pageId) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return false
    const page = found.page

    let newStatus: PageStatus | null = null
    if (page.status === 'pending_proofread' || page.status === 'proofreading') newStatus = 'translating'
    else if (page.status === 'pending_typeset' || page.status === 'typesetting') newStatus = 'pending_proofread'
    else if (page.status === 'completed') newStatus = 'typesetting'
    if (!newStatus) return false

    let targetAssignee: string | null = page.assigneeId
    if (newStatus === 'translating') {
      const prevClaimLog = get().taskLogs.find(l => l.pageId === pageId && l.action === 'claimed' && get().getMember(l.memberId)?.role === 'translator')
      targetAssignee = prevClaimLog?.memberId ?? null
    } else if (newStatus === 'pending_proofread') {
      targetAssignee = null
    } else if (newStatus === 'typesetting') {
      const prevClaimLog = get().taskLogs.find(l => l.pageId === pageId && l.action === 'claimed' && get().getMember(l.memberId)?.role === 'typesetter')
      targetAssignee = prevClaimLog?.memberId ?? null
    }

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'sent_back_by_leader', `退回至${STATUS_LABELS[newStatus]}环节`)

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: newStatus!,
      assigneeId: targetAssignee,
      updatedAt: new Date().toISOString().split('T')[0],
      dialogues: newStatus === 'translating' ? p.dialogues.map(d => ({ ...d, status: 'rejected' as const })) : p.dialogues,
      proofreadComments: newStatus === 'translating' && p.proofreadComments.length === 0 ? [{ id: generateId(), dialogueId: p.dialogues[0]?.id ?? '', type: 'other' as const, content: '组长退回修改', createdAt: new Date().toISOString().split('T')[0] }] : p.proofreadComments,
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
    return true
  },

  leaderChangeAssignee: (pageId, memberId) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return false
    const member = get().members.find(m => m.id === memberId)
    if (!member) return false

    const page = found.page
    if (page.status === 'completed') return false

    const statusMatches =
      (member.role === 'translator' && ['pending_translate', 'translating'].includes(page.status)) ||
      (member.role === 'proofreader' && ['pending_proofread', 'proofreading'].includes(page.status)) ||
      (member.role === 'typesetter' && ['pending_typeset', 'typesetting'].includes(page.status))
    if (!statusMatches) return false

    let newStatus: PageStatus = page.status
    if (member.role === 'translator') newStatus = 'translating'
    if (member.role === 'proofreader') newStatus = 'proofreading'
    if (member.role === 'typesetter') newStatus = 'typesetting'

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'assign_by_leader', `换负责人给${member.name}（${ROLE_LABELS[member.role]}）`)

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: newStatus,
      assigneeId: memberId,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
    return true
  },

  reuploadTypeset: (pageId, typesetImage) => {
    const found = findPageInProjects(get().projects, pageId)
    if (!found) return

    const action = found.page.typesetImage ? 'typeset_reuploaded' : 'typeset_uploaded'
    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, found.page.assigneeId ?? get().currentUserId, action)

    const newProjects = updatePage(get().projects, pageId, p => ({
      ...p,
      status: 'completed' as PageStatus,
      assigneeId: null,
      typesetImage,
      updatedAt: new Date().toISOString().split('T')[0],
    }))

    const newState = { projects: newProjects, taskLogs: [...get().taskLogs, newLog] }
    saveToStorage({ projects: newState.projects, members: get().members, taskLogs: newState.taskLogs })
    set(newState)
  },

  getPagesByStatus: (projectId, status) => {
    return get().getAllPages(projectId).filter(p => p.status === status)
  },

  getPagesByAssignee: (projectId, memberId) => {
    return get().getAllPages(projectId).filter(p => p.assigneeId === memberId)
  },

  getOverduePages: (projectId) => {
    const today = new Date().toISOString().split('T')[0]
    const allPages = projectId
      ? get().getAllPages(projectId)
      : get().projects.flatMap(p => p.chapters.flatMap(ch => ch.pages))
    return allPages.filter(p => p.status !== 'completed' && p.deadline < today)
  },

  getOverduePagesDetailed: (projectId) => {
    const today = new Date().toISOString().split('T')[0]
    const results: { page: Page; projectId: string; chapterName: string; isAssigned: boolean }[] = []
    const projects = projectId ? [get().projects.find(p => p.id === projectId)].filter(Boolean) as Project[] : get().projects
    for (const project of projects) {
      for (const ch of project.chapters) {
        for (const page of ch.pages) {
          if (page.status !== 'completed' && page.deadline < today) {
            results.push({ page, projectId: project.id, chapterName: ch.name, isAssigned: !!page.assigneeId })
          }
        }
      }
    }
    return results
  },

  getStuckPagesForReminder: (projectId) => {
    const today = new Date()
    const assignedOverdue: { page: Page; projectId: string; chapterName: string }[] = []
    const unclaimedForLong: { page: Page; projectId: string; chapterName: string; daysUnclaimed: number }[] = []
    const rejectedNotResumed: { page: Page; projectId: string; chapterName: string; daysSinceRejection: number }[] = []

    const projects = projectId ? [get().projects.find(p => p.id === projectId)].filter(Boolean) as Project[] : get().projects
    const taskLogs = get().taskLogs

    for (const project of projects) {
      for (const ch of project.chapters) {
        for (const page of ch.pages) {
          if (page.status === 'completed') continue

          if (page.deadline < today.toISOString().split('T')[0] && page.assigneeId) {
            assignedOverdue.push({ page, projectId: project.id, chapterName: ch.name })
          }

          if (page.deadline < today.toISOString().split('T')[0] && !page.assigneeId && ['pending_translate', 'pending_proofread', 'pending_typeset'].includes(page.status)) {
            const deadline = new Date(page.deadline)
            const daysUnclaimed = Math.floor((today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24))
            if (daysUnclaimed >= 2) {
              unclaimedForLong.push({ page, projectId: project.id, chapterName: ch.name, daysUnclaimed })
            }
          }

          const lastRejectionLog = taskLogs
            .filter(l => l.pageId === page.id && l.action === 'rejected')
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
          if (lastRejectionLog && page.status === 'translating') {
            const rejectionDate = new Date(lastRejectionLog.timestamp)
            const daysSinceRejection = Math.floor((today.getTime() - rejectionDate.getTime()) / (1000 * 60 * 60 * 24))
            if (daysSinceRejection >= 2) {
              rejectedNotResumed.push({ page, projectId: project.id, chapterName: ch.name, daysSinceRejection })
            }
          }
        }
      }
    }

    return { assignedOverdue, unclaimedForLong, rejectedNotResumed }
  },

  getBottleneckStats: (projectId) => {
    const pages = get().getAllPages(projectId)
    return {
      translate: pages.filter(p => ['pending_translate', 'translating'].includes(p.status)).length,
      proofread: pages.filter(p => ['pending_proofread', 'proofreading'].includes(p.status)).length,
      typeset: pages.filter(p => ['pending_typeset', 'typesetting'].includes(p.status)).length,
    }
  },

  getMemberTaskCount: (memberId) => {
    const allPages = get().projects.flatMap(p => p.chapters.flatMap(ch => ch.pages))
    const taskLogs = get().taskLogs
    const active = allPages.filter(p => p.assigneeId === memberId && p.status !== 'completed').length
    const completedPages = new Set<string>()
    for (const log of taskLogs) {
      if (log.action === 'typeset_uploaded' || (log.action === 'submitted' && log.memberId === memberId)) {
        const page = allPages.find(p => p.id === log.pageId)
        if (page && page.status === 'completed') {
          completedPages.add(log.pageId)
        }
      }
    }
    const memberLogs = taskLogs.filter(l => l.memberId === memberId)
    const participatedPageIds = new Set<string>()
    for (const log of memberLogs) {
      const page = allPages.find(p => p.id === log.pageId)
      if (page && page.status === 'completed') {
        participatedPageIds.add(log.pageId)
      }
    }
    return { active, completed: participatedPageIds.size }
  },

  getRetrospectiveStats: (projectId, chapterId) => {
    let projects = projectId ? [get().projects.find(p => p.id === projectId)].filter(Boolean) as Project[] : get().projects
    if (chapterId) {
      projects = projects.map(p => ({ ...p, chapters: p.chapters.filter(c => c.id === chapterId) })).filter(p => p.chapters.length > 0)
    }
    const taskLogs = get().taskLogs
    const stageDurations: { stage: string; avgHours: number; count: number }[] = []
    const stageActions: Record<string, { enter: TaskAction; exit: TaskAction }> = {
      '翻译': { enter: 'claimed', exit: 'submitted' },
      '校对': { enter: 'claimed', exit: 'approved' },
      '嵌字': { enter: 'claimed', exit: 'typeset_uploaded' },
    }
    for (const [stage, actions] of Object.entries(stageActions)) {
      const durations: number[] = []
      for (const project of projects) {
        for (const ch of project.chapters) {
          for (const page of ch.pages) {
            const roleFilter = stage === '翻译' ? 'translator' : stage === '校对' ? 'proofreader' : 'typesetter'
            const enterLog = taskLogs.find(l => l.pageId === page.id && l.action === actions.enter && get().getMember(l.memberId)?.role === roleFilter)
            const exitLog = taskLogs.find(l => l.pageId === page.id && (l.action === actions.exit || l.action === 'typeset_reuploaded') && l.timestamp > (enterLog?.timestamp ?? ''))
            if (enterLog && exitLog) {
              const hours = (new Date(exitLog.timestamp).getTime() - new Date(enterLog.timestamp).getTime()) / (1000 * 60 * 60)
              if (hours >= 0 && hours < 720) durations.push(hours)
            }
          }
        }
      }
      if (durations.length > 0) {
        stageDurations.push({ stage, avgHours: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length), count: durations.length })
      }
    }

    const memberBacklog: { memberId: string; name: string; role: string; activeCount: number; pageIds: string[]; statusPageIds: Record<string, string[]> }[] = []
    for (const member of get().members) {
      if (member.role === 'leader') continue
      const activePages: string[] = []
      const statusPageIds: Record<string, string[]> = {}
      for (const project of projects) {
        for (const ch of project.chapters) {
          for (const page of ch.pages) {
            if (page.assigneeId === member.id && page.status !== 'completed') {
              activePages.push(page.id)
              if (!statusPageIds[page.status]) statusPageIds[page.status] = []
              statusPageIds[page.status].push(page.id)
            }
          }
        }
      }
      memberBacklog.push({ memberId: member.id, name: member.name, role: ROLE_LABELS[member.role], activeCount: activePages.length, pageIds: activePages, statusPageIds })
    }
    memberBacklog.sort((a, b) => b.activeCount - a.activeCount)

    const repeatedRejections: { pageId: string; pageNumber: number; chapterName: string; projectId: string; rejectionCount: number }[] = []
    for (const project of projects) {
      for (const ch of project.chapters) {
        for (const page of ch.pages) {
          const rejectionCount = taskLogs.filter(l => l.pageId === page.id && l.action === 'rejected').length
          if (rejectionCount >= 2) {
            repeatedRejections.push({ pageId: page.id, pageNumber: page.pageNumber, chapterName: ch.name, projectId: project.id, rejectionCount })
          }
        }
      }
    }
    repeatedRejections.sort((a, b) => b.rejectionCount - a.rejectionCount)

    return { stageDurations, memberBacklog, repeatedRejections }
  },

  getStageStatuses: (stage) => {
    const map: Record<string, PageStatus[]> = {
      '翻译': ['pending_translate', 'translating'],
      '校对': ['pending_proofread', 'proofreading'],
      '嵌字': ['pending_typeset', 'typesetting'],
    }
    return map[stage] ?? []
  },

  getFilteredLogs: (filters) => {
    let logs = get().taskLogs
    if (filters.memberId) logs = logs.filter(l => l.memberId === filters.memberId)
    if (filters.action) logs = logs.filter(l => l.action === filters.action)
    if (filters.projectId) logs = logs.filter(l => l.projectId === filters.projectId)
    if (filters.stage) {
      const stageMap: Record<string, string[]> = {
        '翻译': ['claimed', 'submitted', 'rejected', 'assign_by_leader', 'reclaimed_by_leader', 'sent_back_by_leader'],
        '校对': ['claimed', 'approved', 'rejected', 'comment_added', 'assign_by_leader', 'reclaimed_by_leader', 'sent_back_by_leader'],
        '嵌字': ['claimed', 'typeset_uploaded', 'typeset_reuploaded', 'assign_by_leader', 'reclaimed_by_leader', 'sent_back_by_leader'],
      }
      const allowed = stageMap[filters.stage] ?? []
      logs = logs.filter(l => allowed.includes(l.action))
    }
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  },

  exportRetrospectiveCSV: (projectId, chapterId) => {
    const { stageDurations, memberBacklog, repeatedRejections } = get().getRetrospectiveStats(projectId, chapterId)
    const projectName = projectId ? get().getProject(projectId)?.name ?? '' : '全部项目'
    const chapterName = chapterId ? get().getProject(projectId!)?.chapters.find(c => c.id === chapterId)?.name ?? '' : '全部章节'
    let csv = '\uFEFF'
    csv += `复盘报告,导出时间,${new Date().toLocaleString('zh-CN')}\n`
    csv += `范围,${projectName},${chapterName}\n\n`
    csv += '【环节平均停留时长】\n'
    csv += '环节,平均耗时(小时),样本数\n'
    for (const sd of stageDurations) csv += `${sd.stage},${sd.avgHours},${sd.count}\n`
    csv += '\n【成员积压排行】\n'
    csv += '成员,角色,进行中数量,积压页面ID\n'
    for (const mb of memberBacklog) csv += `${mb.name},${mb.role},${mb.activeCount},${mb.pageIds.join(';')}\n`
    csv += '\n【反复退回页面】\n'
    csv += '项目,章节,页码,退回次数,页面ID\n'
    for (const rr of repeatedRejections) {
      const pName = get().getProject(rr.projectId)?.name ?? ''
      csv += `${pName},${rr.chapterName},第${rr.pageNumber}页,${rr.rejectionCount},${rr.pageId}\n`
    }
    return csv
  },

  setCurrentUser: (id) => set({ currentUserId: id }),

  switchRole: (memberId, role) => {
    const targetMember = get().getMember(memberId)
    const newMembers = get().members.map(m => m.id === memberId ? { ...m, role } : m)
    if (targetMember && targetMember.role !== role) {
      const newLog = makeLog('', '', '', get().currentUserId, 'role_switch_by_leader', `${targetMember.name} 从 ${ROLE_LABELS[targetMember.role]} 调整为 ${ROLE_LABELS[role]}`)
      const newState = { members: newMembers, taskLogs: [...get().taskLogs, newLog] }
      saveToStorage({ projects: get().projects, members: newMembers, taskLogs: newState.taskLogs })
      set(newState)
    } else {
      saveToStorage({ projects: get().projects, members: newMembers, taskLogs: get().taskLogs })
      set({ members: newMembers })
    }
  },
}))

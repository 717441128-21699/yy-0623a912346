import { create } from 'zustand'
import type { Project, Member, TaskLog, Page, Dialogue, ProofreadComment, PageStatus, MemberRole } from '@/types'
import { MOCK_PROJECTS, MOCK_MEMBERS, MOCK_TASK_LOGS } from '@/data/mockData'

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
  resetStalePages: (pageIds: string[]) => number
  leaderAssign: (pageId: string, memberId: string) => boolean

  getPagesByStatus: (projectId: string, status: PageStatus) => Page[]
  getPagesByAssignee: (projectId: string, memberId: string) => Page[]
  getOverduePages: (projectId?: string) => Page[]
  getOverduePagesDetailed: (projectId?: string) => { page: Page; projectId: string; chapterName: string; isAssigned: boolean }[]
  getBottleneckStats: (projectId: string) => { translate: number; proofread: number; typeset: number }
  getMemberTaskCount: (memberId: string) => { active: number; completed: number }

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

const STORAGE_VERSION = 'v2'
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

      newLogs.push(makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, memberId, 'claimed'))
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

      if (page.assigneeId) {
        newLogs.push(makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, page.assigneeId, 'released'))
      }
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

    const newLog = makeLog(pageId, found.chapterId, get().projects[found.projectIndex].id, get().currentUserId, 'claimed', `组长指派给${member.name}`)

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

  setCurrentUser: (id) => set({ currentUserId: id }),

  switchRole: (memberId, role) => {
    const newMembers = get().members.map(m => m.id === memberId ? { ...m, role } : m)
    saveToStorage({ projects: get().projects, members: newMembers, taskLogs: get().taskLogs })
    set({ members: newMembers })
  },
}))

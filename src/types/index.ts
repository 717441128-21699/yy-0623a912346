export type PageStatus =
  | 'pending_translate'
  | 'translating'
  | 'pending_proofread'
  | 'proofreading'
  | 'pending_typeset'
  | 'typesetting'
  | 'completed'

export type MemberRole = 'leader' | 'translator' | 'proofreader' | 'typesetter'

export type DialogueStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type CommentType = 'tone' | 'naming' | 'meme_note' | 'other'

export type TaskAction = 'claimed' | 'submitted' | 'released' | 'approved' | 'rejected'

export interface Member {
  id: string
  name: string
  avatar: string
  role: MemberRole
}

export interface Dialogue {
  id: string
  index: number
  text: string
  isOnomatopoeia: boolean
  status: DialogueStatus
}

export interface ProofreadComment {
  id: string
  dialogueId: string
  type: CommentType
  content: string
  createdAt: string
}

export interface Page {
  id: string
  chapterId: string
  pageNumber: number
  originalImage: string
  status: PageStatus
  assigneeId: string | null
  deadline: string
  dialogues: Dialogue[]
  proofreadComments: ProofreadComment[]
  typesetImage: string | null
  updatedAt: string
}

export interface Chapter {
  id: string
  projectId: string
  name: string
  order: number
  pages: Page[]
}

export interface Project {
  id: string
  name: string
  coverImage: string
  chapters: Chapter[]
  createdAt: string
  deadline: string
}

export interface TaskLog {
  id: string
  pageId: string
  chapterId: string
  projectId: string
  memberId: string
  action: TaskAction
  timestamp: string
}

export const STATUS_LABELS: Record<PageStatus, string> = {
  pending_translate: '待翻译',
  translating: '翻译中',
  pending_proofread: '待校对',
  proofreading: '校对中',
  pending_typeset: '待嵌字',
  typesetting: '嵌字中',
  completed: '已完成',
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  leader: '组长',
  translator: '翻译',
  proofreader: '校对',
  typesetter: '嵌字',
}

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  tone: '语气不对',
  naming: '称呼需统一',
  meme_note: '梗需注释',
  other: '其他',
}

export const STATUS_COLORS: Record<PageStatus, string> = {
  pending_translate: '#0f3460',
  translating: '#1a5276',
  pending_proofread: '#16c79a',
  proofreading: '#0e8c6e',
  pending_typeset: '#f5a623',
  typesetting: '#d4891c',
  completed: '#4caf50',
}

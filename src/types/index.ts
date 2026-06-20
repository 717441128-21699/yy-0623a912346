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

export type TaskAction =
  | 'claimed'
  | 'submitted'
  | 'released'
  | 'approved'
  | 'rejected'
  | 'comment_added'
  | 'typeset_uploaded'
  | 'typeset_reuploaded'
  | 'assign_by_leader'
  | 'reclaimed_by_leader'
  | 'sent_back_by_leader'
  | 'role_switch_by_leader'

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
  detail?: string
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

export const ACTION_LABELS: Record<TaskAction, string> = {
  claimed: '领取任务',
  submitted: '提交翻译',
  released: '放弃任务',
  approved: '通过校对',
  rejected: '退回翻译',
  comment_added: '添加批注',
  typeset_uploaded: '上传成品图',
  typeset_reuploaded: '重新上传成品图',
  assign_by_leader: '组长指派',
  reclaimed_by_leader: '组长回收待领取',
  sent_back_by_leader: '组长退回上一环节',
  role_switch_by_leader: '组长调整角色',
}

export const ACTION_COLORS: Record<TaskAction, string> = {
  claimed: '#0f3460',
  submitted: '#16c79a',
  released: '#f5a623',
  approved: '#16c79a',
  rejected: '#e94560',
  comment_added: '#9b59b6',
  typeset_uploaded: '#16c79a',
  typeset_reuploaded: '#16a085',
  assign_by_leader: '#e94560',
  reclaimed_by_leader: '#e67e22',
  sent_back_by_leader: '#e74c3c',
  role_switch_by_leader: '#8e44ad',
}

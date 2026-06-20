import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Check, Upload, MessageSquare, AlertCircle, Send, History } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { PageStatus, CommentType, TaskAction } from '@/types'
import { STATUS_LABELS, COMMENT_TYPE_LABELS, ACTION_LABELS } from '@/types'

const FLOW_STEPS: PageStatus[] = [
  'pending_translate', 'translating', 'pending_proofread',
  'proofreading', 'pending_typeset', 'typesetting', 'completed',
]

const STEP_INDEX: Record<PageStatus, number> = Object.fromEntries(
  FLOW_STEPS.map((s, i) => [s, i]),
) as Record<PageStatus, number>

const COMMENT_TYPE_COLORS: Record<CommentType, string> = {
  tone: 'bg-red-500/20 text-red-300',
  naming: 'bg-blue-500/20 text-blue-300',
  meme_note: 'bg-purple-500/20 text-purple-300',
  other: 'bg-gray-500/20 text-gray-300',
}

const ACTION_COLORS: Record<TaskAction, string> = {
  claimed: '#0f3460',
  submitted: '#16c79a',
  released: '#f5a623',
  approved: '#16c79a',
  rejected: '#e94560',
  comment_added: '#9b59b6',
  typeset_uploaded: '#16c79a',
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PageWorkspace() {
  const { projectId, pageId } = useParams<{ projectId: string; pageId: string }>()
  const store = useStore()
  const currentUser = useStore((s) => s.getMember(s.currentUserId))
  const pageData = useStore((s) => s.getPage(projectId!, pageId!))

  const [newCommentType, setNewCommentType] = useState<Record<string, CommentType>>({})
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({})
  const [typesetPreview, setTypesetPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!projectId || !pageId || !pageData || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-txt-muted">页面不存在</p>
      </div>
    )
  }

  const { page } = pageData
  const currentStepIndex = STEP_INDEX[page.status]
  const isAssignedToMe = page.assigneeId === currentUser.id

  const handleClaim = async () => {
    const ok = store.claimTask(pageId, currentUser.id)
    if (!ok) alert('已被他人领取')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setTypesetPreview(dataUrl)
      store.submitTypeset(pageId, dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitTranslation = () => {
    store.submitTranslation(pageId, page.dialogues)
  }

  const handleAddComment = (dialogueId: string) => {
    const type = newCommentType[dialogueId] || 'other'
    const content = newCommentText[dialogueId]?.trim()
    if (!content) return
    store.addProofreadComment(pageId, { dialogueId, type, content })
    setNewCommentText((prev) => ({ ...prev, [dialogueId]: '' }))
  }

  const renderFlowBar = () => (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {FLOW_STEPS.map((step, i) => {
        const isCompleted = i < currentStepIndex
        const isCurrent = i === currentStepIndex
        return (
          <div key={step} className="flex items-center shrink-0">
            {i > 0 && (
              <div className={`w-6 h-0.5 ${i <= currentStepIndex ? 'bg-accent-red' : 'bg-border-dark'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                  isCompleted
                    ? 'bg-accent-green border-accent-green text-white'
                    : isCurrent
                      ? 'bg-accent-red border-accent-red text-white animate-pulse-glow'
                      : 'bg-dark-card border-border-dark text-txt-muted'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${isCurrent ? 'text-accent-red font-semibold' : isCompleted ? 'text-accent-green' : 'text-txt-muted'}`}>
                {STATUS_LABELS[step]}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderTranslatorPanel = () => (
    <div className="space-y-3">
      {page.dialogues.map((d) => (
        <div key={d.id} className="bg-dark-card rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-txt-muted text-sm">序号 {d.index}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-txt-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.isOnomatopoeia}
                  onChange={() => store.updateDialogue(pageId, d.id, d.text, !d.isOnomatopoeia)}
                  className="accent-accent-red"
                />
                拟声词
              </label>
              <button
                onClick={() => store.removeDialogue(pageId, d.id)}
                className="text-txt-muted hover:text-accent-red transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <textarea
            rows={2}
            value={d.text}
            onChange={(e) => store.updateDialogue(pageId, d.id, e.target.value, d.isOnomatopoeia)}
            className="w-full bg-dark-secondary rounded-md px-3 py-2 text-txt-primary text-sm border border-border-dark focus:border-accent-red focus:outline-none resize-none"
            placeholder="输入翻译文本..."
          />
        </div>
      ))}
      <button
        onClick={() => store.addDialogue(pageId)}
        className="flex items-center gap-1 text-sm text-accent-blue hover:text-accent-green transition-colors"
      >
        <Plus className="w-4 h-4" /> 添加台词
      </button>
      <button
        onClick={handleSubmitTranslation}
        className="w-full py-2.5 rounded-lg bg-accent-green text-white font-semibold hover:opacity-90 transition-opacity"
      >
        提交翻译
      </button>
    </div>
  )

  const renderProofreaderPanel = () => (
    <div className="space-y-3">
      {page.dialogues.map((d) => {
        const comments = page.proofreadComments.filter((c) => c.dialogueId === d.id)
        return (
          <div key={d.id} className="bg-dark-card rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-txt-muted text-sm shrink-0">序号 {d.index}</span>
              <p className="text-txt-primary text-sm flex-1">{d.text || '(空)'}</p>
            </div>
            {d.isOnomatopoeia && (
              <span className="inline-block text-xs bg-accent-orange/20 text-accent-orange px-1.5 py-0.5 rounded">拟声词</span>
            )}
            {comments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {comments.map((c) => (
                  <span key={c.id} className={`text-xs px-2 py-0.5 rounded-full ${COMMENT_TYPE_COLORS[c.type]}`}>
                    {COMMENT_TYPE_LABELS[c.type]}：{c.content}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1 border-t border-border-dark">
              <select
                value={newCommentType[d.id] || 'other'}
                onChange={(e) => setNewCommentType((prev) => ({ ...prev, [d.id]: e.target.value as CommentType }))}
                className="bg-dark-secondary text-txt-secondary text-xs rounded px-2 py-1 border border-border-dark focus:outline-none"
              >
                {(['tone', 'naming', 'meme_note', 'other'] as CommentType[]).map((t) => (
                  <option key={t} value={t}>{COMMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input
                value={newCommentText[d.id] || ''}
                onChange={(e) => setNewCommentText((prev) => ({ ...prev, [d.id]: e.target.value }))}
                className="flex-1 bg-dark-secondary text-txt-primary text-xs rounded px-2 py-1 border border-border-dark focus:border-accent-red focus:outline-none"
                placeholder="添加批注..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment(d.id)}
              />
              <button onClick={() => handleAddComment(d.id)} className="text-accent-green hover:opacity-80">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => store.approveProofread(pageId)}
          className="flex-1 py-2.5 rounded-lg bg-accent-green text-white font-semibold hover:opacity-90 transition-opacity"
        >
          通过校对
        </button>
        <button
          onClick={() => store.rejectProofread(pageId, page.proofreadComments)}
          className="flex-1 py-2.5 rounded-lg bg-accent-red text-white font-semibold hover:opacity-90 transition-opacity"
        >
          退回翻译
        </button>
      </div>
    </div>
  )

  const renderTypesetterPanel = () => {
    const approvedDialogues = page.dialogues.filter(d => d.status === 'approved')
    return (
      <div className="space-y-3">
        <div className="bg-dark-card rounded-lg p-3 space-y-2">
          <h3 className="text-txt-secondary text-sm font-medium">台词列表</h3>
          {approvedDialogues.length === 0 ? (
            <p className="text-txt-muted text-sm">暂无已通过校对的台词</p>
          ) : (
            approvedDialogues.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <span className="text-txt-muted shrink-0">{d.index}.</span>
                <span className="text-txt-primary">{d.text || '(空)'}</span>
                {d.isOnomatopoeia && (
                  <span className="text-xs bg-accent-orange/20 text-accent-orange px-1.5 py-0.5 rounded">拟声词</span>
                )}
              </div>
            ))
          )}
        </div>
        <div className="bg-dark-card rounded-lg p-3 space-y-2">
          <h3 className="text-txt-secondary text-sm font-medium">上传成品图</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-8 rounded-lg border-2 border-dashed border-border-dark hover:border-accent-green transition-colors flex flex-col items-center gap-2 text-txt-muted hover:text-accent-green"
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm">点击上传成品图</span>
          </button>
          {typesetPreview && (
            <img src={typesetPreview} alt="成品预览" className="w-full rounded-lg" />
          )}
        </div>
      </div>
    )
  }

  const renderViewOnlyPanel = () => {
    const visibleDialogues = currentUser.role === 'typesetter'
      ? page.dialogues.filter(d => d.status === 'approved')
      : page.dialogues
    return (
      <div className="space-y-3">
        {visibleDialogues.map((d) => {
          const comments = page.proofreadComments.filter((c) => c.dialogueId === d.id)
          return (
            <div key={d.id} className="bg-dark-card rounded-lg p-3 space-y-1.5">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-txt-muted shrink-0">{d.index}.</span>
                <span className="text-txt-primary">{d.text || '(空)'}</span>
                {d.isOnomatopoeia && (
                  <span className="text-xs bg-accent-orange/20 text-accent-orange px-1.5 py-0.5 rounded">拟声词</span>
                )}
              </div>
              {comments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-5">
                  {comments.map((c) => (
                    <span key={c.id} className={`text-xs px-2 py-0.5 rounded-full ${COMMENT_TYPE_COLORS[c.type]}`}>
                      {COMMENT_TYPE_LABELS[c.type]}：{c.content}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {page.typesetImage && (
          <div className="bg-dark-card rounded-lg p-3 space-y-2">
            <h3 className="text-txt-secondary text-sm font-medium">成品图</h3>
            <img src={page.typesetImage} alt="成品图" className="w-full rounded-lg" />
          </div>
        )}
      </div>
    )
  }

  const renderTimeline = () => {
    const logs = store.getTaskLogsForPage(pageId)
    return (
      <div className="bg-dark-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-txt-secondary" />
          <h2 className="text-txt-primary font-semibold">操作记录</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-txt-muted text-sm">暂无操作记录</p>
        ) : (
          <div className="space-y-0">
            {logs.map((log, i) => {
              const member = store.getMember(log.memberId)
              const color = ACTION_COLORS[log.action]
              const isLast = i === logs.length - 1
              return (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: color }}
                    />
                    {!isLast && <div className="w-px flex-1 bg-border-dark" />}
                  </div>
                  <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-txt-primary text-sm font-medium">
                        {member?.name ?? '组长'}
                      </span>
                      <span className="text-txt-secondary text-sm">{ACTION_LABELS[log.action]}</span>
                    </div>
                    {log.detail && (
                      <p className="text-txt-muted text-xs mt-0.5">{log.detail}</p>
                    )}
                    <p className="text-txt-muted text-xs mt-0.5">{formatTimestamp(log.timestamp)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderWorkPanel = () => {
    if (page.status === 'completed') return renderViewOnlyPanel()

    const showClaimBtn =
      ((page.status === 'pending_translate' && currentUser.role === 'translator') ||
        (page.status === 'pending_proofread' && currentUser.role === 'proofreader') ||
        (page.status === 'pending_typeset' && currentUser.role === 'typesetter')) &&
      !isAssignedToMe

    if (showClaimBtn) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertCircle className="w-10 h-10 text-txt-muted" />
          <p className="text-txt-secondary">此页面等待领取</p>
          <button
            onClick={handleClaim}
            className="px-6 py-2.5 rounded-lg bg-accent-blue text-white font-semibold hover:opacity-90 transition-opacity"
          >
            领取任务
          </button>
        </div>
      )
    }

    if (currentUser.role === 'translator' && (page.status === 'pending_translate' || page.status === 'translating') && isAssignedToMe) {
      return renderTranslatorPanel()
    }
    if (currentUser.role === 'proofreader' && (page.status === 'pending_proofread' || page.status === 'proofreading') && isAssignedToMe) {
      return renderProofreaderPanel()
    }
    if (currentUser.role === 'typesetter' && (page.status === 'pending_typeset' || page.status === 'typesetting') && isAssignedToMe) {
      return renderTypesetterPanel()
    }

    return renderViewOnlyPanel()
  }

  return (
    <div className="min-h-screen bg-dark-primary p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to={`/project/${projectId}`}
          className="flex items-center gap-2 text-txt-secondary hover:text-txt-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回项目</span>
        </Link>
        {isAssignedToMe && (
          <button
            onClick={() => store.releaseTask(pageId, currentUser.id)}
            className="text-txt-muted hover:text-accent-red text-sm transition-colors"
          >
            放弃任务
          </button>
        )}
      </div>

      <div className="bg-dark-card rounded-xl p-4">{renderFlowBar()}</div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="md:w-[40%] space-y-2">
          <div className="bg-dark-secondary rounded-xl overflow-auto max-h-[75vh]">
            <img
              src={page.originalImage}
              alt={`P.${page.pageNumber}`}
              className="w-full object-contain"
            />
          </div>
          <span className="text-txt-muted text-sm font-medium">P.{page.pageNumber}</span>
        </div>

        <div className="md:w-[60%] space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-txt-secondary" />
            <h2 className="text-txt-primary font-semibold">
              {page.status === 'completed' ? '查看' : '工作'}区域
            </h2>
          </div>
          {renderWorkPanel()}
        </div>
      </div>

      {renderTimeline()}
    </div>
  )
}

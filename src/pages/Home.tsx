import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, AlertTriangle, Clock, PenLine, CheckCircle, Type, Languages } from 'lucide-react'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'
import { ROLE_LABELS } from '@/types'
import type { Page } from '@/types'

interface PageInfo {
  page: Page
  chapterName: string
  projectId: string
}

export default function Home() {
  const projects = useStore(s => s.projects)
  const currentUserId = useStore(s => s.currentUserId)
  const members = useStore(s => s.members)
  const getOverduePages = useStore(s => s.getOverduePages)
  const getBottleneckStats = useStore(s => s.getBottleneckStats)

  const currentUser = members.find(m => m.id === currentUserId)

  const pageInfoMap = useMemo(() => {
    const map = new Map<string, PageInfo>()
    for (const project of projects) {
      for (const chapter of project.chapters) {
        for (const page of chapter.pages) {
          map.set(page.id, { page, chapterName: chapter.name, projectId: project.id })
        }
      }
    }
    return map
  }, [projects])

  const myTasks = useMemo(() => {
    const all = Array.from(pageInfoMap.values())
    return {
      translating: all.filter(i => i.page.assigneeId === currentUserId && i.page.status === 'translating'),
      proofreading: all.filter(i => i.page.assigneeId === currentUserId && i.page.status === 'proofreading'),
      typesetting: all.filter(i => i.page.assigneeId === currentUserId && i.page.status === 'typesetting'),
    }
  }, [pageInfoMap, currentUserId])

  const overdueList = useMemo(() => {
    return getOverduePages().map(p => {
      const info = pageInfoMap.get(p.id)
      return { page: p, chapterName: info?.chapterName ?? '', projectId: info?.projectId ?? '' }
    })
  }, [projects, pageInfoMap, getOverduePages])

  const bottleneck = useMemo(() => {
    return projects.reduce(
      (acc, p) => {
        const s = getBottleneckStats(p.id)
        return { translate: acc.translate + s.translate, proofread: acc.proofread + s.proofread, typeset: acc.typeset + s.typeset }
      },
      { translate: 0, proofread: 0, typeset: 0 },
    )
  }, [projects, getBottleneckStats])

  const projectStats = useMemo(() => {
    return projects.map(p => {
      const pages = p.chapters.flatMap(ch => ch.pages)
      const completed = pages.filter(pg => pg.status === 'completed').length
      const overdue = getOverduePages(p.id).length
      return { project: p, total: pages.length, completed, overdue }
    })
  }, [projects, getOverduePages])

  const taskColumns = [
    { label: '翻译任务', color: '#0f3460', icon: Languages, tasks: myTasks.translating },
    { label: '校对任务', color: '#16c79a', icon: PenLine, tasks: myTasks.proofreading },
    { label: '嵌字任务', color: '#f5a623', icon: Type, tasks: myTasks.typesetting },
  ]

  const maxBottleneck = Math.max(bottleneck.translate, bottleneck.proofread, bottleneck.typeset, 1)

  return (
    <div className="space-y-8">
      <section className="animate-fade-in opacity-0" style={{ animationDelay: '0s' }}>
        <h1 className="text-3xl font-display text-txt-primary">看板首页</h1>
        <p className="mt-1 text-txt-secondary">当前身份：{currentUser ? ROLE_LABELS[currentUser.role] : '未知'}</p>
      </section>

      <section className="animate-fade-in opacity-0" style={{ animationDelay: '0.05s' }}>
        <h2 className="mb-4 text-xl font-semibold text-txt-primary flex items-center gap-2">
          <Clock size={20} className="text-accent-red" /> 我的任务
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {taskColumns.map(col => (
            <div key={col.label} className="rounded-lg bg-dark-card p-4 border-t-2" style={{ borderColor: col.color }}>
              <div className="flex items-center gap-2 mb-3">
                <col.icon size={18} style={{ color: col.color }} />
                <span className="font-medium text-txt-primary">{col.label}</span>
                <span className="ml-auto text-sm text-txt-muted">{col.tasks.length}</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {col.tasks.length === 0 && <p className="text-sm text-txt-muted py-2">暂无任务</p>}
                {col.tasks.map(t => (
                  <Link
                    key={t.page.id}
                    to={`/project/${t.projectId}/page/${t.page.id}`}
                    className="block rounded-md bg-dark-secondary p-3 hover:bg-dark-hover transition-colors"
                  >
                    <div className="text-sm font-medium text-txt-primary">{t.chapterName}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-txt-secondary">第 {t.page.pageNumber} 页</span>
                      <span className="text-xs text-txt-muted flex items-center gap-1"><Clock size={12} />{t.page.deadline}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="animate-fade-in opacity-0" style={{ animationDelay: '0.1s' }}>
        <h2 className="mb-4 text-xl font-semibold text-txt-primary flex items-center gap-2">
          <BookOpen size={20} className="text-accent-blue" /> 项目概览
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {projectStats.map(({ project, total, completed, overdue }) => {
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0
            const circ = 2 * Math.PI * 16
            const offset = circ - (pct / 100) * circ
            return (
              <Link
                key={project.id}
                to={`/project/${project.id}`}
                className="relative overflow-hidden rounded-lg bg-dark-card card-hover group"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity"
                  style={{ backgroundImage: `url(${project.coverImage})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-card via-dark-card/80 to-transparent" />
                <div className="relative p-4 flex items-end justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-txt-primary">{project.name}</h3>
                    <p className="text-sm text-txt-secondary mt-1 flex items-center gap-1">
                      <CheckCircle size={14} />{completed}/{total} 页已完成
                    </p>
                  </div>
                  <div className="relative flex items-center justify-center w-12 h-12">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#2a3a5c" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="16" fill="none" stroke="#4caf50" strokeWidth="3"
                        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xs font-bold text-txt-primary">{pct}%</span>
                  </div>
                  {overdue > 0 && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-accent-red px-2 py-0.5 text-xs font-medium text-white">
                      <AlertTriangle size={12} />{overdue} 逾期
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {overdueList.length > 0 && (
        <section
          className="animate-fade-in opacity-0 rounded-lg bg-dark-card border border-accent-red/30 overflow-hidden"
          style={{ animationDelay: '0.15s' }}
        >
          <div className="flex items-center gap-2 bg-accent-red/10 px-4 py-3 border-b border-accent-red/30">
            <AlertTriangle size={18} className="text-accent-red" />
            <h2 className="text-lg font-semibold text-accent-red">逾期警告</h2>
          </div>
          <div className="divide-y divide-border-dark">
            {overdueList.map(({ page, chapterName, projectId }) => (
              <Link
                key={page.id}
                to={`/project/${projectId}/page/${page.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-dark-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={page.status} />
                  <span className="text-sm text-txt-primary">{chapterName} · 第 {page.pageNumber} 页</span>
                </div>
                <span className="text-xs text-accent-red flex items-center gap-1"><Clock size={12} />{page.deadline}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="animate-fade-in opacity-0 rounded-lg bg-dark-card p-4" style={{ animationDelay: '0.2s' }}>
        <h2 className="mb-4 text-lg font-semibold text-txt-primary">流程瓶颈</h2>
        <div className="space-y-3">
          {[
            { label: '翻译环节', count: bottleneck.translate, color: '#0f3460' },
            { label: '校对环节', count: bottleneck.proofread, color: '#16c79a' },
            { label: '嵌字环节', count: bottleneck.typeset, color: '#f5a623' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-16 text-sm text-txt-secondary shrink-0">{item.label}</span>
              <div className="flex-1 h-6 rounded-full bg-dark-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(item.count / maxBottleneck) * 100}%`, backgroundColor: item.color }}
                />
              </div>
              <span className="w-8 text-sm text-txt-primary text-right">{item.count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

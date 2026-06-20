import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, AlertTriangle, Clock, BarChart3, UserCheck, UserX } from 'lucide-react'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'
import { ROLE_LABELS } from '@/types'
import type { MemberRole } from '@/types'

const ROLE_COLORS: Record<MemberRole, string> = {
  leader: '#e94560',
  translator: '#0f3460',
  proofreader: '#16c79a',
  typesetter: '#f5a623',
}

type OverdueFilter = 'all' | 'assigned' | 'unassigned'

export default function Members() {
  const members = useStore(s => s.members)
  const getMemberTaskCount = useStore(s => s.getMemberTaskCount)
  const getOverduePagesDetailed = useStore(s => s.getOverduePagesDetailed)
  const getBottleneckStats = useStore(s => s.getBottleneckStats)
  const switchRole = useStore(s => s.switchRole)
  const getMember = useStore(s => s.getMember)

  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [overdueFilter, setOverdueFilter] = useState<OverdueFilter>('all')
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null)

  const currentUserId = useStore(s => s.currentUserId)
  const currentUser = members.find(m => m.id === currentUserId)
  const isLeader = currentUser?.role === 'leader'

  const overdueDetailed = useMemo(() => getOverduePagesDetailed(), [getOverduePagesDetailed])

  const filteredOverdue = useMemo(() => {
    let result = overdueDetailed
    if (memberFilter !== 'all') {
      result = result.filter(item => item.page.assigneeId === memberFilter)
    }
    if (overdueFilter === 'assigned') {
      result = result.filter(item => item.isAssigned)
    } else if (overdueFilter === 'unassigned') {
      result = result.filter(item => !item.isAssigned)
    }
    return result
  }, [overdueDetailed, memberFilter, overdueFilter])

  const assignedOverdue = useMemo(() => filteredOverdue.filter(i => i.isAssigned), [filteredOverdue])
  const unassignedOverdue = useMemo(() => filteredOverdue.filter(i => !i.isAssigned), [filteredOverdue])

  const projects = useStore(s => s.projects)
  const bottleneckData = useMemo(() =>
    projects.map(p => ({ name: p.name, ...getBottleneckStats(p.id) })),
    [projects, getBottleneckStats],
  )

  const maxBottleneck = Math.max(
    ...bottleneckData.flatMap(d => [d.translate, d.proofread, d.typeset]),
    1,
  )

  const allRoles: MemberRole[] = ['leader', 'translator', 'proofreader', 'typesetter']

  const OVERDUE_TABS: { key: OverdueFilter; label: string }[] = [
    { key: 'all', label: '全部逾期' },
    { key: 'assigned', label: '已分配' },
    { key: 'unassigned', label: '未领取' },
  ]

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of projects) map[p.id] = p.name
    return map
  }, [projects])

  return (
    <div className="space-y-8">
      <section className="animate-fade-in opacity-0" style={{ animationDelay: '0s' }}>
        <h1 className="text-3xl font-display text-txt-primary flex items-center gap-3">
          <Users size={28} /> 成员与统计
        </h1>
      </section>

      <section className="animate-fade-in opacity-0" style={{ animationDelay: '0.05s' }}>
        <div className="grid grid-cols-3 gap-4">
          {members.map(member => {
            const counts = getMemberTaskCount(member.id)
            return (
              <div key={member.id} className="rounded-lg bg-dark-card p-4 card-hover">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: ROLE_COLORS[member.role] }}
                  >
                    {member.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-txt-primary truncate">{member.name}</div>
                    {isLeader ? (
                      <div className="relative">
                        <button
                          className="text-xs text-txt-secondary hover:text-txt-primary flex items-center gap-1"
                          onClick={() => setRoleDropdown(roleDropdown === member.id ? null : member.id)}
                        >
                          {ROLE_LABELS[member.role]} ▾
                        </button>
                        {roleDropdown === member.id && (
                          <div className="absolute top-5 left-0 z-10 bg-dark-secondary border border-border-dark rounded-md shadow-lg py-1 min-w-20">
                            {allRoles.map(r => (
                              <button
                                key={r}
                                className="block w-full text-left px-3 py-1 text-xs text-txt-secondary hover:bg-dark-hover hover:text-txt-primary"
                                onClick={() => { switchRole(member.id, r); setRoleDropdown(null) }}
                              >
                                {ROLE_LABELS[r]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-txt-secondary">{ROLE_LABELS[member.role]}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-txt-secondary">进行中 <span className="text-txt-primary font-medium">{counts.active}</span></span>
                  <span className="text-txt-secondary">已完成 <span className="text-txt-primary font-medium">{counts.completed}</span></span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="animate-fade-in opacity-0" style={{ animationDelay: '0.1s' }}>
        <div className="rounded-lg bg-dark-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-txt-primary flex items-center gap-2">
              <AlertTriangle size={18} className="text-accent-red" /> 逾期页面
            </h2>
            <select
              className="bg-dark-secondary text-txt-primary text-sm rounded-md px-3 py-1.5 border border-border-dark focus:outline-none"
              value={memberFilter}
              onChange={e => setMemberFilter(e.target.value)}
            >
              <option value="all">全部成员</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 mb-4">
            {OVERDUE_TABS.map(tab => (
              <button
                key={tab.key}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  overdueFilter === tab.key
                    ? 'bg-accent-red text-white'
                    : 'bg-dark-secondary text-txt-secondary hover:text-txt-primary'
                }`}
                onClick={() => setOverdueFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredOverdue.length === 0 ? (
            <p className="text-sm text-txt-muted py-4 text-center">暂无逾期页面</p>
          ) : (
            <div className="space-y-4">
              {(overdueFilter === 'all' || overdueFilter === 'assigned') && assignedOverdue.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck size={14} className="text-accent-red" />
                    <span className="text-sm font-medium text-accent-red">已分配逾期</span>
                    <span className="bg-accent-red/20 text-accent-red text-xs px-1.5 py-0.5 rounded-full">{assignedOverdue.length}</span>
                  </div>
                  <div className="space-y-2">
                    {assignedOverdue.map(item => {
                      const assignee = item.page.assigneeId ? getMember(item.page.assigneeId) : null
                      return (
                        <Link
                          key={item.page.id}
                          to={`/project/${item.projectId}/page/${item.page.id}`}
                          className="flex items-center justify-between rounded-md bg-dark-secondary p-3 hover:bg-dark-hover transition-colors border-l-2 border-accent-red"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <StatusBadge status={item.page.status} />
                            <span className="text-sm text-txt-primary truncate">{projectNameMap[item.projectId]} · {item.chapterName} · 第 {item.page.pageNumber} 页</span>
                            {assignee && <span className="text-xs text-txt-muted shrink-0">{assignee.name}</span>}
                          </div>
                          <span className="text-xs text-accent-red flex items-center gap-1 shrink-0 ml-3">
                            <Clock size={12} /> {item.page.deadline}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {(overdueFilter === 'all' || overdueFilter === 'unassigned') && unassignedOverdue.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <UserX size={14} className="text-accent-orange" />
                    <span className="text-sm font-medium text-accent-orange">未领取逾期</span>
                    <span className="bg-accent-orange/20 text-accent-orange text-xs px-1.5 py-0.5 rounded-full">{unassignedOverdue.length}</span>
                  </div>
                  <div className="space-y-2">
                    {unassignedOverdue.map(item => (
                      <Link
                        key={item.page.id}
                        to={`/project/${item.projectId}/page/${item.page.id}`}
                        className="flex items-center justify-between rounded-md bg-dark-secondary p-3 hover:bg-dark-hover transition-colors border-l-2 border-accent-orange"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusBadge status={item.page.status} />
                          <span className="text-sm text-txt-primary truncate">{projectNameMap[item.projectId]} · {item.chapterName} · 第 {item.page.pageNumber} 页</span>
                        </div>
                        <span className="text-xs text-accent-orange flex items-center gap-1 shrink-0 ml-3">
                          <Clock size={12} /> {item.page.deadline}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="animate-fade-in opacity-0" style={{ animationDelay: '0.15s' }}>
        <div className="rounded-lg bg-dark-card p-4">
          <h2 className="mb-4 text-lg font-semibold text-txt-primary flex items-center gap-2">
            <BarChart3 size={18} className="text-accent-blue" /> 瓶颈分析
          </h2>
          <div className="space-y-4">
            {bottleneckData.map(d => (
              <div key={d.name}>
                <div className="text-sm text-txt-secondary mb-1.5">{d.name}</div>
                <div className="flex gap-1 items-end" style={{ height: `${Math.max(maxBottleneck * 6, 24)}px` }}>
                  {[
                    { value: d.translate, color: '#0f3460', label: '翻译' },
                    { value: d.proofread, color: '#16c79a', label: '校对' },
                    { value: d.typeset, color: '#f5a623', label: '嵌字' },
                  ].map(bar => (
                    <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-txt-primary">{bar.value}</span>
                      <div
                        className="w-full rounded-t-sm transition-all"
                        style={{
                          backgroundColor: bar.color,
                          height: `${Math.max((bar.value / maxBottleneck) * 100, 4)}%`,
                        }}
                      />
                      <span className="text-xs text-txt-muted">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

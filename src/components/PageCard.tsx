import { Link } from 'react-router-dom'
import { Clock, CheckCircle2 } from 'lucide-react'
import type { Page } from '@/types'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'

interface PageCardProps {
  page: Page
  projectId: string
}

export default function PageCard({ page, projectId }: PageCardProps) {
  const getMember = useStore((s) => s.getMember)
  const assignee = page.assigneeId ? getMember(page.assigneeId) : null
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = page.status !== 'completed' && page.deadline < today

  return (
    <Link
      to={`/project/${projectId}/page/${page.id}`}
      className="card-hover block rounded-xl overflow-hidden bg-dark-card"
    >
      <div className="relative">
        <img
          src={page.originalImage}
          alt={`P.${page.pageNumber}`}
          className="w-full aspect-square object-cover rounded-t-xl"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
          <span className="text-white text-sm font-semibold">P.{page.pageNumber}</span>
        </div>
        {page.status === 'completed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-1.5">
        <StatusBadge status={page.status} />
        {assignee && (
          <div className="text-xs text-gray-300 truncate">{assignee.name}</div>
        )}
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className={`text-xs ${isOverdue ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
            {page.deadline}
          </span>
          {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        </div>
      </div>
    </Link>
  )
}

import { STATUS_LABELS, STATUS_COLORS, type PageStatus } from '@/types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: PageStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white')}
      style={{ backgroundColor: STATUS_COLORS[status] }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

import { t } from '../i18n'
import type { SgClass } from '../types'
import { Badge, type Tone } from './index'

const TONE: Record<SgClass, Tone> = {
  sea_store_paid: 'accent',
  sea_store_unpaid: 'info',
  dutiable_liquor: 'violet',
  dutiable_tobacco: 'violet',
  controlled: 'warn',
  ship_spare_install: 'outline',
}

export function ClassBadge({ value }: { value?: SgClass }) {
  if (!value) return <Badge tone="bad" dot>{t.common.unclassified}</Badge>
  return <Badge tone={TONE[value]}>{t.sgClass[value].short}</Badge>
}

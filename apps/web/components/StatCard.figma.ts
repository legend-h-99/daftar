// url=https://www.figma.com/design/PquxMKpzcPo1kqDH4Z5Tx6/daftar?node-id=5-48
// source=components/StatCard.tsx
// component=StatCard
import figma from 'figma'

const instance = figma.selectedInstance

const tone = instance.getEnum('tone', {
  'Brand':   'brand',
  'Red':     'red',
  'Green':   'neutral',
  'Neutral': 'neutral',
})

const label = instance.findText('label')?.textContent ?? 'إجمالي'
const value = instance.findText('value')?.textContent ?? '٠'

export default {
  example: figma.code`
<StatCard
  label="${label}"
  value="${value}"
  tone="${tone}"
  icon={TrendingUp}
/>`,
  imports: [
    'import StatCard from "@/components/StatCard"',
    'import { TrendingUp } from "lucide-react"',
  ],
  id: 'stat-card',
}

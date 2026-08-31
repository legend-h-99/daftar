// url=https://www.figma.com/design/PquxMKpzcPo1kqDH4Z5Tx6/daftar?node-id=5-22
// source=components/ui/badge.tsx
// component=Badge
import figma from 'figma'

const instance = figma.selectedInstance

const variant = instance.getEnum('variant', {
  'Default': 'default',
  'Destructive': 'destructive',
  'Outline': 'outline',
  'Success': 'secondary',
})

const label = instance.findText('label')?.textContent ?? 'شارة'

export default {
  example: figma.code`<Badge variant="${variant}">${label}</Badge>`,
  imports: ['import { Badge } from "@/components/ui/badge"'],
  id: 'badge',
  metadata: { nestable: true },
}

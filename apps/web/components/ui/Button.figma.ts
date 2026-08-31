// url=https://www.figma.com/design/PquxMKpzcPo1kqDH4Z5Tx6/daftar?node-id=5-12
// source=components/ui/button.tsx
// component=Button
import figma from 'figma'

const instance = figma.selectedInstance

const variant = instance.getEnum('variant', {
  'Default': 'default',
  'Outline': 'outline',
  'Ghost': 'ghost',
  'Destructive': 'destructive',
})

const label = instance.findText('label')?.textContent ?? 'زر'

export default {
  example: figma.code`<Button variant="${variant}">${label}</Button>`,
  imports: ['import { Button } from "@/components/ui/button"'],
  id: 'button',
  metadata: { nestable: true },
}

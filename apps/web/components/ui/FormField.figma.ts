// url=https://www.figma.com/design/PquxMKpzcPo1kqDH4Z5Tx6/daftar?node-id=5-59
// source=components/ui/form-field.tsx
// component=FormField
import figma from 'figma'

const instance = figma.selectedInstance

const state = instance.getEnum('state', {
  'Default':  'default',
  'Focused':  'focused',
  'Disabled': 'disabled',
})

const label = instance.findText('label')?.textContent ?? 'الحقل'

export default {
  example: figma.code`
<FormField
  label="${label}"
  ${state === 'disabled' ? 'disabled' : ''}
/>`,
  imports: ['import { FormField } from "@/components/ui/form-field"'],
  id: 'form-field',
}

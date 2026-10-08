// Pakkmaxx: "AI Briefing" tab on the Lead page, served by the verzchat_crm app (VerzChat's AI briefing).
// Shown only when that app reports the integration is enabled; any error (app not installed) hides it.
import { createResource } from 'frappe-ui'
import { ref } from 'vue'

export const aiBriefingEnabled = ref(false)

createResource({
  url: 'verzchat_crm.briefing.is_enabled',
  cache: 'Is AI Briefing Enabled',
  auto: true,
  onSuccess: (data) => {
    aiBriefingEnabled.value = Boolean(data)
  },
  onError: () => {
    aiBriefingEnabled.value = false
  },
})

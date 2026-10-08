// Pakkmaxx: "AI Briefing" tab on the Lead page, served by the verzchat_crm app (VerzChat's AI briefing).
// Shown only when that app reports the integration is enabled; any error (app not installed) hides it.
import { call, createResource } from 'frappe-ui'
import { reactive, ref } from 'vue'

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

// One briefing state per lead, shared by every mounted AI Briefing view of that lead (the CRM can mount the
// tab content more than once). Only this module talks to the server: it loads the stored briefing, asks for
// a new one when the server says it is missing or out of date (once per lead + conversation state), and
// follows a generation until it finishes — so every view shows the same "Preparing…" and result.
const briefings = reactive({})

function setState(lead, data) {
  const s = briefings[lead]
  s.data = data
  s.loading = false
}

function stopWatching(lead) {
  const s = briefings[lead]
  s.generating = false
  clearTimeout(s.timer)
  s.timer = null
}

function watchUntilDone(lead, tries = 40) {
  const s = briefings[lead]
  s.generating = true
  clearTimeout(s.timer)
  if (tries <= 0) return stopWatching(lead)
  s.timer = setTimeout(async () => {
    const data = await call('verzchat_crm.briefing.get_briefing', { lead }).catch(() => null)
    if (data && data.status !== 'Generating') {
      setState(lead, data)
      s.requested.add(`${data.conversation_at || ''}`) // the server decided for this conversation state
      stopWatching(lead)
    } else {
      watchUntilDone(lead, tries - 1)
    }
  }, 3000)
}

async function ensure(lead) {
  const s = briefings[lead]
  s.generating = true // "Preparing…" at once
  try {
    const data = await call('verzchat_crm.briefing.ensure_briefing', { lead })
    setState(lead, data)
    if (data?.status === 'Generating') watchUntilDone(lead)
    else stopWatching(lead)
  } catch (e) {
    stopWatching(lead) // e.g. rate limited: keep what we have, never retry in a loop
  }
}

function handle(lead, data) {
  const s = briefings[lead]
  setState(lead, data)
  if (data?.status === 'Generating') return watchUntilDone(lead)
  if (!s.timer) s.generating = false
  const key = `${data?.conversation_at || ''}`
  if (data?.auto_generate && !s.requested.has(key)) {
    s.requested.add(key)
    ensure(lead)
  }
}

export function loadBriefing(lead, { force = false } = {}) {
  if (!briefings[lead]) {
    briefings[lead] = { data: null, loading: false, error: '', generating: false, timer: null, fetchedAt: 0, requested: new Set() }
  }
  const s = briefings[lead]
  // views mounted together share one request; opening the lead again later re-checks freshness (cheap read)
  if (s.loading || (!force && s.fetchedAt && Date.now() - s.fetchedAt < 5000) || s.timer) return s
  s.fetchedAt = Date.now()
  s.loading = !s.data
  s.error = ''
  call('verzchat_crm.briefing.get_briefing', { lead })
    .then((data) => handle(lead, data))
    .catch((e) => {
      s.loading = false
      s.error = e?.messages?.[0] || __('Could not load the AI briefing')
    })
  return s
}

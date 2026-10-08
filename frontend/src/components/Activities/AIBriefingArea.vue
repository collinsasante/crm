<!-- Pakkmaxx: VerzChat's AI briefing for this lead (verzchat_crm.briefing), in Frappe CRM's own styles
     (prose-f, EmptyState, LoadingIndicator, text tokens). No buttons: the stored briefing is shown, and a new
     one is generated automatically only when the server says it is missing or out of date. The HTML is
     rendered and sanitised on the server and passed through sanitizeHTML() again here. -->
<!-- eslint-disable vue/no-v-html -->
<template>
  <div
    v-if="briefing.loading && !briefing.data"
    class="flex flex-1 flex-col items-center justify-center gap-3 text-2xl-medium text-ink-gray-4"
  >
    <LoadingIndicator class="h-6 w-6" />
    <span>{{ __('Loading...') }}</span>
  </div>
  <EmptyState
    v-else-if="loadError"
    name="AI Briefing"
    :title="__('AI briefing unavailable')"
    :description="loadError"
    :icon="SparkleIcon"
  />
  <div v-else-if="b.html" class="px-3 pb-5 sm:px-10">
    <div v-if="generating" class="mb-3 flex items-center gap-2 text-p-sm text-ink-gray-5">
      <LoadingIndicator class="h-4 w-4" />
      <span>{{ __('Updating with the latest messages…') }}</span>
    </div>
    <div v-else-if="b.status == 'Failed'" class="mb-3 text-p-sm text-ink-red-4">
      {{ __('Could not update the briefing: {0}', [b.error || __('unknown error')]) }}
    </div>
    <div v-if="b.is_fallback" class="mb-3 text-p-sm text-ink-gray-5">
      {{ __('Basic summary only: the VerzChat AI was unavailable when this was generated.') }}
    </div>
    <div
      class="prose-f prose-sm max-w-none text-ink-gray-8 [overflow-wrap:break-word] [word-break:normal]"
      v-html="sanitizeHTML(b.html)"
    />
    <div class="mt-4 text-p-sm text-ink-gray-5">
      {{ __('Generated {0}', [b.generated_at_display || '']) }}
      <span v-if="b.generated_by"> · {{ __('requested by {0}', [b.generated_by]) }}</span>
      · {{ __('from VerzChat') }}
    </div>
  </div>
  <div
    v-else-if="generating"
    class="flex flex-1 flex-col items-center justify-center gap-3 text-ink-gray-5"
  >
    <LoadingIndicator class="h-6 w-6 text-ink-gray-4" />
    <span class="text-lg-medium text-ink-gray-8">{{ __('Preparing the AI briefing') }}</span>
    <span class="text-center text-p-base text-ink-gray-6">
      {{ __('Reading the WhatsApp conversation… this can take up to a minute.') }}
    </span>
  </div>
  <EmptyState
    v-else-if="b.status == 'Failed'"
    name="AI Briefing"
    :title="__('AI briefing unavailable')"
    :description="b.error || __('Please try again later.')"
    :icon="SparkleIcon"
  />
  <EmptyState
    v-else
    name="AI Briefing"
    :title="__('No AI briefing yet')"
    :description="__('It is prepared automatically once this lead has a WhatsApp conversation.')"
    :icon="SparkleIcon"
  />
</template>

<script setup>
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import SparkleIcon from '@/components/Icons/SparkleIcon.vue'
import { sanitizeHTML } from '@/utils'
import { globalStore } from '@/stores/global'
import { call, createResource } from 'frappe-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  docname: { type: String, required: true },
})

// Lead + conversation state for which this browser session already asked for a new briefing. With the
// server-side checks (freshness, one generation per lead, rate limit) this keeps re-renders and tab switches
// from re-asking, while new customer messages (a new conversation_at) allow one new check.
const requested = (window.__pkxBriefingRequested ||= new Set())

const { $socket } = globalStore()
const generating = ref(false)
let timer = null

const briefing = createResource({
  url: 'verzchat_crm.briefing.get_briefing',
  params: { lead: props.docname },
  cache: ['ai_briefing', props.docname],
  auto: true,
  onSuccess: (data) => handle(data),
})

const b = computed(() => briefing.data || {})
const loadError = computed(() =>
  briefing.error ? briefing.error.messages?.[0] || __('Could not load the AI briefing') : '',
)

function handle(data) {
  if (data?.status === 'Generating') return watchUntilDone()
  stopWatching()
  const key = `${props.docname}|${data?.conversation_at || ''}`
  if (data?.auto_generate && !requested.has(key)) {
    requested.add(key)
    generating.value = true // show "Preparing…" at once, not a momentary "No AI briefing yet"
    ensure()
  }
}

async function ensure() {
  try {
    const data = await call('verzchat_crm.briefing.ensure_briefing', { lead: props.docname })
    briefing.setData(data)
    if (data?.status === 'Generating') watchUntilDone()
  } catch (e) {
    // e.g. rate limited or VerzChat disabled: keep showing what we have, never retry in a loop
    stopWatching()
  }
}

function stopWatching() {
  generating.value = false
  if (timer) clearTimeout(timer)
  timer = null
}

function watchUntilDone(tries = 40) {
  generating.value = true
  if (timer) clearTimeout(timer)
  if (tries <= 0) return stopWatching()
  timer = setTimeout(async () => {
    const data = await call('verzchat_crm.briefing.get_briefing', { lead: props.docname }).catch(() => null)
    if (data && data.status !== 'Generating') {
      briefing.setData(data)
      requested.add(`${props.docname}|${data.conversation_at || ''}`) // the server decided for this state
      stopWatching()
    } else {
      watchUntilDone(tries - 1)
    }
  }, 3000)
}

function onReady(data) {
  if (data?.lead === props.docname) briefing.reload()
}

onMounted(() => $socket.on('verzchat_briefing', onReady))
onBeforeUnmount(() => {
  $socket.off('verzchat_briefing', onReady)
  stopWatching()
})
</script>

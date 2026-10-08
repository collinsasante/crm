<!-- Pakkmaxx: VerzChat's AI briefing for this lead (verzchat_crm.briefing). The HTML is rendered and
     sanitised on the server and passed through sanitizeHTML() again here. -->
<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="flex h-full flex-col px-3 pb-5 sm:px-10">
    <!-- the tab header above already shows the "AI Briefing" title -->
    <div class="mb-3 flex items-center justify-end">
      <Button
        v-if="b.can_generate"
        :variant="b.html ? 'subtle' : 'solid'"
        :label="b.html ? __('Refresh briefing') : __('Generate briefing')"
        :loading="generating"
        :disabled="generating"
        @click="generate"
      />
    </div>
    <div v-if="briefing.loading && !briefing.data" class="flex flex-1 items-center justify-center gap-3 text-ink-gray-4">
      <LoadingIndicator class="h-5 w-5" />
    </div>
    <template v-else>
      <div v-if="generating" class="mb-3 rounded bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-7">
        {{ __('Generating a new briefing from the WhatsApp conversation… this can take up to a minute.') }}
      </div>
      <div v-if="b.status == 'Failed'" class="mb-3 rounded bg-surface-red-1 px-3 py-2 text-sm text-ink-red-4">
        {{ __('Last attempt failed: {0}', [b.error || __('unknown error')]) }}
      </div>
      <div v-if="b.stale" class="mb-3 rounded bg-surface-amber-1 px-3 py-2 text-sm text-ink-amber-4">
        {{ __('New messages arrived after this briefing. Refresh to include them.') }}
      </div>
      <div v-if="b.is_fallback" class="mb-3 rounded bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-7">
        {{ __('Basic summary only: the VerzChat AI was unavailable when this was generated.') }}
      </div>
      <div v-if="b.html">
        <div class="prose prose-sm max-w-none text-ink-gray-8" v-html="sanitizeHTML(b.html)" />
        <div class="mt-4 text-xs text-ink-gray-5">
          {{ __('Generated {0}', [b.generated_at_display || '']) }}
          <span v-if="b.generated_by">· {{ __('requested by {0}', [b.generated_by]) }}</span>
          · {{ __('from VerzChat') }}
        </div>
      </div>
      <div v-else-if="!generating && b.status != 'Generating'" class="flex flex-1 flex-col items-center justify-center gap-2 text-ink-gray-5">
        <SparkleIcon class="h-8 w-8 text-ink-gray-4" />
        <div class="text-base">{{ briefing.error ? errorText : __('No AI briefing yet for this lead.') }}</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import SparkleIcon from '@/components/Icons/SparkleIcon.vue'
import { sanitizeHTML } from '@/utils'
import { globalStore } from '@/stores/global'
import { Button, LoadingIndicator, call, createResource, toast } from 'frappe-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  docname: { type: String, required: true },
})

const { $socket } = globalStore()
const generating = ref(false)
let timer = null

const briefing = createResource({
  url: 'verzchat_crm.briefing.get_briefing',
  params: { lead: props.docname },
  cache: ['ai_briefing', props.docname],
  auto: true,
  onSuccess: (data) => {
    if (data?.status === 'Generating') return watchUntilDone()
    stopWatching()
  },
})

const b = computed(() => briefing.data || {})
const errorText = computed(() => briefing.error?.messages?.[0] || __('Could not load the AI briefing'))

function stopWatching() {
  generating.value = false
  if (timer) clearTimeout(timer)
  timer = null
}

function watchUntilDone(tries = 40) {
  generating.value = true
  if (timer) clearTimeout(timer)
  if (tries <= 0) {
    stopWatching()
    toast.error(__('The AI briefing is taking too long; try again later'))
    return
  }
  timer = setTimeout(async () => {
    const data = await call('verzchat_crm.briefing.get_briefing', { lead: props.docname }).catch(() => null)
    if (data && data.status !== 'Generating') {
      briefing.setData(data)
      stopWatching()
    } else {
      watchUntilDone(tries - 1)
    }
  }, 3000)
}

async function generate() {
  try {
    const data = await call('verzchat_crm.briefing.generate_briefing', { lead: props.docname })
    briefing.setData(data)
    watchUntilDone()
  } catch (e) {
    toast.error(e?.messages?.[0] || __('Could not start the AI briefing'))
  }
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

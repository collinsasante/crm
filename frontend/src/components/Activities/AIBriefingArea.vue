<!-- Pakkmaxx: VerzChat's AI briefing for this lead (verzchat_crm.briefing), in Frappe CRM's own styles
     (prose-f, EmptyState, LoadingIndicator, text tokens). The stored briefing is shown, and a new
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
    <div v-else-if="b.status == 'Failed'" class="mb-3 flex flex-wrap items-center gap-2 text-p-sm text-ink-red-4">
      <span>{{ __('Could not update the briefing: {0}', [b.error || __('unknown error')]) }}</span>
      <Button v-if="b.can_retry" variant="ghost" size="sm" :label="__('Try again')" @click="retry" />
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
  <!-- same markup/classes as Frappe CRM's EmptyState, which cannot hold a button -->
  <div v-else-if="b.status == 'Failed'" class="relative flex h-full w-full justify-center">
    <div class="absolute left-1/2 top-[35%] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-3 px-4">
      <SparkleIcon class="size-7.5 text-ink-gray-5" />
      <div class="flex flex-col items-center gap-1">
        <span class="text-lg-medium text-ink-gray-8">{{ __('AI briefing unavailable') }}</span>
        <span class="text-center text-p-base text-ink-gray-6">{{ b.error || __('Please try again later.') }}</span>
      </div>
      <Button v-if="b.can_retry" variant="subtle" :label="__('Try again')" @click="retry" />
    </div>
  </div>
  <EmptyState
    v-else-if="b.status == 'No Conversation'"
    name="AI Briefing"
    :title="__('No WhatsApp conversation')"
    :description="__('The AI briefing is prepared from the lead\'s WhatsApp conversation. Start one from the WhatsApp Chat tab.')"
    :icon="SparkleIcon"
  />
  <EmptyState
    v-else-if="b.status == 'No Messages'"
    name="AI Briefing"
    :title="__('No WhatsApp messages yet')"
    :description="__('The briefing is prepared automatically once the conversation has messages.')"
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
import { loadBriefing, retryBriefing } from '@/composables/aiBriefing'
import { sanitizeHTML } from '@/utils'
import { globalStore } from '@/stores/global'
import { Button } from 'frappe-ui'
import { computed, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  docname: { type: String, required: true },
})

// Shared per-lead state (see composables/aiBriefing.js): every mounted view shows the same thing.
const state = loadBriefing(props.docname)
const briefing = computed(() => ({ loading: state.loading, data: state.data }))
const b = computed(() => state.data || {})
const generating = computed(() => state.generating)
const loadError = computed(() => state.error)
const retry = () => retryBriefing(props.docname)

const { $socket } = globalStore()
function onReady(data) {
  if (data?.lead === props.docname) loadBriefing(props.docname, { force: true })
}
onMounted(() => $socket.on('verzchat_briefing', onReady))
onBeforeUnmount(() => $socket.off('verzchat_briefing', onReady))
</script>

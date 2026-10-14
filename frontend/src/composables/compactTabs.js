// Pakkmaxx: the Lead/Deal tab bar has more tabs than fit on a laptop screen (they scrolled out of view).
// When the labels do not fit, inactive tabs show only their icon (label as tooltip); the selected tab keeps
// its label. Wide screens are unchanged. Applied by adding the `pkx-compact-tabs` class to the Tabs root.
import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useCompactTabs(rootRef) {
  const compact = ref(false)
  let fullWidth = 0 // width the tab bar needs with every label shown (measured while not compact)
  let observer = null

  function tablist() {
    return rootRef.value?.$el?.querySelector?.('[role="tablist"]') || rootRef.value?.querySelector?.('[role="tablist"]')
  }

  function update() {
    const list = tablist()
    if (!list) return
    for (const tab of list.querySelectorAll('[role="tab"]')) {
      if (!tab.title) tab.title = tab.textContent.trim()
    }
    if (!compact.value) fullWidth = list.scrollWidth
    // small margin so it does not flip back and forth at the edge
    compact.value = fullWidth > list.clientWidth + 4
  }

  onMounted(() => {
    observer = new ResizeObserver(() => requestAnimationFrame(update))
    const tryObserve = () => {
      const list = tablist()
      if (!list) return setTimeout(tryObserve, 200)
      observer.observe(list)
      update()
    }
    tryObserve()
  })
  onBeforeUnmount(() => observer?.disconnect())

  return { compact, update }
}

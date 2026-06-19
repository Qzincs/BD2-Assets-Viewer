<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  AudioLines,
  ChevronUp,
  LockKeyhole,
  LockKeyholeOpen,
  Pause,
  Play,
  RotateCcw,
} from '@lucide/vue'
import type { PlayerAnimationOption } from '@/player/spine/types'

const props = withDefaults(
  defineProps<{
    animationOptions?: PlayerAnimationOption[]
    selectedAnimationId?: string
    isPlaying?: boolean
    progress?: number
    cameraModeEnabled?: boolean
    voiceLibraryOpen?: boolean
  }>(),
  {
    animationOptions: () => [
      {
        id: 'idle',
        label: 'idle',
        type: 'single',
        animationName: 'idle',
        loop: true,
      },
    ],
    selectedAnimationId: 'idle',
    isPlaying: false,
    progress: 0.33,
    cameraModeEnabled: false,
    voiceLibraryOpen: false,
  },
)

const emit = defineEmits<{
  playChange: [isPlaying: boolean]
  progressChange: [progress: number]
  progressDragStart: []
  progressDragEnd: []
  animationChange: [option: PlayerAnimationOption]
  speedChange: [speed: number]
  cameraModeChange: [enabled: boolean]
  voiceLibraryToggle: []
  resetView: []
}>()

const playbackSpeedOptions = [0.25, 0.5, 1, 1.25, 1.5, 2]

const selectedAnimationId = ref(props.selectedAnimationId)
const focusedAnimationId = ref(props.selectedAnimationId)
const animationSearchQuery = ref('')
const animationMenuOpen = ref(false)
const speedMenuOpen = ref(false)
const playbackSpeed = ref(1)
const cameraModeEnabled = ref(props.cameraModeEnabled)
const isPlaying = ref(props.isPlaying)
const progress = ref(props.progress)
const hoverProgress = ref(props.progress)
const timelineHovering = ref(false)
const timelineDragging = ref(false)
const animationMenuRef = ref<HTMLElement | null>(null)
const speedMenuRef = ref<HTMLElement | null>(null)
const timelineRef = ref<HTMLElement | null>(null)
const animationSearchInputRef = ref<HTMLInputElement | null>(null)
const animationOptionElements = new Map<string, HTMLElement>()

const showTimelinePreview = computed(() => {
  return timelineHovering.value && !timelineDragging.value && hoverProgress.value > progress.value
})

const selectedAnimationLabel = computed(() => {
  return (
    props.animationOptions.find((option) => option.id === selectedAnimationId.value)?.label ??
    selectedAnimationId.value
  )
})

const filteredAnimationOptions = computed(() => {
  const query = animationSearchQuery.value.trim().toLowerCase()

  if (!query) return props.animationOptions

  return props.animationOptions.filter((option) => {
    return option.id.toLowerCase().includes(query) || option.label.toLowerCase().includes(query)
  })
})

const focusedAnimationIndex = computed(() => {
  return filteredAnimationOptions.value.findIndex((option) => {
    return option.id === focusedAnimationId.value
  })
})

watch(
  () => props.selectedAnimationId,
  (nextAnimationId) => {
    selectedAnimationId.value = nextAnimationId

    if (animationMenuOpen.value) {
      focusedAnimationId.value = nextAnimationId
      scrollFocusedAnimationIntoView()
    }
  },
)

watch(
  () => props.isPlaying,
  (nextIsPlaying) => {
    isPlaying.value = nextIsPlaying
  },
)

watch(
  () => props.cameraModeEnabled,
  (nextCameraModeEnabled) => {
    cameraModeEnabled.value = nextCameraModeEnabled
  },
)

watch(
  () => props.progress,
  (nextProgress) => {
    if (timelineDragging.value) return

    progress.value = nextProgress
    hoverProgress.value = nextProgress
  },
)

watch(animationMenuOpen, (isOpen) => {
  if (!isOpen) {
    animationSearchQuery.value = ''
    return
  }

  focusedAnimationId.value = selectedAnimationId.value
  focusAnimationSearchInput()
  scrollFocusedAnimationIntoView()
})

watch(filteredAnimationOptions, (nextOptions) => {
  if (!animationMenuOpen.value) return

  if (nextOptions.some((option) => option.id === focusedAnimationId.value)) {
    scrollFocusedAnimationIntoView()
    return
  }

  focusedAnimationId.value = nextOptions[0]?.id ?? ''
  scrollFocusedAnimationIntoView()
})

function togglePlayback() {
  isPlaying.value = !isPlaying.value
  emit('playChange', isPlaying.value)
}

function selectAnimation(option: PlayerAnimationOption) {
  selectedAnimationId.value = option.id
  animationMenuOpen.value = false
  emit('animationChange', option)
}

function selectPlaybackSpeed(speed: number) {
  playbackSpeed.value = speed
  speedMenuOpen.value = false
  emit('speedChange', speed)
}

function toggleCameraMode() {
  cameraModeEnabled.value = !cameraModeEnabled.value
  emit('cameraModeChange', cameraModeEnabled.value)
}

function closeMenusOnOutsideClick(event: MouseEvent) {
  const target = event.target

  if (!(target instanceof Node)) return

  if (!animationMenuRef.value?.contains(target)) {
    animationMenuOpen.value = false
  }

  if (!speedMenuRef.value?.contains(target)) {
    speedMenuOpen.value = false
  }
}

function closeAnimationMenuOnEscape(event: KeyboardEvent) {
  if (!animationMenuOpen.value || event.key !== 'Escape') return

  animationMenuOpen.value = false
}

function handleAnimationMenuKeydown(event: KeyboardEvent) {
  if (!animationMenuOpen.value) return

  switch (event.key) {
    case 'Escape':
      animationMenuOpen.value = false
      speedMenuOpen.value = false
      break

    case 'ArrowUp':
      event.preventDefault()
      focusRelativeAnimation(-1)
      break

    case 'ArrowDown':
      event.preventDefault()
      focusRelativeAnimation(1)
      break

    case 'Enter': {
      event.preventDefault()

      const focusedOption = filteredAnimationOptions.value.find((option) => {
        return option.id === focusedAnimationId.value
      })

      if (focusedOption) {
        selectAnimation(focusedOption)
      }

      break
    }
  }
}

function focusRelativeAnimation(offset: number) {
  if (filteredAnimationOptions.value.length === 0) return

  const currentIndex = focusedAnimationIndex.value >= 0 ? focusedAnimationIndex.value : 0
  const nextIndex =
    (currentIndex + offset + filteredAnimationOptions.value.length) %
    filteredAnimationOptions.value.length

  focusedAnimationId.value =
    filteredAnimationOptions.value[nextIndex]?.id ?? focusedAnimationId.value
  scrollFocusedAnimationIntoView()
}

function setAnimationOptionElement(optionId: string, element: unknown) {
  if (element instanceof HTMLElement) {
    animationOptionElements.set(optionId, element)
  } else {
    animationOptionElements.delete(optionId)
  }
}

async function scrollFocusedAnimationIntoView() {
  await nextTick()

  animationOptionElements.get(focusedAnimationId.value)?.scrollIntoView({
    block: 'nearest',
  })
}

async function focusAnimationSearchInput() {
  await nextTick()

  animationSearchInputRef.value?.focus()
}

function getTimelineProgress(event: PointerEvent) {
  const rect = timelineRef.value?.getBoundingClientRect()
  if (!rect) return progress.value

  const rawProgress = (event.clientX - rect.left) / rect.width
  return Math.min(1, Math.max(0, rawProgress))
}

function setProgress(nextProgress: number) {
  progress.value = nextProgress
  emit('progressChange', nextProgress)
}

function updateTimelineProgress(event: PointerEvent) {
  const nextProgress = getTimelineProgress(event)

  hoverProgress.value = nextProgress

  if (timelineDragging.value) {
    setProgress(nextProgress)
  }
}

function startTimelineDrag(event: PointerEvent) {
  timelineDragging.value = true
  timelineHovering.value = true
  emit('progressDragStart')
  setProgress(getTimelineProgress(event))
  hoverProgress.value = progress.value

  window.addEventListener('pointermove', updateTimelineProgress)
  window.addEventListener('pointerup', stopTimelineDrag)
}

function stopTimelineDrag(event?: PointerEvent) {
  if (event) {
    setProgress(getTimelineProgress(event))
  }

  timelineDragging.value = false
  hoverProgress.value = progress.value
  emit('progressDragEnd')

  if (event) {
    const rect = timelineRef.value?.getBoundingClientRect()

    timelineHovering.value =
      !!rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
  } else {
    timelineHovering.value = false
  }

  window.removeEventListener('pointermove', updateTimelineProgress)
  window.removeEventListener('pointerup', stopTimelineDrag)
}

function leaveTimeline() {
  if (timelineDragging.value) return

  timelineHovering.value = false
}

onMounted(() => {
  document.addEventListener('click', closeMenusOnOutsideClick)
  document.addEventListener('keydown', handleAnimationMenuKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenusOnOutsideClick)
  document.removeEventListener('keydown', handleAnimationMenuKeydown)
  window.removeEventListener('pointermove', updateTimelineProgress)
  window.removeEventListener('pointerup', stopTimelineDrag)
})
</script>

<template>
  <div
    class="absolute left-0 right-0 bottom-0 border-t border-white/10 bg-black/50 text-white backdrop-blur-md"
  >
    <button
      ref="timelineRef"
      class="group absolute -top-1 left-0 z-10 h-3 w-full cursor-pointer touch-none"
      type="button"
      title="Seek"
      aria-label="Timeline"
      @pointerenter="timelineHovering = true"
      @pointermove="updateTimelineProgress"
      @pointerleave="leaveTimeline"
      @pointerdown.prevent="startTimelineDrag"
    >
      <span
        class="absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 overflow-hidden bg-white/15 transition-[height] duration-150 group-hover:h-2"
      >
        <span
          v-if="showTimelinePreview"
          class="absolute h-full bg-white/35"
          :style="{
            left: `${progress * 100}%`,
            width: `${(hoverProgress - progress) * 100}%`,
          }"
        ></span>
        <span
          class="absolute top-0 left-0 h-full bg-white/75 transition-colors group-hover:bg-white"
          :style="{ width: `${progress * 100}%` }"
        ></span>
      </span>
      <span
        v-if="timelineDragging"
        class="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
        :style="{ left: `${progress * 100}%` }"
      ></span>
    </button>

    <div class="flex h-14 items-center justify-between px-5 pt-2">
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95"
        type="button"
        :title="isPlaying ? 'Pause' : 'Play'"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlayback"
      >
        <Pause v-if="isPlaying" class="h-4 w-4" />
        <Play v-else class="h-4 w-4 fill-current" />
      </button>

      <div class="flex items-center gap-2">
        <div ref="animationMenuRef" class="relative">
          <button
            class="flex h-9 w-40 items-center justify-between rounded-md px-3 text-sm text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
            type="button"
            title="Select animation"
            aria-haspopup="listbox"
            :aria-expanded="animationMenuOpen"
            @click="animationMenuOpen = !animationMenuOpen"
          >
            <span class="truncate">{{ selectedAnimationLabel }}</span>
            <ChevronUp class="h-4 w-4 text-white/50" />
          </button>

          <div
            v-if="animationMenuOpen"
            class="absolute right-0 bottom-11 z-10 max-h-[min(18rem,calc(100dvh-6rem))] w-48 overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-black/75 shadow-xl backdrop-blur-md"
            role="listbox"
            :aria-activedescendant="`animation-option-${focusedAnimationId}`"
          >
            <div
              class="sticky top-0 z-10 border-b border-white/10 bg-black/80 p-2 backdrop-blur-md"
            >
              <input
                ref="animationSearchInputRef"
                v-model="animationSearchQuery"
                class="h-8 w-full rounded-md bg-white/10 px-2 text-sm text-white outline-none placeholder:text-white/35 focus:bg-white/15"
                type="search"
                placeholder="Search animations"
                aria-label="Search animations"
                @keydown.stop="handleAnimationMenuKeydown"
              />
            </div>

            <button
              v-for="animationOption in filteredAnimationOptions"
              :key="animationOption.id"
              :ref="(element) => setAnimationOptionElement(animationOption.id, element)"
              :id="`animation-option-${animationOption.id}`"
              class="w-full truncate px-3 py-2 text-left text-sm transition hover:bg-white/10"
              :class="{
                'bg-white/15 text-white': animationOption.id === focusedAnimationId,
                'text-white': animationOption.id === selectedAnimationId,
                'text-white/70': animationOption.id !== selectedAnimationId,
              }"
              type="button"
              role="option"
              :aria-selected="animationOption.id === selectedAnimationId"
              @mouseenter="focusedAnimationId = animationOption.id"
              @click="selectAnimation(animationOption)"
            >
              {{ animationOption.label }}
            </button>

            <div
              v-if="filteredAnimationOptions.length === 0"
              class="px-3 py-4 text-center text-sm text-white/45"
            >
              No animations found
            </div>
          </div>
        </div>

        <div ref="speedMenuRef" class="relative">
          <button
            class="h-9 rounded-md px-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
            type="button"
            title="Playback speed"
            aria-haspopup="listbox"
            :aria-expanded="speedMenuOpen"
            aria-label="Playback speed"
            @click="speedMenuOpen = !speedMenuOpen"
          >
            {{ playbackSpeed.toFixed(2) }}x
          </button>

          <div
            v-if="speedMenuOpen"
            class="absolute right-0 bottom-11 z-10 w-24 overflow-hidden rounded-lg border border-white/10 bg-black/75 py-1 shadow-xl backdrop-blur-md"
            role="listbox"
          >
            <button
              v-for="speedOption in playbackSpeedOptions"
              :key="speedOption"
              class="w-full px-3 py-2 text-left text-sm transition hover:bg-white/10"
              :class="speedOption === playbackSpeed ? 'bg-white/15 text-white' : 'text-white/70'"
              type="button"
              role="option"
              :aria-selected="speedOption === playbackSpeed"
              @click="selectPlaybackSpeed(speedOption)"
            >
              {{ speedOption.toFixed(2) }}x
            </button>
          </div>
        </div>

        <button
          class="flex h-9 w-9 items-center justify-center rounded-full text-xl text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95"
          type="button"
          :aria-pressed="props.voiceLibraryOpen"
          title="Voice library"
          aria-label="Toggle voice library"
          @click="emit('voiceLibraryToggle')"
        >
          <AudioLines class="h-4 w-4" />
        </button>

        <button
          class="flex h-9 w-9 items-center justify-center rounded-full text-xl text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95"
          type="button"
          :aria-pressed="cameraModeEnabled"
          :title="cameraModeEnabled ? 'Lock camera' : 'Unlock camera'"
          :aria-label="cameraModeEnabled ? 'Lock camera' : 'Unlock camera'"
          @click="toggleCameraMode"
        >
          <LockKeyholeOpen v-if="cameraModeEnabled" class="h-4 w-4" />
          <LockKeyhole v-else class="h-4 w-4" />
        </button>

        <button
          class="flex h-9 w-9 items-center justify-center rounded-full text-xl text-white/75 transition hover:bg-white/10 hover:text-white active:scale-95"
          type="button"
          title="Reset view"
          aria-label="Reset view"
          @click="emit('resetView')"
        >
          <RotateCcw class="h-4 w-4" />
        </button>

        <slot name="extra-actions"></slot>
      </div>
    </div>
  </div>
</template>

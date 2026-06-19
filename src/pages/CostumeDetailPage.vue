<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import PlayerControls from '@/components/player/PlayerControls.vue'
import PixiStage from '@/components/player/PixiStage.vue'
import type { PlayerAnimationOption } from '@/player/spine/types'

const props = defineProps<{
    costumeId: string
}>()

const stageRef = ref<InstanceType<typeof PixiStage> | null>(null)
const animationOptions = ref<PlayerAnimationOption[]>([])
const selectedAnimationId = ref('idle')
const isPlaying = ref(true)
const progress = ref(0)
const playbackSpeed = ref(1)
const cameraModeEnabled = ref(false)

let progressFrameId: number | null = null
let wasPlayingBeforeProgressDrag = false

/**
 * Reads the current player state after a Spine asset has been loaded.
 */
function syncPlayerState() {
    const stage = stageRef.value
    if (!stage) return

    const options = stage.getMenuAnimationOptions()

    animationOptions.value = options
    selectedAnimationId.value = stage.getCurrentAnimationOptionId()
        ?? options[0]?.id
        ?? 'idle'
    progress.value = stage.getProgress()
}

/**
 * Keeps the controls timeline in sync with the active Spine player.
 */
function startProgressLoop() {
    stopProgressLoop()

    const tick = () => {
        const stage = stageRef.value

        progress.value = stage?.getProgress() ?? progress.value
        selectedAnimationId.value = stage?.getCurrentAnimationOptionId() ?? selectedAnimationId.value
        progressFrameId = window.requestAnimationFrame(tick)
    }

    progressFrameId = window.requestAnimationFrame(tick)
}

/**
 * Stops the controls timeline update loop.
 */
function stopProgressLoop() {
    if (progressFrameId === null) return

    window.cancelAnimationFrame(progressFrameId)
    progressFrameId = null
}

function handleStageReady() {
    syncPlayerState()
    startProgressLoop()
}

function handlePlayChange(nextIsPlaying: boolean) {
    isPlaying.value = nextIsPlaying

    if (nextIsPlaying) {
        stageRef.value?.resume()
        stageRef.value?.setSpeed(playbackSpeed.value)
    } else {
        stageRef.value?.pause()
    }
}

function handleAnimationChange(option: PlayerAnimationOption) {
    selectedAnimationId.value = option.id
    isPlaying.value = true
    progress.value = 0

    stageRef.value?.playOption(option)
    stageRef.value?.resume()
    stageRef.value?.setSpeed(playbackSpeed.value)
}

function handleProgressChange(nextProgress: number) {
    progress.value = nextProgress
    stageRef.value?.seekProgress(nextProgress)
}

function handleProgressDragStart() {
    wasPlayingBeforeProgressDrag = isPlaying.value
    stageRef.value?.pause()
}

function handleProgressDragEnd() {
    if (!wasPlayingBeforeProgressDrag) return

    stageRef.value?.resume()
    stageRef.value?.setSpeed(playbackSpeed.value)
}

function handleResetView() {
    stageRef.value?.resetView()
}

function handleSpeedChange(speed: number) {
    playbackSpeed.value = speed

    if (isPlaying.value) {
        stageRef.value?.setSpeed(speed)
    }
}

function handleCameraModeChange(enabled: boolean) {
    cameraModeEnabled.value = enabled
    stageRef.value?.setCameraModeEnabled(enabled)
}

onBeforeUnmount(() => {
    stopProgressLoop()
})
</script>

<template>
    <section class="h-[calc(100dvh-64px)] bg-[#10131a]">
        <div class="relative h-full w-full overflow-hidden">
            <PixiStage ref="stageRef" :costume-id="props.costumeId" @ready="handleStageReady" />

            <div class="absolute left-4 top-4 rounded bg-black/40 px-4 py-2 text-sm text-white backdrop-blur">
                Costume ID: {{ props.costumeId }}
            </div>

            <PlayerControls
                :animation-options="animationOptions"
                :selected-animation-id="selectedAnimationId"
                :is-playing="isPlaying"
                :progress="progress"
                :camera-mode-enabled="cameraModeEnabled"
                @play-change="handlePlayChange"
                @animation-change="handleAnimationChange"
                @progress-change="handleProgressChange"
                @progress-drag-start="handleProgressDragStart"
                @progress-drag-end="handleProgressDragEnd"
                @speed-change="handleSpeedChange"
                @camera-mode-change="handleCameraModeChange"
                @reset-view="handleResetView"
            />
        </div>
    </section>
</template>

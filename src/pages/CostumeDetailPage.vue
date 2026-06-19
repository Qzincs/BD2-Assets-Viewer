<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PlayerControls from '@/components/player/PlayerControls.vue'
import PixiStage from '@/components/player/PixiStage.vue'
import VoiceLibraryDrawer from '@/components/player/VoiceLibraryDrawer.vue'
import { voiceManifest } from '@/data/generated/voiceManifest'
import { VoicePlayer } from '@/player/audio/VoicePlayer'
import type { PlayerAnimationOption } from '@/player/spine/types'
import type { VoiceEntry } from '@/types/voice'

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
const voiceLibraryOpen = ref(false)
const currentVoiceId = ref<string>()
const voicePlayer = new VoicePlayer((voice) => {
    currentVoiceId.value = voice?.id
})

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

function toggleVoiceLibrary() {
    voiceLibraryOpen.value = !voiceLibraryOpen.value
}

function handleVoiceSelect(voice: VoiceEntry) {
    voicePlayer.play(voice)
}

/**
 * Replays the opening animation and a non-repeating BattleReady voice.
 */
function handleCharacterClick() {
    const openingOption = animationOptions.value.find((option) => {
        return option.id === 'opening'
    })

    if (openingOption) {
        handleAnimationChange(openingOption)
    }

    playBattleReadyVoice()
}

/**
 * Plays a random BattleReady voice for the current costume.
 */
function playBattleReadyVoice() {
    const costumeId = props.costumeId.toLowerCase()
    const battleReadyVoices = voiceManifest[costumeId]?.BattleReady ?? []

    voicePlayer.playRandom(battleReadyVoices)
}

watch(
    () => props.costumeId,
    () => {
        voicePlayer.destroy()
    },
)

onMounted(() => {
    playBattleReadyVoice()
})

onBeforeUnmount(() => {
    stopProgressLoop()
    voicePlayer.destroy()
})
</script>

<template>
    <section class="h-[calc(100dvh-64px)] bg-[#10131a]">
        <div class="relative h-full w-full overflow-hidden">
            <PixiStage
                ref="stageRef"
                :costume-id="props.costumeId"
                @ready="handleStageReady"
                @character-click="handleCharacterClick"
            />

            <div class="absolute left-4 top-4 rounded bg-black/40 px-4 py-2 text-sm text-white backdrop-blur">
                Costume ID: {{ props.costumeId }}
            </div>

            <VoiceLibraryDrawer
                :open="voiceLibraryOpen"
                :voices="voiceManifest[props.costumeId.toLowerCase()]"
                :current-voice-id="currentVoiceId"
                @close="voiceLibraryOpen = false"
                @voice-select="handleVoiceSelect"
            />

            <PlayerControls
                :animation-options="animationOptions"
                :selected-animation-id="selectedAnimationId"
                :is-playing="isPlaying"
                :progress="progress"
                :camera-mode-enabled="cameraModeEnabled"
                :voice-library-open="voiceLibraryOpen"
                @play-change="handlePlayChange"
                @animation-change="handleAnimationChange"
                @progress-change="handleProgressChange"
                @progress-drag-start="handleProgressDragStart"
                @progress-drag-end="handleProgressDragEnd"
                @speed-change="handleSpeedChange"
                @camera-mode-change="handleCameraModeChange"
                @voice-library-toggle="toggleVoiceLibrary"
                @reset-view="handleResetView"
            />
        </div>
    </section>
</template>

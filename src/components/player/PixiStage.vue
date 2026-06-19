<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SpinePlayer } from '@/player/spine/SpinePlayer'
import { spineLayoutOverrides } from '@/data/spineLayoutOverrides'
import { getCostumeSpineAsset } from '@/data/assetPaths'
import { generateAnimationOptionsFromRules } from '@/data/animationOptionRules'
import type { PlayerAnimationOption } from '@/player/spine/types'

const props = defineProps<{
    costumeId: string
}>()

const emit = defineEmits<{
    ready: []
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let player: SpinePlayer | null = null
let resizeObserver: ResizeObserver | null = null
let currentAnimationOptionId: string | undefined
let cameraModeEnabled = false
let cameraDragging = false
let lastCameraPointerX = 0
let lastCameraPointerY = 0


async function loadCurrentCostume() {
    if (!player) return

    stopCameraDrag()

    const asset = getCostumeSpineAsset(props.costumeId)
    const layout = spineLayoutOverrides[props.costumeId]

    await player.loadInstance('main', {
        asset,
        layout,
        zIndex: 0,
    })

    player.setCameraEnabled(cameraModeEnabled)
    player.resetCamera()
    player.setMix('main', 'motion', 'idle', 0.2)

    const openingOption = getAnimationOptions().find((option) => option.id === 'opening')

    if (openingOption) {
        playOption(openingOption)
    } else {
        playAnimation('idle', true)
    }

    console.log(`[Spine] ${props.costumeId} animations:`, player.getAnimationNames())
    emit('ready')
}

/**
 * Plays a high-level animation option on the main Spine instance.
 */
function playOption(option: PlayerAnimationOption) {
    if (!player) return

    currentAnimationOptionId = option.id
    player.clearTracks('main')

    switch (option.type) {
        case 'single':
            player.playAnimation('main', option.animationName, {
                loop: option.loop ?? false,
            })
            break

        case 'sequence':
            player.playSequence('main', option.animationNames, {
                loop: option.loop,
                loopLast: option.loopLast,
                next: option.next,
            })
            break

        case 'tracks':
            player.playTracks('main', option.tracks.map((track) => ({
                ...track,
                loop: option.loop ?? track.loop,
            })))
            break

        case 'composition':
            player.playComposition(option.composition)
            break
    }
}

/**
 * Plays one animation on the main Spine instance.
 */
function playAnimation(animationName: string, loop = true) {
    currentAnimationOptionId = animationName

    player?.clearTracks('main')
    player?.playAnimation('main', animationName, {
        loop,
    })
}

/**
 * Pauses the main Spine instance.
 */
function pause() {
    player?.pause('main')
}

/**
 * Resumes the main Spine instance.
 */
function resume() {
    player?.resume('main')
}

/**
 * Sets playback speed for the main Spine instance.
 */
function setSpeed(speed: number) {
    player?.setSpeed(speed, 'main')
}

/**
 * Enables or disables manual camera controls for the stage.
 *
 * This is a state hook for the next camera phase. Pointer and wheel handling
 * will be wired after the player has a dedicated camera layer.
 */
function setCameraModeEnabled(enabled: boolean) {
    cameraModeEnabled = enabled
    player?.setCameraEnabled(enabled)

    if (!enabled) {
        stopCameraDrag()
    }
}

/**
 * Returns whether manual camera controls are currently enabled.
 */
function getCameraModeEnabled(): boolean {
    return cameraModeEnabled
}

/**
 * Resets all loaded Spine instances to their configured layout.
 */
function resetView() {
    player?.resetView()
}

/**
 * Returns animation names from the main Spine instance.
 */
function getAnimationNames(): string[] {
    return player?.getAnimationNames('main') ?? []
}

/**
 * Returns playback options generated from the loaded Spine animations.
 *
 * Raw Spine animations become single-animation options. A small set of
 * higher-level options, such as opening, can be added on top when the required
 * source animations exist.
 */
function getAnimationOptions(): PlayerAnimationOption[] {
    const animationNames = getAnimationNames()
    const asset = getCostumeSpineAsset(props.costumeId)

    return [
        ...generateAnimationOptionsFromRules({
            costumeId: props.costumeId,
            asset,
            animationNames,
        }),
        ...animationNames.map(createSingleAnimationOption),
    ]
}

/**
 * Returns playback options that should be shown in the player dropdown.
 */
function getMenuAnimationOptions(): PlayerAnimationOption[] {
    return getAnimationOptions().filter((option) => option.showInMenu !== false)
}

/**
 * Returns the currently selected high-level playback option id.
 *
 * This is intentionally separate from the current raw Spine animation name.
 * For example, an opening option may internally play motion -> idle while the
 * controls should still display opening until a later playback state decides
 * to transition the UI to a follow-up option.
 */
function getCurrentAnimationOptionId(): string | undefined {
    const playbackState = player?.getPlaybackState('main')

    if (playbackState?.phase === 'next') {
        return findSingleAnimationOptionId(playbackState.currentAnimationName)
            ?? currentAnimationOptionId
    }

    return currentAnimationOptionId
}

/**
 * Finds the menu option id for a raw single animation.
 */
function findSingleAnimationOptionId(animationName: string | undefined): string | undefined {
    if (!animationName) return undefined

    return getMenuAnimationOptions().find((option) => {
        return option.type === 'single' && option.animationName === animationName
    })?.id
}

/**
 * Creates a single-animation playback option from a raw Spine animation name.
 */
function createSingleAnimationOption(animationName: string): PlayerAnimationOption {
    return {
        id: animationName,
        label: animationName,
        type: 'single',
        animationName,
        loop: shouldLoopRawAnimation(animationName),
    }
}

/**
 * Applies a conservative default loop heuristic for raw Spine animations.
 */
function shouldLoopRawAnimation(animationName: string): boolean {
    return true
}

/**
 * Returns the animation currently active on the main Spine instance.
 */
function getCurrentAnimation(): string | undefined {
    return player?.getCurrentAnimation('main')
}

/**
 * Returns normalized progress for the main Spine instance.
 */
function getProgress(): number {
    return player?.getProgress('main') ?? 0
}

/**
 * Returns runtime playback state from the main Spine instance.
 */
function getPlaybackState() {
    return player?.getPlaybackState('main')
}

/**
 * Seeks the main Spine instance to a normalized progress value.
 */
function seekProgress(progress: number) {
    player?.seekProgress(progress, 'main')
}

/**
 * Returns the logical playback duration for the main Spine instance.
 */
function getPlaybackDuration(): number {
    return player?.getPlaybackDuration('main') ?? 0
}

/**
 * Returns progress for the longest loaded Spine instance.
 */
function getLongestProgress(): number {
    return player?.getLongestProgress() ?? 0
}

/**
 * Seeks every loaded Spine instance to the same normalized progress.
 */
function seekAllProgress(progress: number) {
    player?.seekAllProgress(progress)
}

/**
 * Starts manual camera panning when camera mode is enabled.
 */
function startCameraDrag(event: PointerEvent) {
    if (!cameraModeEnabled) return

    cameraDragging = true
    lastCameraPointerX = event.clientX
    lastCameraPointerY = event.clientY

    window.addEventListener('pointermove', moveCameraDrag)
    window.addEventListener('pointerup', stopCameraDrag)
}

/**
 * Pans the camera by the pointer delta from the previous event.
 */
function moveCameraDrag(event: PointerEvent) {
    if (!cameraDragging) return

    const deltaX = event.clientX - lastCameraPointerX
    const deltaY = event.clientY - lastCameraPointerY

    player?.panCamera(deltaX, deltaY)

    lastCameraPointerX = event.clientX
    lastCameraPointerY = event.clientY
}

/**
 * Stops an active camera drag and removes global pointer listeners.
 */
function stopCameraDrag() {
    cameraDragging = false
    window.removeEventListener('pointermove', moveCameraDrag)
    window.removeEventListener('pointerup', stopCameraDrag)
}

/**
 * Zooms the camera around the cursor when camera mode is enabled.
 */
function zoomCamera(event: WheelEvent) {
    if (!cameraModeEnabled) return

    event.preventDefault()

    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return

    const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9

    player?.zoomCameraAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        scaleFactor,
    )
}

defineExpose({
    playAnimation,
    pause,
    resume,
    setSpeed,
    setCameraModeEnabled,
    getCameraModeEnabled,
    resetView,
    playOption,
    getAnimationNames,
    getAnimationOptions,
    getMenuAnimationOptions,
    getCurrentAnimationOptionId,
    getCurrentAnimation,
    getProgress,
    getPlaybackState,
    seekProgress,
    getPlaybackDuration,
    getLongestProgress,
    seekAllProgress,
})

onMounted(async () => {
    if (!containerRef.value) return

    player = new SpinePlayer({
        container: containerRef.value,
        debug: true,
    })

    resizeObserver = new ResizeObserver(() => {
        player?.resize()
    })

    resizeObserver.observe(containerRef.value)

    await loadCurrentCostume()
})

watch(
    () => props.costumeId,
    async () => {
        await loadCurrentCostume()
    },
)

onBeforeUnmount(() => {
    stopCameraDrag()

    resizeObserver?.disconnect()
    resizeObserver = null

    player?.destroy()
    player = null
})
</script>

<template>
    <div
        ref="containerRef"
        class="h-full w-full overflow-hidden"
        :class="cameraModeEnabled ? 'cursor-grab active:cursor-grabbing' : ''"
        @pointerdown="startCameraDrag"
        @wheel="zoomCamera"
    ></div>
</template>

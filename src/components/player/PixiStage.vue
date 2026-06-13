<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SpinePlayer } from '@/player/spine/SpinePlayer'
import { spineLayoutOverrides } from '@/data/spineLayoutOverrides'
import { getCostumeSpineAsset } from '@/data/assetPaths'

const props = defineProps<{
    costumeId: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let player: SpinePlayer | null = null
let resizeObserver: ResizeObserver | null = null


async function loadCurrentCostume() {
    if (!player) return

    const asset = getCostumeSpineAsset(props.costumeId)
    const layout = spineLayoutOverrides[props.costumeId]

    await player.loadInstance('main', {
        asset,
        layout,
        zIndex: 0,
    })

    player.setMix('main', 'motion', 'idle', 0.2)

    player.playSequence('main', ['motion', 'idle'], {
        loopLast: true,
    })

    console.log(`[Spine] ${props.costumeId} animations:`, player.getAnimationNames())
}

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
    resizeObserver?.disconnect()
    resizeObserver = null

    player?.destroy()
    player = null
})
</script>

<template>
    <div ref="containerRef" class="h-full w-full overflow-hidden"></div>
</template>
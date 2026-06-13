<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SpinePlayer } from '@/player/spine/SpinePlayer'
import { devSpineAssets } from '@/data/devSpineAssets'
import type { SpineComposition } from '@/player/spine/types'

const containerRef = ref<HTMLDivElement | null>(null)

let player: SpinePlayer | null = null
let resizeObserver: ResizeObserver | null = null

const animationNames = ref<string[]>([])
const selectedAssetKey = ref('costume_char000101')
const selectedAnimationName = ref('')

const layoutScale = ref(0.5)
const offsetX = ref(0)
const offsetY = ref(0)
const anchorX = ref(0.5)
const anchorY = ref(0.58)

function getCurrentSharedLayout() {
    return {
        fit: 'fixed' as const,
        scale: layoutScale.value,
        offsetX: offsetX.value,
        offsetY: offsetY.value,
        anchorX: anchorX.value,
        anchorY: anchorY.value,
    }
}

function applyMainLayout() {
    player?.setMainLayout(getCurrentSharedLayout())
}

function resetLayoutControls() {
    layoutScale.value = 0.5
    offsetX.value = 0
    offsetY.value = 0
    anchorX.value = 0.5
    anchorY.value = 0.58

    applyMainLayout()
}

async function loadSelectedAsMain() {
    if (!player) return

    const asset = devSpineAssets[selectedAssetKey.value]
    if (!asset) {
        console.warn(`[Dev] asset not found: ${selectedAssetKey.value}`)
        return
    }

    player.clearInstances()

    const instance = await player.loadInstance('main', {
        asset,
        zIndex: 0,
        layout: getCurrentSharedLayout(),
    })

    animationNames.value = instance.getAnimationNames()

    const firstAnimation = animationNames.value[0]
    selectedAnimationName.value = firstAnimation ?? ''

    if (firstAnimation) {
        player.playAnimation('main', firstAnimation, {
            loop: true,
            trackIndex: 0,
        })
    }
}

function playAnimation(name: string) {
    player?.playAnimation('main', name, {
        loop: true,
        trackIndex: 0,
    })
}

function playSelectedAnimation() {
    if (!selectedAnimationName.value) return

    playAnimation(selectedAnimationName.value)
}

function testSequence() {
    player?.playSequence(
        'main',
        ['mix2_16_25'],
        {
            trackIndex: 0,
            next: {
                animationName: 'idle2',
                loop: true,
            },
        },
    )
}

function testTracks() {
    player?.playTracks('main', [
        { trackIndex: 0, animationName: 'idle', loop: true },
        { trackIndex: 1, animationName: '_face0_talk', loop: true },
    ])
}

async function testComposition() {
    if (!player) return

    const asset1 = devSpineAssets.dating_test_a
    const asset2 = devSpineAssets.dating_test_b

    if (!asset1 || !asset2) {
        console.warn('[Dev] composition assets not configured')
        return
    }

    const composition: SpineComposition = {
        clearBeforePlay: true,

        sharedLayout: getCurrentSharedLayout(),

        layers: [
            {
                id: 'skeleton1_a',
                asset: asset1,
                zIndex: 0,
                alpha: 1,
                hold: false,
                animation: {
                    type: 'single',
                    animationName: 'cut_B_Ponytail',
                    loop: true,
                },
            },
            {
                id: 'skeleton1_b',
                asset: asset1,
                zIndex: 1,
                alpha: 1,
                hold: false,
                animation: {
                    type: 'single',
                    animationName: 'cut_B_Body',
                    loop: true,
                },
            },
            {
                id: 'skeleton1_c',
                asset: asset1,
                zIndex: 2,
                alpha: 1,
                hold: false,
                animation: {
                    type: 'single',
                    animationName: 'cut_B_Head',
                    loop: true,
                },
            },
            {
                id: 'skeleton2_a',
                asset: asset2,
                zIndex: 3,
                alpha: 0.5,
                hold: false,
                animation: {
                    type: 'single',
                    animationName: 'cut_B_B',
                    loop: true,
                },
            },
            {
                id: 'skeleton2_b',
                asset: asset2,
                zIndex: 4,
                alpha: 0.5,
                hold: false,
                animation: {
                    type: 'single',
                    animationName: 'cut_B_Body',
                    loop: true,
                },
            },
            {
                id: 'skeleton2_c',
                asset: asset2,
                zIndex: 5,
                alpha: 0.5,
                hold: false,
                animation: {
                    type: 'single',
                    animationName: 'cut_B_Head',
                    loop: true,
                },
            },
        ],
    }

    await player.playComposition(composition)
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

    await loadSelectedAsMain()
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null

    player?.destroy()
    player = null
})
</script>

<template>
    <section class="h-[calc(100dvh-64px)] min-h-0 bg-[#10131a]">
        <div class="grid h-full min-h-0 grid-cols-[1fr_360px] overflow-hidden">
            <div class="relative min-h-0 overflow-hidden">
                <div ref="containerRef" class="h-full w-full overflow-hidden"></div>
            </div>

            <aside class="min-h-0 overflow-y-auto border-l border-white/10 bg-black/40 p-4 text-white">
                ...
                <h1 class="text-lg font-bold">Spine Player Dev</h1>

                <div class="mt-4">
                    <label class="text-sm text-white/60">Asset</label>

                    <select v-model="selectedAssetKey" class="select select-sm mt-2 w-full">
                        <option v-for="(_, key) in devSpineAssets" :key="key" :value="key">
                            {{ key }}
                        </option>
                    </select>

                    <button class="btn btn-sm mt-3 w-full" @click="loadSelectedAsMain">
                        Load as main
                    </button>
                </div>

                <div class="mt-6 rounded-lg border border-white/10 bg-white/5 p-3">
                    <h2 class="mb-3 text-sm font-semibold text-white/70">
                        Layout
                    </h2>

                    <label class="text-xs text-white/50">
                        Scale: {{ layoutScale.toFixed(2) }}
                    </label>
                    <input v-model.number="layoutScale" type="range" min="0.1" max="2" step="0.01"
                        class="range range-xs" @input="applyMainLayout" />

                    <label class="mt-3 block text-xs text-white/50">
                        Offset X: {{ offsetX }}
                    </label>
                    <input v-model.number="offsetX" type="range" min="-800" max="800" step="1" class="range range-xs"
                        @input="applyMainLayout" />

                    <label class="mt-3 block text-xs text-white/50">
                        Offset Y: {{ offsetY }}
                    </label>
                    <input v-model.number="offsetY" type="range" min="-800" max="800" step="1" class="range range-xs"
                        @input="applyMainLayout" />

                    <label class="mt-3 block text-xs text-white/50">
                        Anchor X: {{ anchorX.toFixed(2) }}
                    </label>
                    <input v-model.number="anchorX" type="range" min="0" max="1" step="0.01" class="range range-xs"
                        @input="applyMainLayout" />

                    <label class="mt-3 block text-xs text-white/50">
                        Anchor Y: {{ anchorY.toFixed(2) }}
                    </label>
                    <input v-model.number="anchorY" type="range" min="0" max="1" step="0.01" class="range range-xs"
                        @input="applyMainLayout" />

                    <button class="btn btn-sm mt-4 w-full" @click="resetLayoutControls">
                        Reset Layout
                    </button>
                </div>

                <div class="mt-6">
                    <h2 class="mb-2 text-sm font-semibold text-white/70">
                        Tests
                    </h2>

                    <div class="flex flex-col gap-2">
                        <button class="btn btn-sm" @click="testSequence">
                            Test sequence
                        </button>

                        <button class="btn btn-sm" @click="testTracks">
                            Test tracks
                        </button>

                        <button class="btn btn-sm" @click="testComposition">
                            Test composition
                        </button>
                    </div>

                    <p class="mt-3 text-xs text-white/40">
                        Update these button handlers with animation names from the active asset.
                    </p>
                </div>

                <div class="mt-6 rounded-lg border border-white/10 bg-white/5 p-3">
                    <h2 class="mb-3 text-sm font-semibold text-white/70">
                        Animation
                    </h2>

                    <select v-model="selectedAnimationName" class="select select-sm w-full">
                        <option v-for="name in animationNames" :key="name" :value="name">
                            {{ name }}
                        </option>
                    </select>

                    <button class="btn btn-sm mt-3 w-full" :disabled="!selectedAnimationName"
                        @click="playSelectedAnimation">
                        Play selected
                    </button>
                </div>
            </aside>
        </div>
    </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as PIXI from 'pixi.js'
import { Spine } from '@pixi-spine/all-4.1'
import { spineLayoutOverrides } from '@/data/spineLayoutOverrides';

const props = defineProps<{
    costumeId: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let app: PIXI.Application | null = null
let resizeObserver: ResizeObserver | null = null

let debugLayer: PIXI.Graphics | null = null
let boundsDebugLayer: PIXI.Graphics | null = null
let characterLayer: PIXI.Container | null = null
let currentSpine: Spine | null = null

function resize() {
    if (!app || !containerRef.value) return

    const { clientWidth, clientHeight } = containerRef.value
    app.renderer.resize(clientWidth, clientHeight)

    drawDebugStage(clientWidth, clientHeight)
    layoutCurrentSpine()
}



function drawDebugStage(width: number, height: number) {
    if (!app) return

    if (!debugLayer) {
        debugLayer = new PIXI.Graphics()
        app.stage.addChildAt(debugLayer, 0)
    }

    debugLayer.clear()

    debugLayer.beginFill(0x151923)
    debugLayer.drawRect(0, 0, width, height)
    debugLayer.endFill()

    debugLayer.lineStyle(1, 0x666666, 0.8)
    debugLayer.moveTo(width / 2, 0)
    debugLayer.lineTo(width / 2, height)
    debugLayer.moveTo(0, height / 2)
    debugLayer.lineTo(width, height / 2)

    debugLayer.lineStyle(2, 0xffffff, 0.4)
    debugLayer.drawCircle(width / 2, height * 0.5, 80)
}

function drawSpineBoundsDebug() {
    if (!app || !currentSpine || !boundsDebugLayer) return

    boundsDebugLayer.clear()

    const bounds = currentSpine.getBounds()

    // Draw bounds rectangle
    boundsDebugLayer.lineStyle(2, 0xff4444, 0.9)
    boundsDebugLayer.drawRect(bounds.x, bounds.y, bounds.width, bounds.height)

    // Bounds center crosshair
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2

    boundsDebugLayer.lineStyle(2, 0x44ff44, 0.9)
    boundsDebugLayer.moveTo(centerX - 12, centerY)
    boundsDebugLayer.lineTo(centerX + 12, centerY)
    boundsDebugLayer.moveTo(centerX, centerY - 12)
    boundsDebugLayer.lineTo(centerX, centerY + 12)

    // Spine origin point
    boundsDebugLayer.lineStyle(2, 0x44aaff, 0.9)
    boundsDebugLayer.drawCircle(currentSpine.x, currentSpine.y, 8)
}

function layoutCurrentSpine() {
    if (!app || !currentSpine) return

    const stageWidth = app.screen.width
    const stageHeight = app.screen.height

    const reservedBottom = 120

    const availableWidth = stageWidth
    const availableHeight = stageHeight - reservedBottom

    currentSpine.scale.set(1)

    const bounds = currentSpine.getLocalBounds()

    const targetWidth = availableWidth * 0.75
    const targetHeight = availableHeight * 0.95


    const baseScale = Math.min(
        targetWidth / bounds.width,
        targetHeight / bounds.height,
    )

    currentSpine.scale.set(baseScale)

    const targetCenterX = stageWidth / 2
    const targetCenterY = availableHeight * 0.5

    currentSpine.x = targetCenterX
    currentSpine.y = targetCenterY

    applySpineLayoutOverride(baseScale)
    drawSpineBoundsDebug()
}

function applySpineLayoutOverride(baseScale: number) {
    if (!currentSpine) return

    const override = spineLayoutOverrides[props.costumeId]
    if (!override) return

    const finalScale = baseScale * (override.scale ?? 1)

    currentSpine.scale.set(finalScale)
    currentSpine.x += override.offsetX ?? 0
    currentSpine.y += override.offsetY ?? 0
}

async function loadSpine(costumeId: string) {
    if (!app || !characterLayer) return

    characterLayer.removeChildren()
    currentSpine = null

    const skelPath = `/assets/spines/${costumeId}/${costumeId}.skel`
    const atlasPath = `/assets/spines/${costumeId}/${costumeId}.atlas`

    try {
        await PIXI.Assets.load(atlasPath)

        const resource = await PIXI.Assets.load(skelPath)
        const spineData = resource.spineData ?? resource

        const spine = new Spine(spineData)

        currentSpine = spine
        characterLayer.addChild(spine)

        layoutCurrentSpine()

        const animationNames = spine.spineData.animations.map((animation) => animation.name)
        console.log(`[Spine] ${costumeId} animations:`, animationNames)

        const idleAnimation =
            animationNames.find((name) => name === 'idle') ??
            animationNames.find((name) => name.toLowerCase().includes('idle')) ??
            animationNames[0]

        if (idleAnimation) {
            spine.state.setAnimation(0, idleAnimation, true)
        }
    } catch (error) {
        console.error(`[Spine] Failed to load ${skelPath}`, error)
    }
}

onMounted(async () => {
    if (!containerRef.value) return

    app = new PIXI.Application({
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        resizeTo: containerRef.value,
    })

    containerRef.value.appendChild(app.view as HTMLCanvasElement)

    characterLayer = new PIXI.Container()
    app.stage.addChild(characterLayer)

    boundsDebugLayer = new PIXI.Graphics()
    app.stage.addChild(boundsDebugLayer)

    resize()

    resizeObserver = new ResizeObserver(() => {
        resize()
    })

    resizeObserver.observe(containerRef.value)

    await loadSpine(props.costumeId)
})

watch(
    () => props.costumeId,
    async (newCostumeId) => {
        if (!app) return
        await loadSpine(newCostumeId)
    },
)

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null

    app?.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
    })

    app = null
    debugLayer = null
    characterLayer = null
    boundsDebugLayer = null
    currentSpine = null
})
</script>

<template>
    <div ref="containerRef" class="h-full w-full overflow-hidden"></div>
</template>

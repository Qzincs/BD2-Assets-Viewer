import * as PIXI from 'pixi.js'
import { Spine } from '@pixi-spine/all-4.1'
import { SpineInstance } from './SpineInstance'
import type {
    PlayAnimationOptions,
    PlaySequenceOptions,
    SpineComposition,
    SpineInstanceOptions,
    SpineLayoutOptions,
    SpinePlayerOptions,
    TrackAnimation,
} from './types'

export class SpinePlayer {
    private app: PIXI.Application
    private container: HTMLElement

    private debugLayer: PIXI.Graphics
    private boundsDebugLayer: PIXI.Graphics
    private instanceLayer: PIXI.Container

    private instances = new Map<string, SpineInstance>()
    private layouts = new Map<string, SpineLayoutOptions>()

    private debugVisible: boolean

    constructor(options: SpinePlayerOptions) {
        this.container = options.container
        this.debugVisible = options.debug ?? false

        this.app = new PIXI.Application({
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            resizeTo: this.container,
        })

        this.container.appendChild(this.app.view as HTMLCanvasElement)

        this.debugLayer = new PIXI.Graphics()
        this.instanceLayer = new PIXI.Container()
        this.boundsDebugLayer = new PIXI.Graphics()

        this.instanceLayer.sortableChildren = true

        this.app.stage.addChild(this.debugLayer)
        this.app.stage.addChild(this.instanceLayer)
        this.app.stage.addChild(this.boundsDebugLayer)

        this.resize()
    }

    async loadInstance(
        id: string,
        options: SpineInstanceOptions,
    ): Promise<SpineInstance> {
        this.removeInstance(id)

        await PIXI.Assets.load(options.asset.atlasUrl)

        const resource = await PIXI.Assets.load(options.asset.skelUrl)
        const spineData = resource.spineData ?? resource

        const spine = new Spine(spineData)

        spine.zIndex = options.zIndex ?? 0
        spine.visible = options.visible ?? true
        spine.alpha = options.alpha ?? 1

        const instance = new SpineInstance(id, spine)

        this.instances.set(id, instance)
        this.layouts.set(id, options.layout ?? {})

        this.instanceLayer.addChild(spine)

        this.layoutInstance(id)
        this.drawSpineBoundsDebug()

        return instance
    }

    getInstance(id = 'main'): SpineInstance | undefined {
        return this.instances.get(id)
    }

    removeInstance(id: string) {
        const instance = this.instances.get(id)
        if (!instance) return

        this.instanceLayer.removeChild(instance.displayObject)
        instance.destroy()

        this.instances.delete(id)
        this.layouts.delete(id)

        this.drawSpineBoundsDebug()
    }

    clearInstances() {
        for (const id of this.instances.keys()) {
            this.removeInstance(id)
        }
    }

    playAnimation(
        id: string,
        animationName: string,
        options: PlayAnimationOptions = {},
    ) {
        this.instances.get(id)?.setAnimation(animationName, options)
    }

    playSequence(
        id: string,
        animationNames: string[],
        options: PlaySequenceOptions = {},
    ) {
        this.instances.get(id)?.playSequence(animationNames, options)
    }

    playTracks(id: string, tracks: TrackAnimation[]) {
        this.instances.get(id)?.playTracks(tracks)
    }

    async playComposition(composition: SpineComposition) {
        if (composition.clearBeforePlay ?? true) {
            this.clearInstances()
        }

        for (const layer of composition.layers) {
            const layout = {
                ...(composition.sharedLayout ?? {}),
                ...(layer.layout ?? {}),
            }

            const instance = await this.loadInstance(layer.id, {
                asset: layer.asset,
                zIndex: layer.zIndex,
                visible: layer.visible,
                alpha: layer.alpha,
                layout,
            })

            if (layer.defaultMix !== undefined) {
                instance.setDefaultMix(layer.defaultMix)
            }

            if (layer.mixes) {
                for (const mix of layer.mixes) {
                    instance.setMix(mix.from, mix.to, mix.duration)
                }
            }

            switch (layer.animation.type) {
                case 'single': {
                    instance.setAnimation(layer.animation.animationName, {
                        trackIndex: layer.animation.trackIndex ?? 0,
                        loop: layer.animation.loop ?? false,
                        hold: layer.animation.hold ?? layer.hold,
                    })
                    break
                }

                case 'sequence': {
                    instance.playSequence(layer.animation.animationNames, {
                        trackIndex: layer.animation.trackIndex ?? 0,
                        loopLast: layer.animation.loopLast,
                        holdLast: layer.animation.holdLast ?? layer.hold,
                        next: layer.animation.next,
                    })
                    break
                }

                case 'tracks': {
                    instance.playTracks(layer.animation.tracks)
                    break
                }
            }
        }

        this.instanceLayer.sortChildren()
        this.drawSpineBoundsDebug()
    }

    getAnimationNames(id = 'main'): string[] {
        return this.instances.get(id)?.getAnimationNames() ?? []
    }

    setDefaultMix(duration: number, id = 'main') {
        this.instances.get(id)?.setDefaultMix(duration)
    }

    setMix(id: string, from: string, to: string, duration: number) {
        this.instances.get(id)?.setMix(from, to, duration)
    }

    setMixes(
        id: string,
        mixes: {
            from: string
            to: string
            duration: number
        }[],
    ) {
        const instance = this.instances.get(id)
        if (!instance) return

        for (const mix of mixes) {
            instance.setMix(mix.from, mix.to, mix.duration)
        }
    }

    pause(id = 'main') {
        this.instances.get(id)?.pause()
    }

    resume(id = 'main') {
        this.instances.get(id)?.resume()
    }

    setSpeed(speed: number, id = 'main') {
        this.instances.get(id)?.setSpeed(speed)
    }

    setInstanceLayout(id: string, layout: SpineLayoutOptions) {
        const oldLayout = this.layouts.get(id) ?? {}

        this.layouts.set(id, {
            ...oldLayout,
            ...layout,
        })

        this.layoutInstance(id)
        this.drawSpineBoundsDebug()
    }

    setMainLayout(layout: SpineLayoutOptions) {
        this.setInstanceLayout('main', layout)
    }

    resetView() {
        for (const id of this.instances.keys()) {
            this.layoutInstance(id)
        }
    }

    resize() {
        const width = this.container.clientWidth
        const height = this.container.clientHeight

        this.app.renderer.resize(width, height)

        this.drawDebugStage(width, height)
        this.resetView()
    }

    setDebugVisible(visible: boolean) {
        this.debugVisible = visible
        this.debugLayer.visible = visible
        this.boundsDebugLayer.visible = visible

        this.resize()
    }

    destroy() {
        this.app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
        })
    }

    private layoutInstance(id: string) {
        const instance = this.instances.get(id)
        if (!instance) return

        const spine = instance.displayObject
        const layout = this.layouts.get(id) ?? {}

        const stageWidth = this.app.screen.width
        const stageHeight = this.app.screen.height

        const reservedBottom = 120
        const availableWidth = stageWidth
        const availableHeight = Math.max(100, stageHeight - reservedBottom)

        const anchorX = layout.anchorX ?? 0.5
        const anchorY = layout.anchorY ?? 0.58

        const targetX = availableWidth * anchorX + (layout.offsetX ?? 0)
        const targetY = availableHeight * anchorY + (layout.offsetY ?? 0)

        if (layout.fit === 'fixed') {
            spine.scale.set(layout.scale ?? 1)
            spine.x = targetX
            spine.y = targetY
            return
        }

        spine.scale.set(1)

        const bounds = spine.getLocalBounds()

        if (bounds.width <= 0 || bounds.height <= 0) {
            spine.scale.set(0.5 * (layout.scale ?? 1))
            spine.x = targetX
            spine.y = targetY
            return
        }

        const targetWidth = availableWidth * 0.75
        const targetHeight = availableHeight * 0.95

        const baseScale = Math.min(
            targetWidth / bounds.width,
            targetHeight / bounds.height,
        )

        const finalScale = baseScale * (layout.scale ?? 1)

        spine.scale.set(finalScale)
        spine.x = targetX
        spine.y = targetY
    }

    private drawDebugStage(width: number, height: number) {
        this.debugLayer.clear()
        this.debugLayer.visible = this.debugVisible

        if (!this.debugVisible) return

        this.debugLayer.beginFill(0x151923)
        this.debugLayer.drawRect(0, 0, width, height)
        this.debugLayer.endFill()

        this.debugLayer.lineStyle(1, 0x666666, 0.8)
        this.debugLayer.moveTo(width / 2, 0)
        this.debugLayer.lineTo(width / 2, height)
        this.debugLayer.moveTo(0, height / 2)
        this.debugLayer.lineTo(width, height / 2)

        this.debugLayer.lineStyle(2, 0xffffff, 0.4)
        this.debugLayer.drawCircle(width / 2, height * 0.5, 80)
    }

    private drawSpineBoundsDebug() {
        this.boundsDebugLayer.clear()
        this.boundsDebugLayer.visible = this.debugVisible

        if (!this.debugVisible) return

        for (const instance of this.instances.values()) {
            const spine = instance.displayObject
            const bounds = spine.getBounds()

            this.boundsDebugLayer.lineStyle(2, 0xff4444, 0.9)
            this.boundsDebugLayer.drawRect(
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height,
            )

            const centerX = bounds.x + bounds.width / 2
            const centerY = bounds.y + bounds.height / 2

            this.boundsDebugLayer.lineStyle(2, 0x44ff44, 0.9)
            this.boundsDebugLayer.moveTo(centerX - 12, centerY)
            this.boundsDebugLayer.lineTo(centerX + 12, centerY)
            this.boundsDebugLayer.moveTo(centerX, centerY - 12)
            this.boundsDebugLayer.lineTo(centerX, centerY + 12)

            this.boundsDebugLayer.lineStyle(2, 0x44aaff, 0.9)
            this.boundsDebugLayer.drawCircle(spine.x, spine.y, 8)
        }
    }
}
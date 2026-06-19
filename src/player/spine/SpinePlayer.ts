import * as PIXI from 'pixi.js'
import { Spine } from '@pixi-spine/all-4.1'
import { SpineInstance } from './SpineInstance'
import type { CameraTransform } from '@/player/camera/types'
import type {
    PlaybackState,
    PlayAnimationOptions,
    PlaySequenceOptions,
    SpineComposition,
    SpineInstanceOptions,
    SpineLayoutOptions,
    SpinePlayerOptions,
    TrackAnimation,
} from './types'

const defaultCameraTransform: CameraTransform = {
    x: 0,
    y: 0,
    scale: 1,
}

const minCameraScale = 0.2
const maxCameraScale = 5

export class SpinePlayer {
    private app: PIXI.Application
    private container: HTMLElement

    private debugLayer: PIXI.Graphics
    private cameraLayer: PIXI.Container
    private boundsDebugLayer: PIXI.Graphics
    private instanceLayer: PIXI.Container

    private instances = new Map<string, SpineInstance>()
    private layouts = new Map<string, SpineLayoutOptions>()

    private debugVisible: boolean
    private cameraEnabled = false
    private cameraTransform: CameraTransform = { ...defaultCameraTransform }

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
        this.cameraLayer = new PIXI.Container()
        this.instanceLayer = new PIXI.Container()
        this.boundsDebugLayer = new PIXI.Graphics()

        this.instanceLayer.sortableChildren = true

        this.app.stage.addChild(this.debugLayer)
        this.app.stage.addChild(this.cameraLayer)
        this.cameraLayer.addChild(this.instanceLayer)
        this.cameraLayer.addChild(this.boundsDebugLayer)

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

    /**
     * Returns whether a screen-space point is inside an instance's current
     * rendered bounds.
     *
     * The bounds include layout and camera transforms, making this suitable for
     * stage interaction without modifying Spine animation state.
     */
    hitTestInstanceAt(screenX: number, screenY: number, id = 'main'): boolean {
        const instance = this.instances.get(id)
        if (!instance?.displayObject.visible || instance.displayObject.alpha <= 0) {
            return false
        }

        return instance.displayObject.getBounds().contains(screenX, screenY)
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

    /**
     * Clears all animation tracks on one instance.
     */
    clearTracks(id = 'main') {
        this.instances.get(id)?.clearTracks()
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

    /**
     * Returns the animation currently active on an instance track.
     */
    getCurrentAnimation(id = 'main', trackIndex = 0): string | undefined {
        return this.instances.get(id)?.getCurrentAnimation(trackIndex)
    }

    /**
     * Returns normalized progress for one instance.
     *
     * The value represents the instance's logical playback timeline, not just a
     * raw Spine TrackEntry. Sequences are accumulated across segments.
     */
    getProgress(id = 'main', trackIndex = 0): number {
        return this.instances.get(id)?.getProgress(trackIndex) ?? 0
    }

    /**
     * Returns runtime playback state for one instance.
     */
    getPlaybackState(id = 'main', trackIndex = 0): PlaybackState | undefined {
        return this.instances.get(id)?.getPlaybackState(trackIndex)
    }

    /**
     * Seeks one instance to a normalized progress value.
     */
    seekProgress(progress: number, id = 'main') {
        this.instances.get(id)?.seekProgress(progress)
    }

    /**
     * Returns the logical playback duration for one instance.
     */
    getPlaybackDuration(id = 'main'): number {
        return this.instances.get(id)?.getPlaybackDuration() ?? 0
    }

    /**
     * Returns progress for the longest active instance.
     *
     * This is intended for composed playback where multiple instances run in
     * parallel and the control bar should represent the longest layer.
     */
    getLongestProgress(): number {
        const instance = this.getLongestInstance()
        return instance?.getProgress() ?? 0
    }

    /**
     * Seeks all active instances to the same normalized progress value.
     *
     * Each instance clamps the target time to its own duration.
     */
    seekAllProgress(progress: number) {
        for (const instance of this.instances.values()) {
            instance.seekProgress(progress)
        }
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

    /**
     * Enables or disables manual camera transform changes.
     */
    setCameraEnabled(enabled: boolean) {
        this.cameraEnabled = enabled
    }

    /**
     * Returns whether manual camera controls are enabled.
     */
    getCameraEnabled(): boolean {
        return this.cameraEnabled
    }

    /**
     * Returns a copy of the current camera transform.
     */
    getCameraTransform(): CameraTransform {
        return { ...this.cameraTransform }
    }

    /**
     * Applies an absolute camera transform to the camera layer.
     */
    setCameraTransform(transform: Partial<CameraTransform>) {
        this.cameraTransform = {
            ...this.cameraTransform,
            ...transform,
            scale: this.clampCameraScale(transform.scale ?? this.cameraTransform.scale),
        }

        this.applyCameraTransform()
        this.drawSpineBoundsDebug()
    }

    /**
     * Moves the camera layer by a screen-space delta.
     */
    panCamera(deltaX: number, deltaY: number) {
        if (!this.cameraEnabled) return

        this.setCameraTransform({
            x: this.cameraTransform.x + deltaX,
            y: this.cameraTransform.y + deltaY,
        })
    }

    /**
     * Zooms the camera around a screen-space anchor point.
     */
    zoomCameraAt(screenX: number, screenY: number, scaleFactor: number) {
        if (!this.cameraEnabled) return

        const oldScale = this.cameraTransform.scale
        const nextScale = this.clampCameraScale(oldScale * scaleFactor)

        if (nextScale === oldScale) return

        const worldX = (screenX - this.cameraTransform.x) / oldScale
        const worldY = (screenY - this.cameraTransform.y) / oldScale

        this.setCameraTransform({
            scale: nextScale,
            x: screenX - worldX * nextScale,
            y: screenY - worldY * nextScale,
        })
    }

    /**
     * Restores the camera layer to its default transform.
     */
    resetCamera() {
        this.setCameraTransform(defaultCameraTransform)
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

        this.resetCamera()
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

    /**
     * Applies the current camera transform to the camera layer.
     */
    private applyCameraTransform() {
        this.cameraLayer.position.set(this.cameraTransform.x, this.cameraTransform.y)
        this.cameraLayer.scale.set(this.cameraTransform.scale)
    }

    /**
     * Keeps camera zoom within a practical viewer range.
     */
    private clampCameraScale(scale: number): number {
        return Math.min(maxCameraScale, Math.max(minCameraScale, scale))
    }

    /**
     * Finds the instance with the longest logical playback duration.
     */
    private getLongestInstance(): SpineInstance | undefined {
        let longestInstance: SpineInstance | undefined
        let longestDuration = 0

        for (const instance of this.instances.values()) {
            const duration = instance.getPlaybackDuration()

            if (duration > longestDuration) {
                longestInstance = instance
                longestDuration = duration
            }
        }

        return longestInstance
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
            const topLeft = this.cameraLayer.toLocal(new PIXI.Point(bounds.x, bounds.y))
            const bottomRight = this.cameraLayer.toLocal(new PIXI.Point(
                bounds.x + bounds.width,
                bounds.y + bounds.height,
            ))
            const boundsWidth = bottomRight.x - topLeft.x
            const boundsHeight = bottomRight.y - topLeft.y

            this.boundsDebugLayer.lineStyle(2, 0xff4444, 0.9)
            this.boundsDebugLayer.drawRect(
                topLeft.x,
                topLeft.y,
                boundsWidth,
                boundsHeight,
            )

            const centerX = topLeft.x + boundsWidth / 2
            const centerY = topLeft.y + boundsHeight / 2

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

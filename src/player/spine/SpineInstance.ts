import { Spine } from '@pixi-spine/all-4.1'
import type {
    PlayAnimationOptions,
    PlaySequenceOptions,
    TrackAnimation,
} from './types'

export class SpineInstance {
    readonly id: string
    readonly spine: Spine

    constructor(id: string, spine: Spine) {
        this.id = id
        this.spine = spine
    }

    get displayObject() {
        return this.spine
    }

    getAnimationNames(): string[] {
        return this.spine.spineData.animations.map((animation) => animation.name)
    }

    hasAnimation(animationName: string): boolean {
        return this.getAnimationNames().includes(animationName)
    }

    setAnimation(animationName: string, options: PlayAnimationOptions = {}) {
        const trackIndex = options.trackIndex ?? 0
        const loop = options.loop ?? false

        if (!this.hasAnimation(animationName)) {
            console.warn(`[SpineInstance:${this.id}] animation not found: ${animationName}`)
            return
        }

        const entry = this.spine.state.setAnimation(trackIndex, animationName, loop)

        if (options.mixDuration !== undefined) {
            entry.mixDuration = options.mixDuration
        }

        return entry
    }

    addAnimation(
        animationName: string,
        options: PlayAnimationOptions & { delay?: number } = {},
    ) {
        const trackIndex = options.trackIndex ?? 0
        const loop = options.loop ?? false
        const delay = options.delay ?? 0

        if (!this.hasAnimation(animationName)) {
            console.warn(`[SpineInstance:${this.id}] animation not found: ${animationName}`)
            return
        }

        const entry = this.spine.state.addAnimation(trackIndex, animationName, loop, delay)

        if (options.mixDuration !== undefined) {
            entry.mixDuration = options.mixDuration
        }

        return entry
    }

    playSequence(animationNames: string[], options: PlaySequenceOptions = {}) {
        if (animationNames.length === 0) return

        const trackIndex = options.trackIndex ?? 0

        const firstAnimation = animationNames[0]

        if (!firstAnimation) return

        this.setAnimation(firstAnimation, {
            trackIndex,
            loop: false,
        })

        for (let i = 1; i < animationNames.length; i++) {
            const animationName = animationNames[i]
            if (!animationName) continue

            this.addAnimation(animationName, {
                trackIndex,
                loop: false,
                delay: 0,
            })
        }

        if (options.next) {
            this.addAnimation(options.next.animationName, {
                trackIndex,
                loop: options.next.loop ?? true,
                delay: 0,
            })
            return
        }

        if (options.loopLast) {
            const lastAnimation = animationNames[animationNames.length - 1]
            if (!lastAnimation) return

            this.addAnimation(lastAnimation, {
                trackIndex,
                loop: true,
                delay: 0,
            })
        }
    }

    playTracks(tracks: TrackAnimation[]) {
        for (const track of tracks) {
            this.setAnimation(track.animationName, {
                trackIndex: track.trackIndex,
                loop: track.loop ?? false,
                hold: track.hold,
            })
        }
    }

    clearTrack(trackIndex: number) {
        this.spine.state.clearTrack(trackIndex)
    }

    clearTracks() {
        this.spine.state.clearTracks()
    }

    setDefaultMix(duration: number) {
        this.spine.stateData.defaultMix = duration
    }

    setMix(from: string, to: string, duration: number) {
        this.spine.stateData.setMix(from, to, duration)
    }

    pause() {
        this.spine.state.timeScale = 0
    }

    resume() {
        this.spine.state.timeScale = 1
    }

    setSpeed(speed: number) {
        this.spine.state.timeScale = speed
    }

    setVisible(visible: boolean) {
        this.spine.visible = visible
    }

    setAlpha(alpha: number) {
        this.spine.alpha = alpha
    }

    destroy() {
        this.spine.destroy({
            children: true,
            texture: false,
            baseTexture: false,
        })
    }
}
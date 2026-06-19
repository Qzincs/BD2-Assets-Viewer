import { Spine } from '@pixi-spine/all-4.1'
import type {
    PlaybackState,
    PlayAnimationOptions,
    PlaySequenceOptions,
    TrackAnimation,
} from './types'

/**
 * One contiguous part of a logical playback timeline.
 *
 * A segment can be a single animation, one item in a sequence, or one track in
 * a multi-track composition.
 */
type PlaybackSegment = {
    animationName: string
    trackIndex: number
    startTime: number
    duration: number
}

type PlaybackNext = {
    animationName: string
    trackIndex: number
    loop: boolean
    duration: number
    /**
     * True after the logical sequence body has finished and playback has moved
     * into this follow-up animation.
     */
    started: boolean
    startedAtTime?: number
}

/**
 * Playback clock for a logical timeline.
 *
 * Spine TrackEntry time resets when a queued animation changes. The controls
 * need one continuous clock for higher-level items such as sequences and
 * parallel tracks.
 */
type PlaybackClock = {
    elapsedTime: number
    lastUpdatedAt: number
    timeScale: number
    paused: boolean
}

/**
 * Logical playback metadata used by the controls timeline.
 *
 * This is intentionally separate from Spine's TrackEntry queue so the UI can
 * represent higher-level playback concepts:
 * - single: progress of one animation
 * - sequence: accumulated progress across multiple queued animations
 * - tracks: progress based on the longest parallel track
 *
 * loop describes the logical playback item itself. next is a follow-up
 * animation played after the logical item, and is not part of the item's
 * timeline progress.
 */
type PlaybackTimeline = {
    type: 'single' | 'sequence' | 'tracks'
    duration: number
    loop: boolean
    next?: PlaybackNext
    segments: PlaybackSegment[]
    clock: PlaybackClock
}

export class SpineInstance {
    readonly id: string
    readonly spine: Spine
    private playbackTimeline: PlaybackTimeline | null = null

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

    /**
     * Returns the duration of an animation in seconds.
     *
     * Returns 0 when the animation does not exist, which lets callers treat
     * unknown or invalid animations as non-seekable.
     */
    getAnimationDuration(animationName: string): number {
        const animation = this.spine.spineData.findAnimation(animationName)
        return animation?.duration ?? 0
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

        const duration = this.getAnimationDuration(animationName)

        this.playbackTimeline = {
            type: 'single',
            duration,
            loop,
            segments: [{
                animationName,
                trackIndex,
                startTime: 0,
                duration,
            }],
            clock: this.createPlaybackClock(),
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

        const segments = this.createSequenceSegments(animationNames, trackIndex)
        const firstSegment = segments[0]

        if (!firstSegment) return

        const sequenceLoop = options.loop ?? false
        const firstEntry = this.spine.state.setAnimation(trackIndex, firstSegment.animationName, false)
        let lastEntry = firstEntry

        for (let i = 1; i < animationNames.length; i++) {
            const animationName = animationNames[i]
            if (!animationName) continue

            const entry = this.addAnimation(animationName, {
                trackIndex,
                loop: false,
                delay: 0,
            })

            if (entry) {
                lastEntry = entry
            }
        }

        const next = sequenceLoop
            ? undefined
            : this.createSequenceNext(animationNames, options, trackIndex)

        const timeline: PlaybackTimeline = {
            type: 'sequence',
            duration: this.getTimelineDuration(segments),
            loop: sequenceLoop,
            next,
            segments,
            clock: this.createPlaybackClock(),
        }

        this.playbackTimeline = timeline

        if (sequenceLoop) {
            this.attachSequenceLoop(lastEntry, animationNames, options)
            return firstEntry
        }

        if (next) {
            this.attachSequenceNextStart(lastEntry, timeline, next)

            this.addAnimation(next.animationName, {
                trackIndex,
                loop: next.loop,
                delay: 0,
            })
            return firstEntry
        }

        return firstEntry
    }

    playTracks(tracks: TrackAnimation[]) {
        for (const track of tracks) {
            if (!this.hasAnimation(track.animationName)) {
                console.warn(`[SpineInstance:${this.id}] animation not found: ${track.animationName}`)
                continue
            }

            const entry = this.spine.state.setAnimation(
                track.trackIndex,
                track.animationName,
                track.loop ?? false,
            )

            if (track.hold) {
                entry.mixDuration = 0
            }
        }

        const segments = tracks
            .filter((track) => this.hasAnimation(track.animationName))
            .map((track) => ({
                animationName: track.animationName,
                trackIndex: track.trackIndex,
                startTime: 0,
                duration: this.getAnimationDuration(track.animationName),
            }))

        this.playbackTimeline = {
            type: 'tracks',
            duration: this.getTimelineDuration(segments),
            loop: segments.length > 0 && segments.every((segment) => {
                const track = tracks.find((item) => {
                    return item.trackIndex === segment.trackIndex
                        && item.animationName === segment.animationName
                })

                return track?.loop ?? false
            }),
            segments,
            clock: this.createPlaybackClock(),
        }
    }

    clearTrack(trackIndex: number) {
        this.spine.state.clearTrack(trackIndex)
    }

    clearTracks() {
        this.spine.state.clearTracks()
        this.restoreSetupPose()
        this.playbackTimeline = null
    }

    setDefaultMix(duration: number) {
        this.spine.stateData.defaultMix = duration
    }

    setMix(from: string, to: string, duration: number) {
        this.spine.stateData.setMix(from, to, duration)
    }

    pause() {
        this.syncPlaybackClock()
        this.spine.state.timeScale = 0
        this.updatePlaybackClockScale(0)
    }

    resume() {
        this.syncPlaybackClock()
        this.spine.state.timeScale = 1
        this.updatePlaybackClockScale(1)
    }

    setSpeed(speed: number) {
        this.syncPlaybackClock()
        this.spine.state.timeScale = speed
        this.updatePlaybackClockScale(speed)
    }

    /**
     * Returns the animation currently active on a Spine track.
     */
    getCurrentAnimation(trackIndex = 0): string | undefined {
        const entry = this.spine.state.getCurrent(trackIndex)
        return entry?.animation?.name
    }

    /**
     * Returns the total duration represented by the current logical playback.
     *
     * For a sequence this is the sum of its own segments. A next animation
     * created by next or loopLast is intentionally not included. For parallel
     * tracks this is the longest track duration. If no logical timeline has
     * been recorded, this falls back to the current Spine TrackEntry duration.
     */
    getPlaybackDuration(): number {
        return this.playbackTimeline?.duration ?? this.getCurrentEntryDuration()
    }

    /**
     * Returns normalized progress for the current logical playback.
     *
     * The value is clamped to [0, 1]. For sequences, this is the accumulated
     * progress across the sequence itself. If playback has moved into a next
     * animation, progress is reported for that next animation instead. For
     * parallel tracks, this is based on the longest active segment.
     */
    getProgress(trackIndex = 0): number {
        const timeline = this.playbackTimeline

        if (!timeline || timeline.duration <= 0) {
            const duration = this.getCurrentEntryDuration(trackIndex)
            const entry = this.spine.state.getCurrent(trackIndex)
            if (!entry || duration <= 0) return 0

            return Math.min(1, Math.max(0, entry.trackTime / duration))
        }

        const nextProgress = this.getNextProgress(timeline)
        if (nextProgress !== undefined) return nextProgress

        const elapsed = this.getTimelineElapsed(timeline)
        return Math.min(1, Math.max(0, elapsed / timeline.duration))
    }

    /**
     * Returns runtime playback state for UI controls.
     */
    getPlaybackState(trackIndex = 0): PlaybackState {
        const timeline = this.playbackTimeline

        if (timeline) {
            const nextEntry = this.getActiveNextEntry(timeline)

            if (nextEntry && timeline.next) {
                return {
                    phase: 'next',
                    currentAnimationName: timeline.next.animationName,
                    progress: this.getProgress(trackIndex),
                    loop: timeline.next.loop,
                }
            }

            return {
                phase: 'main',
                currentAnimationName: this.getCurrentAnimation(trackIndex),
                progress: this.getProgress(trackIndex),
                loop: timeline.loop,
            }
        }

        const entry = this.spine.state.getCurrent(trackIndex)

        return {
            phase: 'main',
            currentAnimationName: entry?.animation?.name,
            progress: this.getProgress(trackIndex),
            loop: entry?.loop ?? false,
        }
    }

    /**
     * Seeks the current logical playback to a normalized progress value.
     *
     * For sequences, this seeks within the sequence item itself and rebuilds
     * the remaining queue after that point. For parallel tracks, each track is
     * moved to the corresponding normalized time and clamped by its own
     * duration.
     */
    seekProgress(progress: number) {
        const timeline = this.playbackTimeline
        const normalizedProgress = Math.min(1, Math.max(0, progress))

        if (!timeline || timeline.duration <= 0) {
            const entry = this.spine.state.getCurrent(0)
            const duration = this.getCurrentEntryDuration(0)
            if (!entry || duration <= 0) return

            entry.trackTime = duration * normalizedProgress
            this.spine.update(0)
            return
        }

        const nextEntry = this.getActiveNextEntry(timeline)
        if (nextEntry && timeline.next) {
            const targetTime = timeline.next.duration * normalizedProgress
            const nextStartedAtTime = timeline.next.startedAtTime ?? timeline.duration

            nextEntry.trackTime = targetTime
            this.setPlaybackClockElapsed(timeline, nextStartedAtTime + targetTime)
            this.spine.update(0)
            return
        }

        const targetTime = timeline.duration * normalizedProgress
        this.setPlaybackClockElapsed(timeline, targetTime)

        switch (timeline.type) {
            case 'single':
            case 'tracks':
                this.seekTimelineTracks(timeline, targetTime)
                break

            case 'sequence':
                this.seekSequenceTimeline(timeline, targetTime)
                break
        }

        this.spine.update(0)
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

    /**
     * Creates timeline segments for a queued animation sequence.
     */
    private createSequenceSegments(animationNames: string[], trackIndex: number): PlaybackSegment[] {
        let startTime = 0

        return animationNames
            .filter((animationName) => this.hasAnimation(animationName))
            .map((animationName) => {
                const duration = this.getAnimationDuration(animationName)
                const segment = {
                    animationName,
                    trackIndex,
                    startTime,
                    duration,
                }

                startTime += duration
                return segment
            })
    }

    /**
     * Converts next and loopLast sequence options into one follow-up animation.
     */
    private createSequenceNext(
        animationNames: string[],
        options: PlaySequenceOptions,
        trackIndex: number,
    ): PlaybackNext | undefined {
        const animationName = options.next?.animationName
            ?? (options.loopLast ? animationNames[animationNames.length - 1] : undefined)

        if (!animationName || !this.hasAnimation(animationName)) return undefined

        return {
            animationName,
            trackIndex,
            loop: options.next?.loop ?? true,
            duration: this.getAnimationDuration(animationName),
            started: false,
        }
    }

    /**
     * Replays the whole sequence when the queued sequence finishes.
     *
     * Spine loop is track-entry based, so a multi-animation sequence needs to
     * be re-queued manually when the final segment completes.
     */
    private attachSequenceLoop(
        lastEntry: ReturnType<SpineInstance['addAnimation']>,
        animationNames: string[],
        options: PlaySequenceOptions,
    ) {
        if (!lastEntry) return

        lastEntry.listener = {
            complete: () => {
                this.playSequence(animationNames, options)
            },
        }
    }

    /**
     * Marks a sequence follow-up animation as active once the sequence body has
     * completed. This disambiguates loopLast from a final sequence segment that
     * uses the same raw animation name.
     */
    private attachSequenceNextStart(
        lastEntry: ReturnType<SpineInstance['addAnimation']>,
        timeline: PlaybackTimeline,
        next: PlaybackNext,
    ) {
        if (!lastEntry) return

        lastEntry.listener = {
            complete: () => {
                next.started = true
                next.startedAtTime = this.getRawTimelineElapsed(timeline)
            },
        }
    }

    /**
     * Returns the total timeline duration from segment end times.
     */
    private getTimelineDuration(segments: PlaybackSegment[]): number {
        return Math.max(
            0,
            ...segments.map((segment) => segment.startTime + segment.duration),
        )
    }

    /**
     * Returns the duration of the current Spine TrackEntry.
     */
    private getCurrentEntryDuration(trackIndex = 0): number {
        const entry = this.spine.state.getCurrent(trackIndex)
        if (!entry) return 0

        return entry.animationEnd - entry.animationStart
    }

    /**
     * Creates a clock using the instance's current playback speed.
     */
    private createPlaybackClock(elapsedTime = 0): PlaybackClock {
        const timeScale = this.spine.state.timeScale

        return {
            elapsedTime,
            lastUpdatedAt: performance.now(),
            timeScale,
            paused: timeScale === 0,
        }
    }

    /**
     * Updates the active logical clock to the current wall-clock time.
     */
    private syncPlaybackClock() {
        if (!this.playbackTimeline) return

        this.syncTimelineClock(this.playbackTimeline)
    }

    /**
     * Applies a new playback speed to the active logical clock.
     */
    private updatePlaybackClockScale(timeScale: number) {
        if (!this.playbackTimeline) return

        this.playbackTimeline.clock.timeScale = timeScale
        this.playbackTimeline.clock.paused = timeScale === 0
        this.playbackTimeline.clock.lastUpdatedAt = performance.now()
    }

    /**
     * Sets the logical clock to an exact elapsed time after a seek operation.
     */
    private setPlaybackClockElapsed(timeline: PlaybackTimeline, elapsedTime: number) {
        timeline.clock.elapsedTime = elapsedTime
        timeline.clock.lastUpdatedAt = performance.now()
    }

    /**
     * Advances a timeline clock and returns its unclamped elapsed time.
     */
    private getRawTimelineElapsed(timeline: PlaybackTimeline): number {
        this.syncTimelineClock(timeline)
        return timeline.clock.elapsedTime
    }

    /**
     * Advances a timeline clock without depending on the active Spine segment.
     */
    private syncTimelineClock(timeline: PlaybackTimeline) {
        const now = performance.now()

        if (!timeline.clock.paused) {
            const deltaSeconds = (now - timeline.clock.lastUpdatedAt) / 1000
            timeline.clock.elapsedTime += deltaSeconds * timeline.clock.timeScale
        }

        timeline.clock.lastUpdatedAt = now
    }

    /**
     * Restores the skeleton pose after clearing tracks.
     *
     * Spine can leave slot attachments at the last applied overlay frame after
     * a track is cleared. Resetting the skeleton prevents track-based effects,
     * such as face overlays, from leaking into the next animation.
     */
    private restoreSetupPose() {
        const skeleton = this.spine.skeleton as {
            setToSetupPose?: () => void
            setSlotsToSetupPose?: () => void
        }

        if (skeleton.setToSetupPose) {
            skeleton.setToSetupPose()
            return
        }

        skeleton.setSlotsToSetupPose?.()
    }

    /**
     * Converts Spine's current TrackEntry state into logical timeline elapsed time.
     */
    private getTimelineElapsed(timeline: PlaybackTimeline): number {
        const elapsed = this.getRawTimelineElapsed(timeline)

        if (timeline.loop && timeline.duration > 0) {
            return elapsed % timeline.duration
        }

        return Math.min(elapsed, timeline.duration)
    }

    /**
     * Returns progress for a follow-up animation if the sequence has moved into
     * next playback.
     */
    private getNextProgress(timeline: PlaybackTimeline): number | undefined {
        const entry = this.getActiveNextEntry(timeline)
        if (!entry || !timeline.next) return undefined
        if (timeline.next.duration <= 0) return 0

        const nextStartedAtTime = timeline.next.startedAtTime ?? timeline.duration
        const elapsed = Math.max(0, this.getRawTimelineElapsed(timeline) - nextStartedAtTime)

        if (timeline.next.loop) {
            return (elapsed % timeline.next.duration) / timeline.next.duration
        }

        return Math.min(elapsed, timeline.next.duration) / timeline.next.duration
    }

    /**
     * Returns the active next TrackEntry when playback has moved past the
     * logical timeline into a follow-up animation.
     */
    private getActiveNextEntry(timeline: PlaybackTimeline) {
        if (!timeline.next) return undefined
        if (!timeline.next.started) return undefined

        const entry = this.spine.state.getCurrent(timeline.next.trackIndex)
        if (entry?.animation?.name !== timeline.next.animationName) return undefined

        return entry
    }

    /**
     * Seeks all parallel tracks according to one shared logical target time.
     */
    private seekTimelineTracks(timeline: PlaybackTimeline, targetTime: number) {
        for (const segment of timeline.segments) {
            const entry = this.spine.state.setAnimation(
                segment.trackIndex,
                segment.animationName,
                timeline.loop,
            )

            entry.trackTime = Math.min(targetTime, segment.duration)
        }
    }

    /**
     * Seeks a sequence by selecting the target segment and rebuilding the
     * remaining queued animations after it.
     */
    private seekSequenceTimeline(timeline: PlaybackTimeline, targetTime: number) {
        const firstSegment = timeline.segments.find((segment) => {
            return targetTime <= segment.startTime + segment.duration
        }) ?? timeline.segments[timeline.segments.length - 1]

        if (!firstSegment) return

        const firstSegmentIndex = timeline.segments.indexOf(firstSegment)
        const firstEntry = this.spine.state.setAnimation(
            firstSegment.trackIndex,
            firstSegment.animationName,
            false,
        )

        firstEntry.trackTime = Math.max(0, targetTime - firstSegment.startTime)
        let lastEntry = firstEntry

        for (let i = firstSegmentIndex + 1; i < timeline.segments.length; i++) {
            const segment = timeline.segments[i]
            if (!segment) continue

            lastEntry = this.spine.state.addAnimation(
                segment.trackIndex,
                segment.animationName,
                false,
                0,
            )
        }

        if (timeline.next) {
            timeline.next.started = false
            timeline.next.startedAtTime = undefined
            this.attachSequenceNextStart(lastEntry, timeline, timeline.next)

            this.spine.state.addAnimation(
                timeline.next.trackIndex,
                timeline.next.animationName,
                timeline.next.loop,
                0,
            )
        }
    }
}

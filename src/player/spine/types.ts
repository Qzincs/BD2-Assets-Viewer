export type SpineAsset = {
    skelUrl: string
    atlasUrl: string
}

export type SpineLayoutOptions = {
    fit?: 'contain' | 'fixed'
    scale?: number
    offsetX?: number
    offsetY?: number
    anchorX?: number
    anchorY?: number
}

export type SpinePlayerOptions = {
    container: HTMLElement
    debug?: boolean
}

export type SpineInstanceOptions = {
    asset: SpineAsset
    layout?: SpineLayoutOptions
    /**
     * Higher zIndex values will be rendered on top of lower ones.
     */
    zIndex?: number

    visible?: boolean
    alpha?: number
}

export type PlayAnimationOptions = {
    trackIndex?: number
    loop?: boolean

    /**
     * Should the animation hold on the last frame when it finishes?
     */
    hold?: boolean

    /**
     * Mix duration for this animation transition. If not set, the default mix or the mix set by setMix will be used.
     */
    mixDuration?: number
}

/**
 * Animation sequence on the same track.
 */
export type PlaySequenceOptions = {
    trackIndex?: number

    /**
     * Whether the whole sequence should loop from the first animation after it finishes.
     */
    loop?: boolean

    /**
     * Convenience option for playing the last animation again after the sequence finishes.
     * Equivalent to next: { animationName: lastAnimationName, loop: true }.
     */
    loopLast?: boolean

    /**
     * If true, the last animation will hold on its last frame when it finishes, instead of immediately ending.
     */
    holdLast?: boolean

    /**
     * An optional next animation to play after the sequence finishes. For example, a common use case is to play an animation sequence and then loop an idle animation.
     */
    next?: {
        animationName: string
        loop?: boolean
    }
}

/**
 * Animations played on multiple tracks.
 * Useful when track 0 plays the base animation and tracks 1/2 overlay effects.
 */
export type TrackAnimation = {
    trackIndex: number
    animationName: string
    loop?: boolean
    hold?: boolean
}

/**
 * A layer instance in a composed animation.
 *
 * Note:
 * If the same Spine asset needs to be overlaid as two independent layers,
 * define it as two composition layers instead of putting both animations on
 * different tracks in the same Spine instance.
 */
export type SpineCompositionLayer = {
    id: string
    asset: SpineAsset

    zIndex?: number
    layout?: SpineLayoutOptions

    visible?: boolean
    alpha?: number

    /**
     * Whether to keep this layer after playback finishes.
     * For example, an effect may hold on its last frame or a pose layer may stay visible.
     */
    hold?: boolean

    /**
     * Default animation mix duration for this layer.
     */
    defaultMix?: number

    /**
     * Animation-specific mix rules for this layer.
     */
    mixes?: {
        from: string
        to: string
        duration: number
    }[]

    animation:
    | {
        type: 'single'
        animationName: string
        loop?: boolean
        trackIndex?: number
        hold?: boolean
    }
    | {
        type: 'sequence'
        animationNames: string[]
        trackIndex?: number
        loopLast?: boolean
        holdLast?: boolean
        next?: {
            animationName: string
            loop?: boolean
        }
    }
    | {
        type: 'tracks'
        tracks: TrackAnimation[]
    }
}

export type SpineComposition = {
    /**
     * Whether to clear existing instances before playback.
     * Defaults to true.
     */
    clearBeforePlay?: boolean

    /**
     * Shared layout options for multiple layers.
     * layer.layout overrides these values.
     */
    sharedLayout?: SpineLayoutOptions

    layers: SpineCompositionLayer[]
}

type PlaybackOptionBase = {
    /**
     * Stable id used by UI controls and playback state.
     */
    id: string

    /**
     * Human-readable label shown in player controls.
     */
    label: string

    /**
     * Whether this option should appear in the animation dropdown.
     * Hidden options can still be played programmatically.
     */
    showInMenu?: boolean
}

/**
 * A playable item exposed to the player controls.
 *
 * This is higher-level than a raw Spine animation name. One option may map to
 * a single animation, a queued sequence, multiple parallel tracks, or a full
 * composition.
 */
export type PlayerAnimationOption =
    | (PlaybackOptionBase & {
        type: 'single'
        animationName: string
        loop?: boolean
    })
    | (PlaybackOptionBase & {
        type: 'sequence'
        animationNames: string[]
        loop?: boolean
        loopLast?: boolean
        next?: {
            animationName: string
            loop?: boolean
        }
    })
    | (PlaybackOptionBase & {
        type: 'tracks'
        tracks: TrackAnimation[]
        loop?: boolean
    })
    | (PlaybackOptionBase & {
        type: 'composition'
        composition: SpineComposition
        loop?: boolean
    })

/**
 * Runtime playback state exposed to UI controls.
 */
export type PlaybackState = {
    /**
     * Whether playback is still inside the selected item or has moved to its follow-up animation.
     */
    phase: 'main' | 'next'

    /**
     * Raw Spine animation currently active on the inspected track.
     */
    currentAnimationName?: string

    /**
     * Normalized progress for the active phase.
     */
    progress: number

    /**
     * Whether the active phase is looping.
     */
    loop: boolean
}

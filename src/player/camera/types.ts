/**
 * View transform applied to the player camera layer.
 */
export type CameraTransform = {
    x: number
    y: number
    scale: number
}

/**
 * Supported interpolation names for camera keyframes.
 *
 * The runtime can start with linear interpolation and add more easing behavior
 * later without changing timeline data shape.
 */
export type CameraEasing =
    | 'linear'
    | 'easeIn'
    | 'easeOut'
    | 'easeInOut'

/**
 * One camera state on a relative timeline.
 */
export type CameraKeyframe = CameraTransform & {
    /**
     * Time in seconds from the start of the timeline or action.
     */
    time: number

    /**
     * Easing used between this keyframe and the next one.
     */
    easing?: CameraEasing
}

/**
 * Automatic camera choreography for cutscene-style playback.
 *
 * A timeline is driven by a shared playback clock and does not depend on user
 * click interaction.
 */
export type CameraTimeline = {
    id: string
    keyframes: CameraKeyframe[]
}

/**
 * A reusable short camera movement triggered by gameplay or viewer events.
 *
 * Fated guest interactions can reference these actions without binding camera
 * data directly to every clickable region.
 */
export type CameraAction = {
    id: string
    keyframes: CameraKeyframe[]
}

/**
 * Minimal interaction payload shape for future event-driven camera playback.
 *
 * Different hit regions may trigger different animation or voice actions, but
 * they can still share one optional camera action.
 */
export type CameraActionReference = {
    cameraActionId?: string
}

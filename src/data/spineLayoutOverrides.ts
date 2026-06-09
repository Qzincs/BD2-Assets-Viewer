export type SpineLayoutOverride = {
    scale?: number
    offsetX?: number
    offsetY?: number
}

export const spineLayoutOverrides: Record<string, SpineLayoutOverride> = {
    'char000202': {
        scale: 1.2,
        offsetY: 50,
    },
    'char067101': {
        scale: 1.6,
    }
}
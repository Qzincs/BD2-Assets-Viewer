/**
 * Voice categories that may display localized dialogue text.
 */
export const dialogueVoiceCategories = [
    'BattleReady',
    'BattleVictory',
    'BattleSkill',
    'TalentSkill',
] as const

export type DialogueVoiceCategory = typeof dialogueVoiceCategories[number]

/**
 * Extracted voice category used for grouping and display ordering.
 */
export type VoiceCategory = string

/**
 * One playable voice asset with a stable id for future subtitle mapping.
 */
export type VoiceEntry = {
    id: string
    category: VoiceCategory
    index: number
    label: string
    fileName: string
    url: string
}

/**
 * Available voice entries for one costume, grouped by category.
 */
export type CostumeVoiceManifest = Partial<Record<VoiceCategory, VoiceEntry[]>>

/**
 * Voice resources indexed by normalized costume id.
 */
export type VoiceManifest = Record<string, CostumeVoiceManifest>

/**
 * Localized dialogue text indexed by stable voice id.
 */
export type VoiceSubtitleMap = Record<string, string>

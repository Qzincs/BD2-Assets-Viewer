import type { PlayerAnimationOption, SpineAsset } from '@/player/spine/types'

/**
 * Runtime data available when animation option rules are evaluated.
 */
export type AnimationOptionRuleContext = {
    costumeId: string
    asset: SpineAsset
    animationNames: string[]
}

/**
 * Optional scope limits for a generated animation option rule.
 *
 * A rule without appliesTo is global. Add one or more patterns when a rule
 * should only apply to selected costumes or asset files.
 */
export type AnimationOptionRuleScope = {
    costumeId?: RegExp
    skelUrl?: RegExp
    atlasUrl?: RegExp
}

/**
 * A fixed animation option rule creates at most one playback option.
 *
 * This is suitable for known combinations such as opening = motion -> idle.
 */
export type FixedAnimationOptionRule = {
    id: string
    appliesTo?: AnimationOptionRuleScope
    requiredAnimations: string[]
    option: PlayerAnimationOption
}

/**
 * A pattern track rule expands one matched animation family into many options.
 *
 * For example, one rule can create idle + _face0, idle + _face1_talk, and
 * other face variants discovered from the loaded Spine animations.
 */
export type PatternTrackAnimationOptionRule = {
    id: string
    appliesTo?: AnimationOptionRuleScope
    baseAnimationName: string
    matchAnimationName: RegExp
    optionIdTemplate: string
    labelTemplate: string
    baseTrackIndex: number
    matchedTrackIndex: number
    loop?: boolean
}

type GeneratedAnimationOption = {
    option: PlayerAnimationOption
    ruleId: string
}

const fixedAnimationOptionRules: FixedAnimationOptionRule[] = [
    {
        id: 'opening',
        requiredAnimations: ['motion', 'idle'],
        option: {
            id: 'opening',
            label: 'opening',
            type: 'sequence',
            animationNames: ['motion', 'idle'],
            loopLast: true,
        },
    },
]

const patternTrackAnimationOptionRules: PatternTrackAnimationOptionRule[] = [
    {
        id: 'idle_face_variants',
        baseAnimationName: 'idle',
        matchAnimationName: /^_face\d+(?:_talk)?$/,
        optionIdTemplate: 'idle+{animationName}',
        labelTemplate: 'idle + {animationName}',
        baseTrackIndex: 0,
        matchedTrackIndex: 1,
        loop: true,
    },
]

/**
 * Generates project-level playback options from data-driven rules.
 */
export function generateAnimationOptionsFromRules(
    context: AnimationOptionRuleContext,
): PlayerAnimationOption[] {
    const generatedOptions = [
        ...fixedAnimationOptionRules
            .filter((rule) => doesFixedRuleApply(rule, context))
            .map((rule) => ({
                option: rule.option,
                ruleId: rule.id,
            })),
        ...patternTrackAnimationOptionRules.flatMap((rule) => {
            return generatePatternTrackOptions(rule, context)
        }),
    ]

    return filterValidGeneratedOptions(generatedOptions, context)
}

function doesFixedRuleApply(
    rule: FixedAnimationOptionRule,
    context: AnimationOptionRuleContext,
): boolean {
    return doesScopeMatch(rule.appliesTo, context)
        && rule.requiredAnimations.every((animationName) => {
            return context.animationNames.includes(animationName)
        })
}

function generatePatternTrackOptions(
    rule: PatternTrackAnimationOptionRule,
    context: AnimationOptionRuleContext,
): GeneratedAnimationOption[] {
    if (!doesPatternRuleApply(rule, context)) return []

    return context.animationNames
        .filter((animationName) => rule.matchAnimationName.test(animationName))
        .map((animationName) => ({
            option: createPatternTrackOption(rule, animationName),
            ruleId: rule.id,
        }))
}

function doesPatternRuleApply(
    rule: PatternTrackAnimationOptionRule,
    context: AnimationOptionRuleContext,
): boolean {
    return doesScopeMatch(rule.appliesTo, context)
        && context.animationNames.includes(rule.baseAnimationName)
}

function createPatternTrackOption(
    rule: PatternTrackAnimationOptionRule,
    animationName: string,
): PlayerAnimationOption {
    const loop = rule.loop ?? false

    return {
        id: applyAnimationTemplate(rule.optionIdTemplate, animationName),
        label: applyAnimationTemplate(rule.labelTemplate, animationName),
        type: 'tracks',
        loop,
        tracks: [
            {
                trackIndex: rule.baseTrackIndex,
                animationName: rule.baseAnimationName,
                loop,
            },
            {
                trackIndex: rule.matchedTrackIndex,
                animationName,
                loop,
            },
        ],
    }
}

function applyAnimationTemplate(template: string, animationName: string): string {
    return template.replaceAll('{animationName}', animationName)
}

function filterValidGeneratedOptions(
    generatedOptions: GeneratedAnimationOption[],
    context: AnimationOptionRuleContext,
): PlayerAnimationOption[] {
    const rawAnimationIds = new Set(context.animationNames)
    const acceptedOptionIds = new Set<string>()
    const validOptions: PlayerAnimationOption[] = []

    for (const generatedOption of generatedOptions) {
        const optionId = generatedOption.option.id

        if (rawAnimationIds.has(optionId)) {
            warnSkippedGeneratedOption(
                generatedOption,
                `id collides with raw Spine animation "${optionId}"`,
            )
            continue
        }

        if (acceptedOptionIds.has(optionId)) {
            warnSkippedGeneratedOption(
                generatedOption,
                `duplicate generated id "${optionId}"`,
            )
            continue
        }

        acceptedOptionIds.add(optionId)
        validOptions.push(generatedOption.option)
    }

    return validOptions
}

function warnSkippedGeneratedOption(
    generatedOption: GeneratedAnimationOption,
    reason: string,
) {
    if (!import.meta.env.DEV) return

    console.warn(
        `[AnimationRules] skipped option "${generatedOption.option.id}" from rule "${generatedOption.ruleId}": ${reason}`,
    )
}

function doesScopeMatch(
    scope: AnimationOptionRuleScope | undefined,
    context: AnimationOptionRuleContext,
): boolean {
    if (!scope) return true

    if (scope.costumeId && !scope.costumeId.test(context.costumeId)) {
        return false
    }

    if (scope.skelUrl && !scope.skelUrl.test(context.asset.skelUrl)) {
        return false
    }

    if (scope.atlasUrl && !scope.atlasUrl.test(context.asset.atlasUrl)) {
        return false
    }

    return true
}

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const voicesDirectory = path.join(projectRoot, 'public/assets/voices')
const costumeIdsFile = path.join(projectRoot, 'src/data/generated/costumeIds.ts')
const outputFile = path.join(projectRoot, 'src/data/generated/voiceManifest.ts')

const dialogueCategories = [
    'BattleReady',
    'BattleVictory',
    'BattleSkill',
    'TalentSkill',
]

const voiceFilePattern = /^Char(\d{6})_(.+)\.wav$/i
const indexedVoiceNamePattern = /^(.+)_(\d+)$/

const directoryEntries = await fs.readdir(voicesDirectory, { withFileTypes: true })
const costumeDirectories = directoryEntries
    .filter((entry) => entry.isDirectory() && /^char\d{6}$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))

const manifest = {}

for (const directory of costumeDirectories) {
    const costumeId = directory.name.toLowerCase()
    const directoryPath = path.join(voicesDirectory, directory.name)
    const fileNames = (await fs.readdir(directoryPath)).sort()
    const parsedVoices = []

    for (const fileName of fileNames) {
        const match = voiceFilePattern.exec(fileName)
        if (!match) continue

        const [, numericId, rawVoiceName] = match
        if (!numericId || !rawVoiceName) continue

        const fileCostumeId = `char${numericId}`.toLowerCase()
        if (fileCostumeId !== costumeId) {
            console.warn(
                `[VoiceManifest] skipped ${directory.name}/${fileName}: file id does not match directory id`,
            )
            continue
        }

        const indexedMatch = indexedVoiceNamePattern.exec(rawVoiceName)
        const category = indexedMatch?.[1] ?? rawVoiceName
        const index = Number(indexedMatch?.[2] ?? 1)
        const hasExplicitIndex = indexedMatch !== null
        const dialogueCategory = dialogueCategories.find((item) => {
            return item.toLowerCase() === category.toLowerCase()
        })

        parsedVoices.push({
            category: dialogueCategory ?? category,
            index,
            hasExplicitIndex,
            rawVoiceName,
            fileName,
        })
    }

    const groupedVoices = new Map()

    for (const voice of parsedVoices) {
        const voices = groupedVoices.get(voice.category) ?? []
        voices.push(voice)
        groupedVoices.set(voice.category, voices)
    }

    const orderedCategories = [...groupedVoices.keys()].sort(compareCategories)
    const costumeVoices = {}

    for (const category of orderedCategories) {
        const voices = groupedVoices.get(category) ?? []
        voices.sort((left, right) => {
            return left.index - right.index
                || left.rawVoiceName.localeCompare(right.rawVoiceName)
        })

        costumeVoices[category] = voices.map((voice) => {
            const isDialogue = dialogueCategories.includes(category)
            const categoryId = `${category[0].toLowerCase()}${category.slice(1)}`
            const voiceId = isDialogue
                ? `${costumeId}.${categoryId}.${voice.index}`
                : `${costumeId}.${toStableIdSegment(voice.rawVoiceName)}`

            return {
                id: voiceId,
                category,
                index: voice.index,
                label: createVoiceLabel(voice, voices.length, isDialogue),
                fileName: voice.fileName,
                url: `/assets/voices/${directory.name}/${voice.fileName}`,
            }
        })
    }

    if (Object.keys(costumeVoices).length > 0) {
        manifest[costumeId] = costumeVoices
    }
}

function compareCategories(left, right) {
    const leftIndex = dialogueCategories.indexOf(left)
    const rightIndex = dialogueCategories.indexOf(right)

    if (leftIndex >= 0 || rightIndex >= 0) {
        if (leftIndex < 0) return 1
        if (rightIndex < 0) return -1
        return leftIndex - rightIndex
    }

    return left.localeCompare(right)
}

function createVoiceLabel(voice, categorySize, isDialogue) {
    const categoryLabel = humanizeVoiceName(voice.category)

    if (!voice.hasExplicitIndex) return categoryLabel
    if (!isDialogue && categorySize === 1 && voice.index === 1) return categoryLabel

    return /\d$/.test(categoryLabel)
        ? `${categoryLabel}-${voice.index}`
        : `${categoryLabel} ${voice.index}`
}

function humanizeVoiceName(value) {
    return value
        .replace(/_/g, ' ')
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
}

function toStableIdSegment(value) {
    return value
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
}

const costumeIdsSource = await fs.readFile(costumeIdsFile, 'utf8')
const currentCostumeIds = [
    ...costumeIdsSource.matchAll(/"costumeId": "(char\d{6})"/g),
].map((match) => match[1])

const missingBattleReady = currentCostumeIds.filter((costumeId) => {
    return !manifest[costumeId]?.BattleReady?.length
})

if (missingBattleReady.length > 0) {
    throw new Error(
        `[VoiceManifest] current costumes missing BattleReady voices: ${missingBattleReady.join(', ')}`,
    )
}

const output = `// This file is generated by scripts/generate-voice-manifest.mjs.\n`
    + `// Do not edit manually.\n\n`
    + `import type { VoiceManifest } from '@/types/voice'\n\n`
    + `export const voiceManifest: VoiceManifest = ${JSON.stringify(manifest, null, 2)}\n`

await fs.writeFile(outputFile, output)

console.log(
    `[VoiceManifest] generated ${Object.keys(manifest).length} costume entries; verified ${currentCostumeIds.length} current costumes`,
)

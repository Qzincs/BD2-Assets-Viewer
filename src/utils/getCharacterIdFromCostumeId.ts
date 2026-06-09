/**
 * Get character ID from costume ID. Character ID is the first 4 digits of costume ID, with 'char' prefix.
 * @param costumeId 
 * @returns 
 */
export function getCharacterIdFromCostumeId(costumeId: string): string {
    const numeric = costumeId.replace(/^char/, '')

    // Special mapping, char0604 and char1016 both represent Celia
    if (numeric.startsWith('1016')) {
        return 'char0604'
    }

    return `char${numeric.slice(0, 4)}`
}

/**
 * Determine if a costume is a prestige skin
 * If the second-to-last digit is 9, it represents a prestige skin
 */
export function isPrestigeCostume(costumeId: string): boolean {
    const numeric = costumeId.replace(/^char/, '')
    return numeric[4] === '9'
}
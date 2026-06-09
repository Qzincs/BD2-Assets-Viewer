import { generatedCostumeIds } from '@/data/generated/costumeIds'
import type { Costume } from '@/types/costume'

export const costumes: Costume[] = generatedCostumeIds.map((item) => ({
    id: item.costumeId,
}))
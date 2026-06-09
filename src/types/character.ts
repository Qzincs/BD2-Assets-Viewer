export type Gender = 'male' | 'female' | 'none'
export type ElementType = 'water' | 'fire' | 'wind' | 'light' | 'dark' | 'none'
export type Rarity = 3 | 4 | 5 | 'none'
export type AttackType = 'physical' | 'magic' | 'none'

export type Character = {
    id: string
    gender: Gender
    element?: ElementType
    rarity?: Rarity
    attackType?: AttackType
}
import type { SpineAsset } from '@/player/spine/types'

export function getCostumeSpineAsset(costumeId: string): SpineAsset {
    return {
        skelUrl: `/assets/spines/${costumeId}/${costumeId}.skel`,
        atlasUrl: `/assets/spines/${costumeId}/${costumeId}.atlas`,
    }
}

export function getNamedSpineAsset(basePath: string, fileName: string): SpineAsset {
    return {
        skelUrl: `${basePath}/${fileName}.skel`,
        atlasUrl: `${basePath}/${fileName}.atlas`,
    }
}
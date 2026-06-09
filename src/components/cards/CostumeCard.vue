<script setup lang="ts">
import type { ElementType } from '@/types/character'

const props = defineProps<{
    id: string
    characterName: string
    costumeName: string
    element: ElementType
}>()

const emit = defineEmits<{
    select: [id: string]
}>()

const elementGradientClass: Record<ElementType, string> = {
    fire: 'bg-gradient-to-t from-[#242326] to-[#572C2F]',
    water: 'bg-gradient-to-t from-[#242528] to-[#3D4C56]',
    wind: 'bg-gradient-to-t from-[#242326] to-[#34473B]',
    light: 'bg-gradient-to-t from-[#2C2C2B] to-[#5B5642]',
    dark: 'bg-gradient-to-t from-[#242326] to-[#504859]',
    none: 'bg-gradient-to-t from-[#242326] to-[#3a3a3a]',
}

</script>

<template>
    <div class="w-full flex flex-col rounded bg-[#2a323c] p-1 opacity-90 transition duration-200 hover:opacity-100 hover:bg-[#34404d] hover:shadow-lg hover:-translate-y-0.5 cursor-pointer select-none"
        @click="emit('select', props.id)">
        <div class="flex-0 h-6 flex items-center justify-center mt-0.5">
            <span class="truncate text-sm font-medium">{{ props.characterName }}</span>
        </div>

        <div class="flex-1 mt-1 aspect-square overflow-hidden rounded" :class="elementGradientClass[props.element]">
            <img :src="`/assets/illusts/inventory/${props.id}.png`" :alt="props.costumeName"
                class="h-full w-full object-cover" />
        </div>

        <div class="mt-1 h-10 flex items-center justify-center px-1">
            <span
                class="text-center text-sm leading-5 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
                :title="props.costumeName">{{ props.costumeName
                }}</span>
        </div>
    </div>
</template>
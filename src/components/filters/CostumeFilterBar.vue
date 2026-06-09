<script setup lang="ts">

interface FilterOption {
    name: string
    icon: string
    value: string | number
    activeBg?: string
}

interface FilterGroup {
    label: string
    options: FilterOption[]
}

const props = defineProps<{
    groups: FilterGroup[]
    activeFilters: Record<string, string | number | null>
    defaultActiveBg?: string
}>()

const defaultActiveBg = props.defaultActiveBg || 'bg-[#dddddd]'

const emits = defineEmits<{
    (e: 'update:activeFilters', payload: Record<string, string | number | null>): void
}>()

function toggleFilter(groupLabel: string, value: string | number) {
    const newFilters = { ...props.activeFilters }

    if (newFilters[groupLabel] === value) {
        newFilters[groupLabel] = null
    } else {
        newFilters[groupLabel] = value
    }

    emits('update:activeFilters', newFilters)
}

</script>

<template>
    <div class="flex flex-wrap gap-2 mb-4">
        <ul v-for="group in props.groups" :key="group.label"
            class="menu menu-horizontal bg-base-300 rounded-lg gap-2 flex-nowrap">
            <li v-for="option in group.options" :key="option.name" class="grow">
                <button class="flex h-6 items-center justify-center rounded-md px-1 py-0 transition-colors duration-150"
                    :class="props.activeFilters[group.label] === option.value
                        ? (option.activeBg || defaultActiveBg)
                        : 'hover:bg-base-content/10'
                        " @click="toggleFilter(group.label, option.value)">
                    <img :src="option.icon" class="w-6 h-6 transition duration-150" :class="props.activeFilters[group.label] === option.value
                        ? 'brightness-0'
                        : ''
                        " />
                </button>
            </li>
        </ul>
    </div>
</template>
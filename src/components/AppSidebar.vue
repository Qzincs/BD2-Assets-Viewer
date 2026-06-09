<script setup lang="ts">
type MenuItem = {
    name: string
    icon: string
}

const props = defineProps<{
    collapsed: boolean
    menuItems: MenuItem[]
    selectedMenu: string
}>()

const emits = defineEmits<{
    selectMenu: [name: string]
}>()
</script>

<template>
    <aside
        class="fixed top-16 left-0 h-[calc(100dvh-64px)] z-40 bg-base-100 border-r border-base-300 p-4 flex flex-col gap-6 overflow-hidden transition-[width] duration-200 ease-in-out"
        :class="collapsed ? 'w-16' : 'w-44'">
        <button v-for="item in menuItems" :title="collapsed ? item.name : ''" :key="item.name"
            class="w-full flex items-center gap-2 px-1 bg-transparent border-none p-0 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
            @click="emits('selectMenu', item.name)">
            <span class="w-6 h-6 shrink-0 grid place-items-center transition-all duration-200" :class="{
                'filter drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]': props.selectedMenu === item.name,
                'hover:drop-shadow-[0_0_8px_rgba(255,255,255,1)]': props.selectedMenu !== item.name
            }">
                <img :src="item.icon" class="w-6 h-6" />
            </span>

            <span class="font-medium whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200"
                :class="collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'">
                {{ item.name }}
            </span>
        </button>
    </aside>
</template>
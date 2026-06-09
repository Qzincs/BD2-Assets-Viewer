<script setup lang="ts">
const emits = defineEmits<{
    toggleSidebar: []
}>()
</script>

<template>
    <header class="fixed top-0 left-0 right-0 flex items-center justify-between h-16 px-4 bg-base-100 shadow z-50">
        <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-circle btn-sm" @click="$emit('toggleSidebar')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            <span class="font-bold text-lg text-base-content">BD2 Assets Viewer</span>
        </div>

        <div>
            <button class="btn btn-ghost btn-sm text-base-content">Settings</button>
        </div>
    </header>
</template>
<script setup lang="ts">
import PixiStage from '@/components/player/PixiStage.vue'

const props = defineProps<{
    costumeId: string
}>()
</script>

<template>
    <section class="h-[calc(100dvh-64px)] bg-[#10131a]">
        <div class="relative h-full w-full overflow-hidden">
            <PixiStage :costume-id="props.costumeId" />

            <div class="absolute left-4 top-4 rounded bg-black/40 px-4 py-2 text-sm text-white backdrop-blur">
                Costume ID: {{ props.costumeId }}
            </div>

            <div
                class="absolute left-0 right-0 bottom-0 border-t border-white/10 bg-black/40 px-6 py-4 text-white backdrop-blur">
                <div class="mb-3 h-1 rounded-full bg-white/20">
                    <div class="h-full w-1/3 rounded-full bg-white/70"></div>
                </div>

                <div class="flex items-center gap-3">
                    <button class="btn btn-sm">Play</button>
                    <button class="btn btn-sm">Idle</button>
                    <button class="btn btn-sm">Motion</button>
                    <button class="btn btn-sm">Reset</button>
                </div>
            </div>
        </div>
    </section>
</template>
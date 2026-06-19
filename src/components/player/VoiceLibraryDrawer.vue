<script setup lang="ts">
import { computed } from 'vue'
import { AudioLines, Play, X } from '@lucide/vue'
import { getVoiceDisplayText, hasVoiceSubtitle } from '@/data/voiceSubtitles'
import type { CostumeVoiceManifest, VoiceEntry } from '@/types/voice'
import type { Locale } from '@/types/locale'

const props = withDefaults(defineProps<{
    open: boolean
    voices?: CostumeVoiceManifest
    locale?: Locale
    currentVoiceId?: string
}>(), {
    voices: () => ({}),
    locale: 'zh-CN',
})

const emit = defineEmits<{
    close: []
    voiceSelect: [voice: VoiceEntry]
}>()

const voiceGroups = computed(() => {
    const dialogueVoices: VoiceEntry[] = []
    const otherVoices: VoiceEntry[] = []

    for (const voices of Object.values(props.voices)) {
        if (!voices) continue

        for (const voice of voices) {
            if (hasVoiceSubtitle(voice.id)) {
                dialogueVoices.push(voice)
            } else {
                otherVoices.push(voice)
            }
        }
    }

    return [
        {
            category: 'dialogue',
            label: 'Dialogue',
            voices: dialogueVoices,
        },
        {
            category: 'other',
            label: 'Other Voices',
            voices: otherVoices,
        },
    ].filter((group) => group.voices.length > 0)
})
</script>

<template>
    <div v-if="props.open" class="absolute inset-x-0 top-0 bottom-14 z-20">
        <button
            class="absolute inset-0 bg-transparent"
            type="button"
            aria-label="Close voice library"
            @click="emit('close')"
        ></button>

        <aside
            class="absolute top-0 right-0 h-full w-full border-l border-white/10 bg-[#10131a]/95 text-white shadow-2xl backdrop-blur-xl sm:w-96"
            aria-label="Voice library"
        >
            <header class="flex h-16 items-center justify-between border-b border-white/10 px-5">
                <div class="flex items-center gap-3">
                    <AudioLines class="h-5 w-5 text-white/70" />
                    <h2 class="text-base font-semibold tracking-wide">Voices</h2>
                </div>

                <button
                    class="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                    type="button"
                    aria-label="Close voice library"
                    @click="emit('close')"
                >
                    <X class="h-4 w-4" />
                </button>
            </header>

            <div class="h-[calc(100%-4rem)] overflow-y-auto overscroll-contain px-5 py-4">
                <section v-for="group in voiceGroups" :key="group.category" class="mb-6 last:mb-0">
                    <h3 class="mb-2 text-xs font-semibold tracking-[0.16em] text-white/40 uppercase">
                        {{ group.label }}
                    </h3>

                    <div class="divide-y divide-white/10 border-y border-white/10">
                        <button
                            v-for="voice in group.voices"
                            :key="voice.id"
                            class="flex min-h-14 w-full items-center gap-3 px-1 py-3 text-left text-sm transition hover:bg-white/5 hover:text-white"
                            :class="voice.id === props.currentVoiceId ? 'text-white' : 'text-white/80'"
                            type="button"
                            :aria-pressed="voice.id === props.currentVoiceId"
                            @click="emit('voiceSelect', voice)"
                        >
                            <AudioLines
                                v-if="voice.id === props.currentVoiceId"
                                class="h-4 w-4 shrink-0 text-white"
                            />
                            <Play v-else class="h-4 w-4 shrink-0 text-white/40" />
                            <span class="leading-5">
                                {{ getVoiceDisplayText(voice, props.locale) }}
                            </span>
                        </button>
                    </div>
                </section>
            </div>
        </aside>
    </div>
</template>

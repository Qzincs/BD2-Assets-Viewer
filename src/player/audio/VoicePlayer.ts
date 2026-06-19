import type { VoiceEntry } from '@/types/voice'

/**
 * Plays costume voice assets with interruption and non-repeating selection.
 */
export class VoicePlayer {
    private audio: HTMLAudioElement | null = null
    private lastPlayedVoiceId: string | undefined

    constructor(
        private readonly onPlaybackChange: (voice: VoiceEntry | undefined) => void = () => {},
    ) {}

    /**
     * Plays one voice entry, interrupting any voice that is already playing.
     */
    play(voice: VoiceEntry) {
        this.stop()

        const audio = new Audio(voice.url)
        this.audio = audio
        this.lastPlayedVoiceId = voice.id
        this.onPlaybackChange(voice)

        audio.addEventListener('ended', () => {
            if (this.audio === audio) {
                this.audio = null
                this.onPlaybackChange(undefined)
            }
        }, { once: true })

        void audio.play().catch((error: unknown) => {
            if (this.audio !== audio) return

            this.audio = null
            this.onPlaybackChange(undefined)

            if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
                console.warn(`[VoicePlayer] failed to play "${voice.id}"`, error)
            }
        })
    }

    /**
     * Plays a random voice that differs from the immediately previous choice.
     *
     * A single-entry list is allowed to repeat. Returns the selected entry so
     * callers can synchronize subtitles or other interaction state.
     */
    playRandom(voices: VoiceEntry[]): VoiceEntry | undefined {
        const voice = this.selectRandomVoice(voices)
        if (!voice) return undefined

        this.play(voice)
        return voice
    }

    /**
     * Stops the active voice and rewinds it before releasing the audio element.
     */
    stop() {
        if (!this.audio) return

        this.audio.pause()
        this.audio.currentTime = 0
        this.audio.src = ''
        this.audio.load()
        this.audio = null
        this.onPlaybackChange(undefined)
    }

    /**
     * Releases resources owned by this player.
     */
    destroy() {
        this.stop()
        this.lastPlayedVoiceId = undefined
    }

    private selectRandomVoice(voices: VoiceEntry[]): VoiceEntry | undefined {
        if (voices.length === 0) return undefined

        const candidates = voices.length > 1
            ? voices.filter((voice) => voice.id !== this.lastPlayedVoiceId)
            : voices
        const randomIndex = Math.floor(Math.random() * candidates.length)

        return candidates[randomIndex]
    }
}

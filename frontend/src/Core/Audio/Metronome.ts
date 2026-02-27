export class Metronome {
    #offlineAudioContext: OfflineAudioContext;
    #barker13: number[] = [1, 1, 1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1];
    #clickBuffer: Float32Array = new Float32Array();

    constructor(sampleRate: number = 48000) {
        const CLICK_DURATION_SAMPLES = Math.round(0.015 * sampleRate);
        this.#offlineAudioContext = new OfflineAudioContext(1, CLICK_DURATION_SAMPLES, sampleRate);
    }

    async loadMetronomeClickBuffer(): Promise<Float32Array> {
        const lengthInSeconds = 0.015;
        const osc = this.#offlineAudioContext.createOscillator();
        const envelope = this.#offlineAudioContext.createGain();

        osc.frequency.value = 1000;
        envelope.gain.value = 1;
        envelope.gain.setValueAtTime(1, 0.001);
        envelope.gain.exponentialRampToValueAtTime(0.001, 0.0021);

        osc.connect(envelope);
        envelope.connect(this.#offlineAudioContext.destination);

        osc.start(0);
        osc.stop(lengthInSeconds);

        return this.#offlineAudioContext.startRendering()
            .then((buffer) => {
                this.#clickBuffer = buffer.getChannelData(0);
                return this.#clickBuffer;
            })
            .catch((error) => {
                console.error("Error generating metronome click buffer:", error);
                throw error;
            });
    }

    getClickBuffer(): Float32Array {
        return this.#clickBuffer;
    }

    getElongatedBarker(factor: number): Float32Array {
        const elongatedBarker: number[] = [];
        for (const value of this.#barker13) {
            for (let i = 0; i < factor; i++) {
                elongatedBarker.push(value);
            }
        }
        return new Float32Array(elongatedBarker);
    }
}
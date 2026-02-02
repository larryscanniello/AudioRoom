
import { AudioEngine } from "./AudioEngine";
import { Play } from "../Events/Audio/Play"
import { Record } from "../Events/Audio/Record"
import { Stop } from "../Events/Audio/Stop"

import type { GlobalContext } from "../DAW"

export class AudioController{
    #engine: AudioEngine;
    #context: GlobalContext;

    constructor(engine: AudioEngine,context: GlobalContext) {
        this.#context = context;
        this.#engine = engine
    }

    public getAudioStream(): void {
        this.#engine.getAudioStream();
    }

    public play() {
        const playEvent = new Play();
        this.#context.dispatch(playEvent)
    }

    public record() {
        const recordEvent = new Record();
        this.#context.dispatch(recordEvent);
    }

    public stop() {
        const stopEvent = new Stop();
        this.#context.dispatch(stopEvent);
    }

    

}
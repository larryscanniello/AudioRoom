
import { Play } from "../Events/Audio/Play"
import { Record } from "../Events/Audio/Record"
import { Stop } from "../Events/Audio/Stop"

import type { StateContainer } from "../State";
import type { GlobalContext } from "../Mediator"
import type { AudioEngine } from "./AudioEngine";
import type { Mixer } from "./Mixer";
import type React from "react";



export class AudioController{
    #engine: AudioEngine;
    #context: GlobalContext;
    #gainNodes: {local: GainNode | null, remote: GainNode | null} = {local:null, remote:null};
    #mixer: Mixer;

    constructor(engine: AudioEngine,context:GlobalContext,mixer:Mixer) {
        this.#engine = engine
        this.#context = context;
        this.#mixer = mixer;
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

    public skipBack() {
        const skipBackEvent = new Skipback();
        this.#context.dispatch(skipBackEvent);
    }

    public toggleMetronome() {
        const toggleMetronomeEvent = new ToggleMetronome();
        this.#context.dispatch(toggleMetronomeEvent);
    }

    public toggleLooping() {
        const toggleLoopEvent = new ToggleLoop();
        this.#context.dispatch(toggleLoopEvent);
    }

    public changeStagingVolume(volume: number) {
        this.#mixer.setStagingMasterVolume(volume);
    }

    public changeMixVolume(volume: number) {
        this.#mixer.setMixMasterVolume(volume);
    }

    public muteStagingToggle() {
        this.#mixer.muteStagingToggle();
    }

    public muteMixToggle() {
        this.#mixer.muteMixToggle();
    }

    public isStagingTrackMuted(): boolean {
        return this.#context.query("stagingMuted");
    }

    public isMixTrackMuted(): boolean {
        return this.#context.query("mixMuted");
    }

    public query<K extends keyof StateContainer>(query: K): StateContainer[K] {
        return this.#context.query(query);
    }

    public onBPMMouseDown(e: React.MouseEvent<HTMLButtonElement>) {

    }

}
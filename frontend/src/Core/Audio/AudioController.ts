
import { Play } from "../Events/Audio/Play"

import type { StateContainer } from "../State";
import type { GlobalContext } from "../Mediator"
import type { AudioEngine } from "./AudioEngine";
import type { Mixer } from "./Mixer";


export class AudioController{
    #context: GlobalContext;
    #mixer: Mixer;

    constructor(_engine: AudioEngine,context:GlobalContext,mixer:Mixer) {
        this.#context = context;
        this.#mixer = mixer;
    }

    public play() {
        this.#context.dispatch(Play.dispatchEvent);
    }
/*
    public record() {
        const record = {
            type: EventTypes.START_RECORDING,
            data: null,
            getClass:()=>{return Record}}
        this.#context.dispatch(record);
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
*/
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


}
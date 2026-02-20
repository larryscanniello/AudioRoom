
import { Play } from "../Events/Audio/Play"
import { Record } from "../Events/Audio/Record"
import { Stop } from "../Events/Audio/Stop"
import { Skipback } from "../Events/Audio/Skipback";
import { Metronome } from "../Events/Audio/Metronome";
import { Loop } from "../Events/Audio/Loop";

import type { StateContainer } from "../State/State";
import type { GlobalContext } from "../Mediator"
import type { AudioEngine } from "./AudioEngine";
import type { Mixer } from "./Mixer";

import timelineReducer from "../State/timelineReducer";
import { Bounce } from "../Events/Audio/Bounce";


export class AudioController{
    #context: GlobalContext;
    #mixer: Mixer;
    #audioEngine: AudioEngine;

    constructor(audioEngine: AudioEngine,context:GlobalContext,mixer:Mixer) {
        this.#audioEngine = audioEngine;
        this.#context = context;
        this.#mixer = mixer;
    }

    public play() {
        this.#context.dispatch(Play.getDispatchEvent({emit:true, param: null,serverMandated: false}));
    }

    public record() {
        this.#context.dispatch(Record.getDispatchEvent({emit:true, param: null,serverMandated: false}));
    }

    public stop() {
        this.#context.dispatch(Stop.getDispatchEvent({emit:true, param: null,serverMandated: false}));
    }  

    public skipBack() {
        this.#context.dispatch(Skipback.getDispatchEvent({emit:true, param: null,serverMandated: false}));
    }

    public bounce(){
        const timeline = this.#context.query("timeline");
        const newTimeline = timelineReducer(timeline, { type: "bounce_to_mix" });
        this.#context.dispatch(Bounce.getDispatchEvent({emit:true, param: newTimeline,serverMandated: false}));
    }

    public toggleMetronome() {
        const isMetronomeOn = this.#context.query("isMetronomeOn");
        this.#context.dispatch(Metronome.getDispatchEvent({emit:true, param: !isMetronomeOn,serverMandated: false}));
    }

    public toggleLooping() {
        const isLooping = this.#context.query("isLooping");
        this.#context.dispatch(Loop.getDispatchEvent({emit:true, param: !isLooping,serverMandated: false}));
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

    public initAudioEngine(){
        this.#audioEngine.init();
    }

}
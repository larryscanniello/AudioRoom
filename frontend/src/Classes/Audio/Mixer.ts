import type { GlobalContext } from "../Mediator";

type masterGainParams = {
    stagingMasterVolumeParam: AudioParam,
    mixMasterVolumeParam: AudioParam,
}

export class Mixer {
    #audioContext: AudioContext;
    #mixMasterVolume: {param: AudioParam, muted: boolean};
    #stagingMasterVolume: {param: AudioParam, muted: boolean};
    #mixTracksGainNodes: GainNode[];
    #context: GlobalContext;

    constructor(numberOfMixChannels: number = 16,
                audioContext: AudioContext,
                masterGainParams: masterGainParams,
                context: GlobalContext) {
        this.#audioContext = audioContext;
        this.#stagingMasterVolume = { latent: 1.0, param: masterGainParams.stagingMasterVolumeParam, muted: false};
        this.#mixMasterVolume = { latent: 1.0, param: masterGainParams.mixMasterVolumeParam, muted: false};
        this.#mixTracksGainNodes = new Array(numberOfMixChannels).fill(null).map(() => this.#audioContext.createGain());
    }

    setStagingMasterVolume(volume: number) {
       if(!this.#stagingMasterVolume.muted){
            this.#stagingMasterVolume.param.value = volume; //this changes actual audio gain
       }
       this.#context.dispatch(new StagingMasterVolChange(volume)); //this updates state for UI
    }

    setMixMasterVolume(volume: number) {
        if(!this.#mixMasterVolume.muted){
            this.#mixMasterVolume.param.value = volume;
        }
        this.#context.dispatch(new MixMasterVolChange(volume));
    }

    muteStagingToggle() {
        const muted = !this.#stagingMasterVolume.muted;
        this.#stagingMasterVolume.muted = muted;
        this.#stagingMasterVolume.param.value = muted ? 0 : this.#context.query("stagingMasterVolume");
    }

    muteMixToggle() {
        const muted = !this.#mixMasterVolume.muted;
        this.#mixMasterVolume.muted = muted;
        this.#mixMasterVolume.param.value = muted ? 0 : this.#context.query("mixMasterVolume");
    }

    isStagingTrackMuted(): boolean {
        return this.#stagingMasterVolume.muted;
    }

    isMixTrackMuted(): boolean {
        return this.#mixMasterVolume.muted;
    }
}
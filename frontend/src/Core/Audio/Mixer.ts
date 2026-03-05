import type { GlobalContext } from "../Mediator";

type masterGainParams = {
    stagingMasterVolumeParam: AudioParam,
    mixMasterVolumeParam: AudioParam,
}

export class Mixer { 

    _audioContext: AudioContext;
    #mixMasterVolume: {param: AudioParam, muted: boolean, latent: number};
    #stagingMasterVolume: {param: AudioParam, muted: boolean, latent: number};
    #context: GlobalContext;

    constructor(_numberOfMixChannels: number = 16,
                audioContext: AudioContext,
                masterGainParams: masterGainParams,
                context: GlobalContext) {
        this._audioContext = audioContext;
        this.#stagingMasterVolume = { latent: 1.0, param: masterGainParams.stagingMasterVolumeParam, muted: false};
        this.#mixMasterVolume = { latent: 1.0, param: masterGainParams.mixMasterVolumeParam, muted: false};
        this.#context = context;
    }

    setStagingMasterVolume(volume: number) {
       if(!this.#stagingMasterVolume.muted){
            this.#stagingMasterVolume.param.value = volume;
       }
    }

    setMixMasterVolume(volume: number) {
        if(!this.#mixMasterVolume.muted){
            this.#mixMasterVolume.param.value = volume;
        }
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
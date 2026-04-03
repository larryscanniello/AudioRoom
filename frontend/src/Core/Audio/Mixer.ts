import type { GlobalContext } from "../Mediator";
import type { MixerState } from "@/Types/AudioState";

type MixerParams = {
    stagingMasterVolumeParam: AudioParam,
    mixMasterVolumeParam: AudioParam,
    trackVolumeParams: AudioParam[],
}

export class Mixer {

    _audioContext: AudioContext;
    #params: Map<string, AudioParam>;
    #mixMasterVolume: {param: AudioParam, muted: boolean};
    #stagingMasterVolume: {param: AudioParam, muted: boolean};
    #context: GlobalContext;

    constructor(_numberOfMixChannels: number = 16,
                audioContext: AudioContext,
                mixerParams: MixerParams,
                context: GlobalContext) {
        this._audioContext = audioContext;
        this.#context = context;
        this.#stagingMasterVolume = { param: mixerParams.stagingMasterVolumeParam, muted: false };
        this.#mixMasterVolume = { param: mixerParams.mixMasterVolumeParam, muted: false };

        this.#params = new Map();
        this.#params.set('staging', mixerParams.stagingMasterVolumeParam);
        this.#params.set('master', mixerParams.mixMasterVolumeParam);
        mixerParams.trackVolumeParams.forEach((param, i) => {
            this.#params.set(`track-${i}`, param);
        });
    }

    syncMixerVolumes(mixerState: MixerState): void {
        for (const channel of mixerState.channels) {
            const param = this.#params.get(channel.id);
            if (param) {
                param.value = channel.volume;
            }
        }
    }

    // Legacy methods — still used by track header mute buttons
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

    setStagingMuted(muted: boolean) {
        this.#stagingMasterVolume.muted = muted;
        this.#stagingMasterVolume.param.value = muted ? 0 : this.#context.query("stagingMasterVolume");
    }

    setMixMuted(muted: boolean) {
        this.#mixMasterVolume.muted = muted;
        this.#mixMasterVolume.param.value = muted ? 0 : this.#context.query("mixMasterVolume");
    }
}
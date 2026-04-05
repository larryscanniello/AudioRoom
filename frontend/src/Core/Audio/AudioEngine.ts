
import type { Observer } from "@/Types/Observer";
import type { MixerState, EffectSlotConfig } from "@/Types/AudioState";

export interface AudioEngine extends Observer{

    play: (data: any) => void;
    record: (data: any) => void;
    stop: (data: any) => void;
    bounce: (data: any) => void;
    regenerateMixMipmap: (data: any) => void;
    reStage: (data: any) => void;
    toggleMetronome: () => void;
    otherPersonRecording: (data: any) => void;
    startLatencyTest: () => void;
    setMixMuted(muted: boolean): void;
    setStagingMuted(muted: boolean): void;
    setMixVolume(volume: number): void;
    setStagingVolume(volume: number): void;
    syncMixerVolumes(mixerState: MixerState): void;
    setEffectChain(trackIndex: number, chain: (EffectSlotConfig | null)[]): void;
    init(): void;
}
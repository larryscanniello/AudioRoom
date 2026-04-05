import { X } from "lucide-react";
import { Slider } from "@/Components/ui/slider";
import { MAX_EFFECT_SLOTS, MAX_AUX_SENDS } from "@/Constants/constants";
import type { AudioController } from "@/Core/Audio/AudioController";
import type { EffectSlotConfig, EffectType } from "@/Types/AudioState";
import { DEFAULT_EFFECT_PARAMS } from "@/Types/AudioState";
import EffectSlot from "./EffectSlot";
import AuxSendSlot from "./AuxSendSlot";

type MixerProps = {
    audioControllerRef: React.RefObject<AudioController | null>;
    compactMode: number;
    onClose: () => void;
};

type TrackStripProps = {
    name: string;
    channelId: string;
    volume: number;
    effects: (EffectSlotConfig | null)[];
    sends?: { auxId: string; level: number }[];
    audioControllerRef: React.RefObject<AudioController | null>;
    onVolumeChange?: (v: number) => void;
    onVolumeCommit?: (v: number) => void;
};

export function applyEffectSelect(
    effects: (EffectSlotConfig | null)[],
    slotIndex: number,
    effectType: EffectType | null,
): (EffectSlotConfig | null)[] {
    const next = [...effects];
    if (effectType === null) {
        next[slotIndex] = null;
        while (next.length > 0 && next[next.length - 1] === null) next.pop();
    } else {
        next[slotIndex] = { effectType, enabled: true, params: { ...DEFAULT_EFFECT_PARAMS[effectType] } };
    }
    return next;
}

function TrackStrip({ name, channelId, volume, effects, sends, audioControllerRef, onVolumeChange, onVolumeCommit }: TrackStripProps) {
    function handleEffectSelect(slotIndex: number, effectType: EffectType | null) {
        audioControllerRef.current?.setEffectChain(channelId, applyEffectSelect(effects, slotIndex, effectType));
    }

    return (
        <div className="shrink-0 flex flex-col items-center w-14 h-full pt-2 pb-1 gap-1">
            {/* Scrollable: fixed half-height, items render at natural size */}
            <div className="max-h-[50%] w-full overflow-y-auto shrink-0">
                <div className="flex flex-col gap-0.5">
                    {Array.from({ length: MAX_EFFECT_SLOTS }, (_, i) => (
                        <EffectSlot
                            key={i}
                            config={effects[i] ?? null}
                            onSelect={(type) => handleEffectSelect(i, type)}
                            onParamChange={(param, value) => audioControllerRef.current?.updateEffectParam(channelId, i, param, value)}
                        />
                    ))}
                    {sends && Array.from({ length: MAX_AUX_SENDS }, (_, i) => {
                        const send = sends[i] ?? { auxId: `aux-${i}`, level: 0 };
                        return (
                            <AuxSendSlot
                                key={i}
                                sendIndex={i}
                                auxId={send.auxId}
                                value={send.level}
                                onTargetChange={(newAuxId) =>
                                    audioControllerRef.current?.updateAuxSend(channelId, i, newAuxId, send.level)}
                                onLevelChange={(level) =>
                                    audioControllerRef.current?.updateAuxSend(channelId, i, send.auxId, level)}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Volume slider */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
                <Slider
                    orientation="vertical"
                    value={[volume]}
                    min={0}
                    max={1.0}
                    step={0.025}
                    className="h-full min-h-0"
                    onValueChange={(value: number[]) => {
                        onVolumeChange
                            ? onVolumeChange(value[0])
                            : audioControllerRef.current?.changeChannelVolumeLocal(channelId, value[0]);
                    }}
                    onValueCommit={(value: number[]) => {
                        onVolumeCommit
                            ? onVolumeCommit(value[0])
                            : audioControllerRef.current?.changeChannelVolume(channelId, value[0]);
                    }}
                />
            </div>
            <span className="truncate text-xs text-gray-400 text-center w-full py-0.5 leading-none">
                {name}
            </span>
        </div>
    );
}

export default function Mixer({ audioControllerRef, compactMode: _compactMode, onClose }: MixerProps) {
    const timeline = audioControllerRef.current?.query("timeline");
    const mixerState = audioControllerRef.current?.query("mixerState");
    const bounceCount = timeline?.mix.length ?? 0;
    const bounceNames = timeline?.bounceNames ?? [];

    const getVolume = (channelId: string) =>
        mixerState?.channels.find(ch => ch.id === channelId)?.volume ?? 1.0;

    const getEffects = (channelId: string) =>
        mixerState?.channels.find(ch => ch.id === channelId)?.effects ?? [];

    const getSends = (channelId: string) =>
        mixerState?.channels.find(ch => ch.id === channelId)?.sends ?? [];

    return (
        <div className="flex flex-row w-full h-full overflow-hidden">
            {/* Scrollable track strips — no top header */}
            <div className="flex flex-row items-stretch flex-1 min-w-0 overflow-x-auto overflow-y-hidden gap-1 px-2">
                <TrackStrip
                    name="Staging"
                    channelId="staging"
                    volume={audioControllerRef.current?.query("stagingMasterVolume") ?? 1}
                    effects={getEffects('staging')}
                    sends={getSends('staging')}
                    audioControllerRef={audioControllerRef}
                    onVolumeChange={(v) => audioControllerRef.current?.changeStagingVolumeLocal(v)}
                    onVolumeCommit={(v) => audioControllerRef.current?.changeStagingVolume(v)}
                />
                {Array.from({ length: bounceCount }, (_, i) => (
                    <TrackStrip
                        key={i}
                        name={bounceNames[i] ?? `Bounce ${i + 1}`}
                        channelId={`track-${i}`}
                        volume={getVolume(`track-${i}`)}
                        effects={getEffects(`track-${i}`)}
                        sends={getSends(`track-${i}`)}
                        audioControllerRef={audioControllerRef}
                    />
                ))}
            </div>

            {/* Aux channels — pinned right of scrollable, left of master */}
            <div className="shrink-0 flex flex-row items-stretch border-l border-gray-600 gap-1 px-2">
                {(['aux-0', 'aux-1', 'aux-2'] as const).map((id, i) => (
                    <TrackStrip
                        key={id}
                        name={`Aux ${i + 1}`}
                        channelId={id}
                        volume={getVolume(id)}
                        effects={getEffects(id)}
                        audioControllerRef={audioControllerRef}
                    />
                ))}
            </div>

            {/* Mix + Master — pinned right, X button only here */}
            <div className="shrink-0 flex flex-col h-full px-2 border-l border-gray-600">
                <div className="flex items-center justify-end h-8 shrink-0">
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex-1 min-h-0 flex flex-row gap-1">
                    {/* Mix bus — slim strip, no effects/sends */}
                    <div className="shrink-0 flex flex-col items-center w-10 h-full pt-2 pb-1 gap-1">
                        <div className="flex-1 min-h-0 flex items-center justify-center">
                            <Slider
                                orientation="vertical"
                                value={[audioControllerRef.current?.query("mixMasterVolume") ?? 1]}
                                min={0}
                                max={1.0}
                                step={0.025}
                                className="h-full min-h-0"
                                onValueChange={(v: number[]) => audioControllerRef.current?.changeMixVolumeLocal(v[0])}
                                onValueCommit={(v: number[]) => audioControllerRef.current?.changeMixVolume(v[0])}
                            />
                        </div>
                        <span className="text-xs text-gray-400 text-center w-full py-0.5 leading-none">Mix</span>
                    </div>
                    <TrackStrip
                        name="Master"
                        channelId="master"
                        volume={getVolume('master')}
                        effects={getEffects('master')}
                        audioControllerRef={audioControllerRef}
                    />
                </div>
            </div>
        </div>
    );
}
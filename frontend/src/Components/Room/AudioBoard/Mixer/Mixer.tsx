import { X } from "lucide-react";
import { Slider } from "@/Components/ui/slider";
import type { AudioController } from "@/Core/Audio/AudioController";

type MixerProps = {
    audioControllerRef: React.RefObject<AudioController | null>;
    onClose: () => void;
};

type TrackStripProps = {
    name: string;
};

function TrackStrip({ name }: TrackStripProps) {
    return (
        <div className="shrink-0 flex flex-col items-center w-14 h-full pt-2 pb-1 gap-1">
            <div className="flex-1 min-h-0 flex items-center justify-center">
                <Slider
                    orientation="vertical"
                    defaultValue={[1.0]}
                    min={0}
                    max={1.0}
                    step={0.025}
                    className="h-full min-h-0"
                />
            </div>
            <span className="truncate text-xs text-gray-400 text-center w-full py-0.5 leading-none">
                {name}
            </span>
        </div>
    );
}

export default function Mixer({ audioControllerRef, onClose }: MixerProps) {
    const timeline = audioControllerRef.current?.query("timeline");
    const bounceCount = timeline?.mix.length ?? 0;
    const bounceNames = timeline?.bounceNames ?? [];

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-row items-center justify-end px-2 h-8 shrink-0">
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            {/* Body */}
            <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
                {/* Scrollable track strips */}
                <div className="flex flex-row items-stretch flex-1 min-w-0 overflow-x-auto overflow-y-hidden gap-1 px-2">
                    <TrackStrip name="Staging" />
                    {Array.from({ length: bounceCount }, (_, i) => (
                        <TrackStrip key={i} name={bounceNames[i] ?? `Bounce ${i + 1}`} />
                    ))}
                </div>

                {/* Master — pinned right */}
                <div className="shrink-0 flex flex-col h-full px-2 border-l border-gray-600">
                    <TrackStrip name="Master" />
                </div>
            </div>
        </div>
    );
}
import { useState, useRef } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/Components/ui/popover";
import { Slider } from "@/Components/ui/slider";
import type { EffectType, EffectSlotConfig } from "@/Types/AudioState";

const EFFECT_LABELS: Record<EffectType, string> = {
    lowpass:    'LP Filter',
    highpass:   'HP Filter',
    delay:      'Delay',
    distortion: 'Distort',
};

const EFFECT_OPTIONS: { type: EffectType; label: string }[] = [
    { type: 'lowpass',    label: 'Lowpass Filter' },
    { type: 'highpass',   label: 'Highpass Filter' },
    { type: 'delay',      label: 'Delay' },
    { type: 'distortion', label: 'Distortion' },
];

type ParamDef = {
    label: string;
    control: 'drag' | 'slider';
    min: number;
    max: number;
    sensitivity?: number; // px spanning full min→max range
    step?: number;        // slider only
    format?: (v: number) => string;
};

const PARAM_DEFS: Record<string, ParamDef> = {
    cutoffHz:  { label: 'Cutoff',  control: 'drag',   min: 20,   max: 20000, sensitivity: 160, format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}` },
    resonance: { label: 'Q',       control: 'drag',   min: 0.1,  max: 20,    sensitivity: 100, format: v => v.toFixed(1) },
    wet:       { label: 'Wet',     control: 'slider', min: 0,    max: 1,     step: 0.01 },
    timeMs:    { label: 'Time',    control: 'drag',   min: 1,    max: 2000,  sensitivity: 150, format: v => `${Math.round(v)}ms` },
    feedback:  { label: 'Fbk',    control: 'slider', min: 0,    max: 0.99,  step: 0.01 },
    drive:     { label: 'Drive',   control: 'drag',   min: 0.1,  max: 100,   sensitivity: 100, format: v => v.toFixed(1) },
};

const EFFECT_PARAMS: Record<EffectType, string[]> = {
    lowpass:    ['cutoffHz', 'resonance', 'wet'],
    highpass:   ['cutoffHz', 'resonance', 'wet'],
    delay:      ['timeMs', 'feedback', 'wet'],
    distortion: ['drive', 'wet'],
};

function DraggableParam({ def, value, onChange }: { def: ParamDef; value: number; onChange: (v: number) => void }) {
    const startY = useRef<number | null>(null);
    const startVal = useRef(0);

    function onMouseDown(e: React.MouseEvent) {
        e.preventDefault();
        startY.current = e.clientY;
        startVal.current = value;

        function onMove(e: MouseEvent) {
            const pct = (startY.current! - e.clientY) / (def.sensitivity ?? 100);
            const raw = startVal.current + pct * (def.max - def.min);
            onChange(Math.max(def.min, Math.min(def.max, Math.round(raw * 100) / 100)));
        }

        function onUp() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    return (
        <div
            onMouseDown={onMouseDown}
            className="flex-1 h-6 bg-gray-800 hover:bg-gray-750 text-[11px] text-gray-200 font-mono px-1.5 flex items-center cursor-ns-resize select-none rounded-sm"
        >
            {def.format ? def.format(value) : value.toFixed(2)}
        </div>
    );
}

type EffectSlotProps = {
    config: EffectSlotConfig | null;
    onSelect: (effectType: EffectType | null) => void;
    onParamChange: (param: string, value: number) => void;
};

export default function EffectSlot({ config, onSelect, onParamChange }: EffectSlotProps) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<'params' | 'select'>('params');

    function handleOpenChange(isOpen: boolean) {
        if (isOpen) setView(config ? 'params' : 'select');
        setOpen(isOpen);
    }

    function handleSelect(type: EffectType | null) {
        onSelect(type);
        if (type === null) {
            setOpen(false);
        } else {
            setView('params');
        }
    }

    const params = config?.params ?? {};

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    className={`w-full h-5 rounded text-xs px-1.5 text-left truncate transition-colors ${
                        config
                            ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                            : 'bg-gray-800 hover:bg-gray-900 text-gray-500'
                    }`}
                >
                    {config ? EFFECT_LABELS[config.effectType] : ''}
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-48 p-2" align="start">
                {view === 'params' && config ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-200">
                                {EFFECT_LABELS[config.effectType]}
                            </span>
                            <button
                                onClick={() => handleSelect(null)}
                                className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                        <div className="border-t border-gray-700" />
                        {EFFECT_PARAMS[config.effectType].map(paramKey => {
                            const def = PARAM_DEFS[paramKey];
                            const val = params[paramKey] ?? def.min;
                            return (
                                <div key={paramKey} className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400 w-9 shrink-0">{def.label}</span>
                                    {def.control === 'drag' ? (
                                        <DraggableParam def={def} value={val} onChange={v => onParamChange(paramKey, v)} />
                                    ) : (
                                        <Slider
                                            value={[val]}
                                            min={def.min}
                                            max={def.max}
                                            step={def.step ?? 0.01}
                                            className="flex-1"
                                            onValueChange={([v]: number[]) => onParamChange(paramKey, v)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                        <div className="border-t border-gray-700" />
                        <button
                            onClick={() => setView('select')}
                            className="text-left text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                        >
                            Change effect ›
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {EFFECT_OPTIONS.map(({ type, label }) => (
                            <button
                                key={type}
                                onClick={() => handleSelect(type)}
                                className="text-left text-xs px-2 py-1.5 rounded hover:bg-gray-400 text-black"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
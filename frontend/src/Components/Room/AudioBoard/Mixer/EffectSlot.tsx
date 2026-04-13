import { useState, useRef } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/Components/ui/popover";
import { Slider } from "@/Components/ui/slider";
import type { EffectSlotConfig } from "@/Types/AudioState";
import { NATIVE_EFFECT_CATALOG, type NativeEffectType, type ParamMeta } from "@/Core/Effects/effectCatalog";

type DragParamMeta = ParamMeta & { control: 'drag' };

function DraggableParam({ def, value, onChange }: { def: DragParamMeta; value: number; onChange: (v: number) => void }) {
    const startY = useRef<number | null>(null);
    const startVal = useRef(0);

    function onMouseDown(e: React.MouseEvent) {
        e.preventDefault();
        startY.current = e.clientY;
        startVal.current = value;

        function onMove(e: MouseEvent) {
            const pct = (startY.current! - e.clientY) / def.sensitivity;
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
    onSelect: (effectType: NativeEffectType | null) => void;
    onParamChange: (param: string, value: number) => void;
};

export default function EffectSlot({ config, onSelect, onParamChange }: EffectSlotProps) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<'params' | 'select'>('params');

    function handleOpenChange(isOpen: boolean) {
        if (isOpen) setView(config ? 'params' : 'select');
        setOpen(isOpen);
    }

    function handleSelect(type: NativeEffectType | null) {
        onSelect(type);
        if (type === null) {
            setOpen(false);
        } else {
            setView('params');
        }
    }

    const descriptor = config ? NATIVE_EFFECT_CATALOG[config.effectType as NativeEffectType] : null;
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
                    {descriptor?.displayName ?? ''}
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-48 p-2" align="start">
                {view === 'params' && config && descriptor ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-200">
                                {descriptor.displayName}
                            </span>
                            <button
                                onClick={() => handleSelect(null)}
                                className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                        <div className="border-t border-gray-700" />
                        {Object.entries(descriptor.params).map(([paramKey, def]) => {
                            const val = params[paramKey] ?? def.default;
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
                                            step={def.step}
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
                        {(Object.entries(NATIVE_EFFECT_CATALOG) as [NativeEffectType, typeof NATIVE_EFFECT_CATALOG[NativeEffectType]][]).map(([type, desc]) => (
                            <button
                                key={type}
                                onClick={() => handleSelect(type)}
                                className="text-left text-xs px-2 py-1.5 rounded hover:bg-gray-400 text-black"
                            >
                                {desc.displayName}
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
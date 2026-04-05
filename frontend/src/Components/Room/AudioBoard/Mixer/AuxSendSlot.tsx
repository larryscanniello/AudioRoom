import { useRef, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/Components/ui/popover";

type AuxSendSlotProps = {
    sendIndex: number;
    auxId: string;
    value: number;
    onTargetChange: (newAuxId: string) => void;
    onLevelChange: (level: number) => void;
};

function formatLevel(v: number): string {
    const s = v.toFixed(2);
    return s.startsWith('0.') ? s.slice(1) : s;
}

const AUX_OPTIONS = [
    { id: 'aux-0', label: 'Aux 1' },
    { id: 'aux-1', label: 'Aux 2' },
    { id: 'aux-2', label: 'Aux 3' },
];

export default function AuxSendSlot({ auxId, value, onTargetChange, onLevelChange }: AuxSendSlotProps) {
    const [open, setOpen] = useState(false);
    const startY = useRef<number | null>(null);
    const startValue = useRef<number>(0);

    const auxIndex = parseInt(auxId.split('-')[1], 10);
    const label = `A${auxIndex + 1}`;

    function handleSelect(id: string) {
        onTargetChange(id);
        setOpen(false);
    }

    function onMouseDown(e: React.MouseEvent) {
        e.preventDefault();
        startY.current = e.clientY;
        startValue.current = value;

        function onMouseMove(e: MouseEvent) {
            const delta = (startY.current! - e.clientY) / 100;
            const next = Math.max(0, Math.min(1, startValue.current + delta));
            onLevelChange(Math.round(next * 100) / 100);
        }

        function onMouseUp() {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    return (
        <div className="flex flex-row w-full h-5 gap-px">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="w-6 shrink-0 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-[10px] text-gray-300 leading-none">
                        {label}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-24 p-1" align="start">
                    <div className="flex flex-col">
                        {AUX_OPTIONS.map(({ id, label: optLabel }) => (
                            <button
                                key={id}
                                onClick={() => handleSelect(id)}
                                className={`text-left text-xs px-2 py-1.5 rounded ${
                                    "text-left text-xs px-2 py-1.5 rounded hover:bg-gray-400 text-black"
                                }`}
                            >
                                {optLabel}
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
            <div
                onMouseDown={onMouseDown}
                className="w-8 shrink-0 flex items-center justify-center bg-gray-800 text-[10px] text-gray-300 font-mono leading-none cursor-ns-resize select-none"
            >
                {formatLevel(value)}
            </div>
        </div>
    );
}
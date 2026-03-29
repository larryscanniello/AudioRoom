import { useState } from "react";
import { CONSTANTS } from "@/Constants/constants.ts";
import type { AudioController } from "@/Core/Audio/AudioController";
import { ArrowDownToLine, ArrowUpFromLine, CassetteTape, KeyboardMusic, Redo, Undo } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";

type UpperLeftBoxProps = {
    compactMode: number;
    audioControllerRef: React.RefObject<AudioController|null>;
    onBounceClick?: () => void;
    onRestageRequest?: (index: number) => void;
}

export default function UpperLeftBox({compactMode, audioControllerRef, onBounceClick, onRestageRequest}: UpperLeftBoxProps){

    const [selectedRestage, setSelectedRestage] = useState<number | null>(null);
    const [restageOpen, setRestageOpen] = useState(false);

    const handleBounce = () => {
        if (onBounceClick) {
            onBounceClick();
            return;
        }
        if(!audioControllerRef.current){
            console.error("AudioController is null in UpperLeftBox handleBounce");
            return;
        }
        const bounceNum = (audioControllerRef.current.query("bounce") ?? 0) + 1;
        audioControllerRef.current.bounce(`Bounce ${bounceNum}`);
    }

    const handleUndo = () => {
        if(!audioControllerRef.current){
            console.error("AudioController is null in UpperLeftBox handleUndo");
            return;
        }
        audioControllerRef.current.undo();
    }

    const handleRedo = () => {
        if(!audioControllerRef.current){
            console.error("AudioController is null in UpperLeftBox handleRedo");
            return;
        }
        audioControllerRef.current.redo();
    }

    const handleConfirmRestage = () => {
        if (selectedRestage !== null && onRestageRequest) {
            onRestageRequest(selectedRestage);
        }
        setSelectedRestage(null);
        setRestageOpen(false);
    };

    const thingsToUndo = audioControllerRef.current ? audioControllerRef.current.query('timeline').undoStack.length : 0;
    const thingsToRedo = audioControllerRef.current ? audioControllerRef.current.query('timeline').redoStack.length : 0;
    const timeline = audioControllerRef.current?.query("timeline");
    const bounceCount = timeline?.mix.length ?? 0;
    const bounceNames = timeline?.bounceNames ?? [];

    return <div className="bg-[rgb(86,86,133)] flex flex-col justify-center items-center text-xs text-gray-400"
                style={{width:`${CONSTANTS.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(35*compactMode)}}
            >
                <div>
                <button className="pr-2" onClick={handleUndo}>
                    <Undo className={`scale-75 ${thingsToUndo === 0 ? 'opacity-25' : ''}`}/>
                </button>
                <button className="pr-2" onClick={handleRedo}>
                    <Redo className={`scale-75 ${thingsToRedo === 0 ? 'opacity-25' : ''}`}/>
                </button>
                <button className="pr-3.5">
                    <KeyboardMusic className="scale-75"/>
                </button>
                <button className="relative w-8 h-5" title="Bounce to mix"
                onClick={handleBounce}
                >
                        <ArrowDownToLine className="absolute scale-50 -top-2.5 -left-1"/>
                        <CassetteTape className="absolute scale-75 top-0 -left-1"/>
                </button>
                <Popover open={restageOpen} onOpenChange={(open) => { setRestageOpen(open); if (!open) setSelectedRestage(null); }}>
                    <PopoverTrigger asChild>
                        <button className="relative w-8 h-5" title="Re-stage from mix">
                            <ArrowUpFromLine className="absolute scale-50 -top-2.5 -left-1"/>
                            <CassetteTape className="absolute scale-75 top-0 -left-1"/>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-36">
                        <div className="sticky top-0 bg-popover border-b border-black p-1 flex items-center justify-between z-10 px-2">
                            <span className="text-xs">Re-stage</span>
                            <button
                                onClick={handleConfirmRestage}
                                disabled={selectedRestage === null}
                            >
                                <ArrowUpFromLine size={14} className={selectedRestage === null ? "opacity-30" : ""}/>
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-40">
                            {bounceCount === 0
                                ? <p className="text-xs p-2 text-gray-400">No bounces yet</p>
                                : Array.from({ length: bounceCount }, (_, i) => (
                                    <label key={i} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-400">
                                        <input
                                            type="radio"
                                            name="restage-select"
                                            checked={selectedRestage === i}
                                            onChange={() => setSelectedRestage(i)}
                                        />
                                        {bounceNames[i] ?? `Bounce ${i + 1}`}
                                    </label>
                                ))
                            }
                        </div>
                    </PopoverContent>
                </Popover>
                </div>
            </div>

}
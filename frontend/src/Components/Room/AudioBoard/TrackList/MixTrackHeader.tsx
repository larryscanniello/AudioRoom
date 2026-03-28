import { useState } from "react";
import { Slider } from "@/Components/ui/slider";
import { CONSTANTS } from "@/Constants/constants.ts";
import type { AudioController } from "@/Core/Audio/AudioController";
import { Trash2 } from "lucide-react";
import type React from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";

type MixTrackHeaderProps = {
    audioControllerRef:React.RefObject<AudioController|null>,
    compactMode:number,
}

export default function MixTrackHeader({ audioControllerRef, compactMode }: MixTrackHeaderProps) {

    const audioController = audioControllerRef.current;
    const [checkedBounces, setCheckedBounces] = useState<Set<number>>(new Set());

    const handleMuteToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if(audioController){
            audioController.muteMixToggle();
        }else{
            console.error("AudioController is null in MixTrackHeader handleMuteToggle");
        }
    };

    const handleVolSlider = (value: number[]) => {
        if(audioController){
            audioController.changeMixVolume(value[0]);
        }else{
            console.error("AudioController is null in MixTrackHeader handleVolSlider");
        }
    };

    const handleDelete = () => {
        if (audioController && checkedBounces.size > 0) {
            audioController.deleteMixBounces([...checkedBounces]);
            setCheckedBounces(new Set());
        }
    };

    const toggleBounce = (i: number) => {
        setCheckedBounces(prev => {
            const next = new Set(prev);
            next.has(i) ? next.delete(i) : next.add(i);
            return next;
        });
    };

    const isMixMuted = audioController ? audioController.isMixTrackMuted() : false;
    const timeline = audioController ? audioController.query("timeline") : null;
    const bounceCount = timeline ? timeline.mix.length : 0;
    const bounceNames = timeline ? (timeline.bounceNames ?? []) : [];

    return <div style={{ width: `${CONSTANTS.LEFT_CONTROLS_WIDTH}`, height: Math.floor(58 * compactMode) }} className="border-b border-black flex flex-row items-center">

        <Popover>
            <PopoverTrigger asChild>
                <button>
                    <Trash2 className="scale-75"/>
                </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-36">
                <div className="sticky top-0 bg-popover border-b border-black p-1 flex justify-center z-10">
                    <button
                        onClick={handleDelete}
                        disabled={checkedBounces.size === 0}
                    >
                        <Trash2 size={14} className={checkedBounces.size === 0 ? "opacity-30" : ""}/>
                    </button>
                </div>
                <div className="overflow-y-auto max-h-40">
                    {bounceCount === 0
                        ? <p className="text-xs p-2 text-gray-400">No bounces yet</p>
                        : Array.from({ length: bounceCount }, (_, i) => (
                            <label key={i} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-400">
                                <input
                                    type="checkbox"
                                    checked={checkedBounces.has(i)}
                                    onChange={() => toggleBounce(i)}
                                />
                                {bounceNames[i] ?? `Bounce ${i + 1}`}
                            </label>
                        ))
                    }
                </div>
            </PopoverContent>
        </Popover>

        <button className={"border border-black text-white text-xs w-8 h-5 ml-1 pr-1 pl-1 rounded-sm "
            + (isMixMuted ? "bg-amber-600" : "")}
            onClick={handleMuteToggle}
        >
            M
        </button>
        <Slider className="ml-2 mr-2"
            defaultValue={[1.0]} max={1.0} min={0.0} step={.025}
            onValueChange={(value: number[]) => handleVolSlider(value)}
        >
        </Slider>
    </div>;
}
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Slider } from "@/Components/ui/slider"
import { CONSTANTS } from "@/Constants/constants.ts";
import type { AudioController } from "@/Core/Audio/AudioController";
import type React from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";

type StagingTrackHeaderProps = {
    audioControllerRef:React.RefObject<AudioController|null>,
    compactMode:number,
}

export default function StagingTrackHeader({audioControllerRef,compactMode}: StagingTrackHeaderProps){

    const audioController = audioControllerRef.current;
    const [checked, setChecked] = useState(false);

    const handleDelete = () => {
        if(audioController && checked){
            audioController.deleteStagingRegions();
            setChecked(false);
        }else{
            console.error("AudioController is null in StagingTrackHeader handleDelete");
        }
    }

    const handleMuteToggle = (e:React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if(audioController){
            audioController.muteStagingToggle();
        }else{
            console.error("AudioController is null in StagingTrackHeader handleMuteToggle");
        }
    }

    const handleVolSlider = (value:number[]) => {
        if(audioController){
            audioController.changeStagingVolume(value[0]);
        }else{
            console.error("AudioController is null in StagingTrackHeader handleVolSlider");
        }
    }

    const isStagingMuted = audioController ? audioController.isStagingTrackMuted() : false;
    const hasRegions = audioController ? audioController.query("timeline").staging.some(layer => layer.length > 0) : false;

    return <div style={{width:`${CONSTANTS.LEFT_CONTROLS_WIDTH}`,height:Math.floor(58*compactMode)}} className="border-b border-black flex flex-row items-center">

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
                        disabled={!checked}
                    >
                        <Trash2 size={14} className={!checked ? "opacity-30" : ""}/>
                    </button>
                </div>
                <div className="overflow-y-auto max-h-40">
                    {!hasRegions
                        ? <p className="text-xs p-2 text-gray-400">No staging regions</p>
                        : <label className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-400">
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setChecked(prev => !prev)}
                            />
                            Staging track
                          </label>
                    }
                </div>
            </PopoverContent>
        </Popover>

        <button className={"border border-black text-white text-xs w-8 h-5 ml-1 pr-1 pl-1 rounded-sm "
        + (isStagingMuted ? "bg-amber-600" : "")}
            onClick={handleMuteToggle}
        >
            M
        </button>
        <Slider className="ml-2 mr-2"
            defaultValue={[1.0]} max={1.0} min={0.0} step={.025}
            onValueChange={(value:number[]) => handleVolSlider(value)}
        >
        </Slider>

    </div>
}
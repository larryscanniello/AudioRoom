import { Trash2 } from "lucide-react";
import { Slider } from "@/Components/ui/slider"
import { CONSTANTS } from "@/Constants/constants.ts";
import type { AudioController } from "@/Core/Audio/AudioController";
import type React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/Components/ui/hover-card"

type StagingTrackHeaderProps = {
    audioControllerRef:React.RefObject<AudioController|null>,
    compactMode:number,
}

export default function StagingTrackHeader({audioControllerRef,compactMode}: StagingTrackHeaderProps){

    const audioController = audioControllerRef.current;

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

    
    const handleDelete = () => {
        if(audioController){
            audioController.deleteStagingRegions();
        }else{
            console.error("AudioController is null in StagingTrackHeader handleDelete");
        }
    }

    const isStagingMuted = audioController ? audioController.isStagingTrackMuted() : false;

    return <div style={{width:`${CONSTANTS.LEFT_CONTROLS_WIDTH}`,height:Math.floor(58*compactMode)}} className="border-b border-black flex flex-row items-center">
                
                <HoverCard>
                    <HoverCardTrigger className="flex flex-row items-center">
                        <button>
                            <Trash2 className="scale-75"/>
                        </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="">
                        <button className="b-1 border-black text-white text-xs w-full h-5 pr-1 pl-1 rounded-sm bg-black"
                            onClick={handleDelete}
                        >
                            Delete All Staging Regions
                        </button>
                    </HoverCardContent>
                </HoverCard>
                
                
                <button className={"border-1 border-black text-white text-xs w-8 h-5 ml-1 pr-1 pl-1 rounded-sm " 
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
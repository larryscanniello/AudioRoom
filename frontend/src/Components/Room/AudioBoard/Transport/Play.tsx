import { Button } from "@/Components/ui/button";
import { Play as PlayIcon } from "lucide-react";
import type { AudioController } from "@/Classes/Audio/AudioController";

type PlayProps = {
    audioControllerRef:React.RefObject<AudioController|null>,
    compactMode:number,
}

export default function Play({audioControllerRef,compactMode}:PlayProps){

    const onPlay = () => {
        if(audioControllerRef.current){
            audioControllerRef.current.play();
        }else{
            console.error("AudioController ref is null, can't play");
        }
    }

    return <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800" onClick={onPlay}>
                <PlayIcon color={"lightgreen"} style={{width:20,height:20}}/> 
            </Button>
}
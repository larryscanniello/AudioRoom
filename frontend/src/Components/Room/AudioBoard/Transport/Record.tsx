import { Button } from "@/Components/ui/button";
import { Circle } from "lucide-react";
import type { AudioController } from "@/Classes/Audio/AudioController";

type RecordProps = {
    audioControllerRef:React.RefObject<AudioController|null>,
    compactMode:number,
}

export default function Record({audioControllerRef, compactMode}: RecordProps){

    const onRecord = () => {
        if(audioControllerRef.current){
            audioControllerRef.current.record();
        }else{
            console.error("AudioController reference is null on record button click");
        }
    }

    return <Button 
                variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                onClick={onRecord}
            >
                <Circle color={"red"}className="" style={{width:20,height:20}}/>
            </Button>
}
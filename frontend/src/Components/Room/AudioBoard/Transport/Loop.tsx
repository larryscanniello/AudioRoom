import { Button } from "@/Components/ui/button";
import { Repeat2 } from "lucide-react";
import type { AudioController } from "@/Classes/Audio/AudioController";

type LoopProps = {
    audioControllerRef: React.RefObject<AudioController|null>;
    compactMode: number;
}
export default function Loop({audioControllerRef, compactMode}: LoopProps){

    const onLoop = () => {
        if(audioControllerRef.current){
            audioControllerRef.current.toggleLooping();
        }else{
            console.error("AudioController ref is null on loop toggle");
            return;
        }
    }

    const looping = audioControllerRef.current ? audioControllerRef.current.query("isLooping") : false;

    return <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                                onClick={onLoop}
                            >
                <Repeat2 style={{width:20,height:20}} color={looping ? "lightskyblue" : "white"}/>
            </Button>
}
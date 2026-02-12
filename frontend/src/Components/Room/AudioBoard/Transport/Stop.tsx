import { Button } from "@/Components/ui/button";
import { Square } from "lucide-react";
import type { AudioController } from "@/Core/Audio/AudioController";

type StopProps = {
    audioControllerRef: React.RefObject<AudioController | null>;
    compactMode: number;
};

export default function Stop({ audioControllerRef, compactMode }: StopProps) {

    const onStop = () => {
        if(!audioControllerRef.current){
            console.warn("AudioController reference is null. Cannot stop audio.");
            return;
        };
        audioControllerRef.current.stop();
    }

    return <Button variant="default" size={compactMode==1?"lg":"sm"} 
                    className="hover:bg-gray-800" onClick={onStop}>
                <Square color={"lightblue"} className="" style={{width:20,height:20}}/>
        </Button>

}
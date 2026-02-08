import { Button } from "@/Components/ui/button";
import { SkipBack } from "lucide-react";
import type { AudioController } from "@/Classes/Audio/AudioController";

type SkipbackProps = {
    audioControllerRef: React.RefObject<AudioController|null>;
    compactMode: number;
}

export default function Skipback({audioControllerRef, compactMode}: SkipbackProps){

    const onSkipback = () => {
        if(audioControllerRef.current){
            audioControllerRef.current.skipBack();
        }else{
            console.error("AudioController ref is null on skipback");
        }
    }

    return <Button variant="default" size={compactMode==1?"lg":"sm"} className={"hover:bg-gray-800"}
                onClick={onSkipback}
                >
                <SkipBack style={{width:20,height:20}} color="orange"/>
            </Button>
}
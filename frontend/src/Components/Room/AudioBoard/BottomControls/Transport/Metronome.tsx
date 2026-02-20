import { Button } from "@/Components/ui/button";
import { PiMetronomeDuotone } from "react-icons/pi";
import type { AudioController } from "@/Core/Audio/AudioController";

type MetronomeProps = {
    audioControllerRef: React.RefObject<AudioController|null>;
    compactMode: number;
}

export default function Metronome({audioControllerRef, compactMode}: MetronomeProps){

    const onMetronome = () => {
        if(audioControllerRef.current){
            audioControllerRef.current.toggleMetronome();
        }else{
            console.error("AudioController ref is null on metronome toggle");
        }
    }

    const isMetronomeOn = audioControllerRef.current ? audioControllerRef.current.query("isMetronomeOn") : false;

    return <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                    onClick={onMetronome}>
                                <PiMetronomeDuotone style={{width:20,height:20}} 
                                                    color={isMetronomeOn ? "pink" : ""}
                                                    />
            </Button>
}
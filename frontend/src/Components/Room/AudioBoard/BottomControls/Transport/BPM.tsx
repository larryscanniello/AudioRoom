import { Button } from "@/Components/ui/button";
import type { AudioController } from "@/Core/Audio/AudioController";

type BPMProps = {
    audioControllerRef: React.RefObject<AudioController|null>;
    compactMode: number;
}

export default function BPM({ audioControllerRef, compactMode }: BPMProps){

    const onBPMMouseDown = (e:React.MouseEvent<HTMLButtonElement>) => {
        if(audioControllerRef.current){
            audioControllerRef.current.onBPMMouseDown(e);
        }
    }

    const currentBPM = audioControllerRef.current ? audioControllerRef.current.query("bpm") : 90;

    return <Button className={compactMode==1?"test-lg":"text-sm"} 
                    variant="default" size={compactMode==1?"lg":"sm"} onMouseDown={onBPMMouseDown}>
                <div className="absolute">
                    {currentBPM}
                </div>
        </Button>
}
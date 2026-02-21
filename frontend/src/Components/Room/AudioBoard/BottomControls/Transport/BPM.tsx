import { Button } from "@/Components/ui/button";
import { UIController } from "@/Core/UI/UIController";

type BPMProps = {
    uiControllerRef: React.RefObject<UIController|null>;
    compactMode: number;
}

export default function BPM({ uiControllerRef, compactMode }: BPMProps){

    const onBPMMouseDown = (e:React.MouseEvent<HTMLButtonElement>) => {
        if(uiControllerRef.current){
            uiControllerRef.current.onBPMMouseDown(e);
        }
    }

    const currentBPM = uiControllerRef.current ? uiControllerRef.current.query("bpm") : 90;

    return <Button className={compactMode==1?"test-lg":"text-sm"} 
                    variant="default" size={compactMode==1?"lg":"sm"} onMouseDown={onBPMMouseDown}>
                <div className="absolute">
                    {currentBPM}
                </div>
        </Button>
}
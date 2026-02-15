/*import { UIController } from "@/Core/UI/UIController";
import { useRef } from "react";
import { DOMElements } from "@/Constants/DOMElements";
import { CONSTANTS } from "@/Constants/constants";

type PlayheadProps = {
    compactMode: number;
    windowLen: number;
    UIControllerRef: React.RefObject<UIController|null>;
}

export default function Playhead({compactMode,windowLen,UIControllerRef}: PlayheadProps){

    const playheadRef = useRef<HTMLDivElement>(null);

    const handleMovePlayhead = (e: React.MouseEvent<HTMLDivElement>) => {
        if(!playheadRef.current){
            console.error("Playhead ref is not set when trying to move playhead");
            return;
        }
        if(UIControllerRef.current){
            UIControllerRef.current.handlePlayheadMouseDown(e);
        }else{
            console.error("UIController reference was not available when trying to move playhead, playhead may not move correctly");
        }
    }

    if(UIControllerRef.current && playheadRef && playheadRef.current){
        UIControllerRef.current.registerRef(DOMElements.PLAYHEAD, playheadRef);
        
        const playheadTimeSeconds = UIControllerRef.current.query("playheadTimeSeconds");
        const viewport = UIControllerRef.current.query("viewport");
        const start = viewport.startTime;
        const end = viewport.startTime + (viewport.samplesPerPx * windowLen / CONSTANTS.SAMPLE_RATE);
        const viewportDuration = end - start;
        const playheadRatio = (playheadTimeSeconds - start) / viewportDuration;
        if(playheadRatio >= 0 && playheadRatio <= 1){
            const playheadX = playheadRatio * windowLen;
            playheadRef.current.style.transform = `translateX(${playheadX}px)`;
        }else{
            playheadRef.current.style.display = "none";
        }
    }


    return <div ref={playheadRef} style={{position:"absolute",top:0,bottom:0,left:-1,pointerEvents:"none",width:"4px"} }
                    onMouseDown={handleMovePlayhead}
                    className="flex flex-col items-center playheadContainer"
                    onDragStart={(e) => e.preventDefault()}
                    data-container-width={windowLen}
                    >
                    <div style={{
                            width: "8px",
                            height: Math.floor(8*compactMode),
                            borderRadius: "50%",
                            background: "red",
                            marginTop: Math.floor(26*compactMode),
                            transform:"translateX(-3px)",
                            }}
                            className="playheadTop"
                            >
                    
                    </div>
                    <div
                    style={{
                        position:"absolute",top:Math.floor(25*compactMode),bottom:0,
                        width:"2px",background:"red",
                    }}>

                    </div>
            </div>
}*/
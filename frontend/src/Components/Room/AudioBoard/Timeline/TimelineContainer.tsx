import { useRef } from "react"


type TimelineContainerProps = {
    timelinePxLen:number,
    compactMode:number,
    uiControllerRef:React.RefObject<any>,
}

export default function TimelineContainer({timelinePxLen,compactMode,uiControllerRef}:
    TimelineContainerProps) {
    
    const timelineContainerRef = useRef<HTMLCanvasElement>(null);
    


    if(uiControllerRef.current && timelineContainerRef.current){
        uiControllerRef.current.registerRef("timelineContainer",timelineContainerRef);
    }

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if(uiControllerRef.current){
            uiControllerRef.current.timelineMouseDown(e);
        }else{
            console.error("TimelineContainer: Failed to handle mouse down, uiControllerRef was not available");
        }
    }
    
    return <canvas
                ref={timelineContainerRef}
                width={timelinePxLen}
                height={Math.floor(115*compactMode)}
                style={{width:`${timelinePxLen}px`,height:Math.floor(115*compactMode),imageRendering:"pixelated"}}
                className="row-start-2 col-start-2"
                onMouseDown={onMouseDown}
            />
}
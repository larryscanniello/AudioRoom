import { DOMElements } from "@/Constants/DOMElements";
import {  useRef } from "react";

type MeasureTicksProps = {
    timelinePxLen:number,
    compactMode:number,
    uiControllerRef:React.RefObject<any>,
}

export default function MeasureTicks({timelinePxLen,compactMode,uiControllerRef}:MeasureTicksProps){
    const measureTickRef = useRef<HTMLCanvasElement>(null);


    if(uiControllerRef.current){
        uiControllerRef.current.registerRef(DOMElements.MEASURE_TICK_CONTAINER,measureTickRef);   
    }


    return <canvas className="row-start-1 col-start-2 z-99 pointer-events-none"
                    style={{width:`${timelinePxLen}px`,height:`${Math.floor(35*compactMode)}px`}}
                    width={timelinePxLen}
                    height={Math.floor(35*compactMode)}
                    ref={measureTickRef}
            > 
            </canvas>
}
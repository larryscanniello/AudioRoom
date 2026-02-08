import { DOMElements } from "@/Constants/DOMElements";
import { useEffect, useRef } from "react";

type MeasureTicksProps = {
    timelinePxLen:number,
    compactMode:number,
    uiControllerRef:React.RefObject<any>,
}

export default function MeasureTicks({timelinePxLen,compactMode,uiControllerRef}:MeasureTicksProps){
    const measureTickRef = useRef<HTMLCanvasElement>(null);

     useEffect(()=>{
        if(uiControllerRef.current && measureTickRef.current){
            uiControllerRef.current.registerRef(DOMElements.MEASURE_TICK_CONTAINER,measureTickRef);
        }else{
            console.error("MeasureTicks: Failed to register measure tick ref, either uiControllerRef or measureTickRef was not available");
        }
     },[])


    return <canvas className="row-start-1 col-start-2"
                    style={{width:`${timelinePxLen}px`,height:Math.floor(35*compactMode)}}
                    width={timelinePxLen}
                    height={Math.floor(35*compactMode)}
                    ref={measureTickRef}
            > 
            </canvas>
}
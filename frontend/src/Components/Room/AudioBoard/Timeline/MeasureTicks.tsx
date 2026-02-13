import { DOMElements } from "@/Constants/DOMElements";
import {  useEffect, useRef } from "react";

type MeasureTicksProps = {
    timelinePxLen:number,
    compactMode:number,
    uiControllerRef:React.RefObject<any>,
}

export default function MeasureTicks({timelinePxLen,compactMode,uiControllerRef}:MeasureTicksProps){
    const measureTickRef = useRef<HTMLCanvasElement>(null);

    useEffect(()=>{
        if(measureTickRef.current && uiControllerRef.current){
            console.log("Adding wheel event listener to measure ticks");
            measureTickRef.current.addEventListener("wheel",uiControllerRef.current.scroll.bind(uiControllerRef.current));
        }else{
            console.error("Failed to add wheel event listener to measure ticks because reference was not found");
        }
        return () => {
            if(measureTickRef.current && uiControllerRef.current){
                console.log("Removing wheel event listener from measure ticks");
                measureTickRef.current.removeEventListener("wheel",uiControllerRef.current.scroll.bind(uiControllerRef.current));
            }else{
                console.error("Failed to remove wheel event listener from measure ticks because reference was not found");
            }
        }
    },[]);
    if(uiControllerRef.current){
        uiControllerRef.current.registerRef(DOMElements.MEASURE_TICK_CONTAINER,measureTickRef);   
    }


    return <canvas className="row-start-1 col-start-2"// pointer-events-none"
                    style={{width:`${timelinePxLen}px`,height:`${Math.floor(35*compactMode)}px`}}
                    width={timelinePxLen}
                    height={Math.floor(35*compactMode)}
                    ref={measureTickRef}
            > 
            </canvas>
}
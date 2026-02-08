import { CONSTANTS } from "@/Constants/constants";
import type { Region } from "@/Types/AudioState";
import { useRef, useEffect } from "react"; 

type StagingTrackProps = {
    timelinePxLen: number;
    compactMode: number;
    uiControllerRef: React.RefObject<any>;
}

export default function StagingTrack({timelinePxLen,compactMode,uiControllerRef}:StagingTrackProps) {

    const stagingWaveformsRef = useRef<HTMLCanvasElement>(null);
    const stagingRegionsRef = useRef<HTMLDivElement>(null);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if(uiControllerRef.current){
            uiControllerRef.current.timelineMouseDown(e, stagingWaveformsRef);
        }else{
            console.error("UI Controller reference was not available when handling canvas mouse down in staging track");
        }
    }

    function setRegions():void{
        const viewport = uiControllerRef.current.query("viewport");
        const startTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const endTime = viewport.startTime + (timelinePxLen * samplesPerPx / CONSTANTS.SAMPLE_RATE);
        if(!stagingRegionsRef.current){
            console.error("Staging regions ref not set when trying to set regions");
            return;
        }
        const stagingChildren = stagingRegionsRef.current.children;
        const elements: Element[] = Array.from(stagingChildren);
        elements.forEach((child:Element) => {
            if(!(child instanceof HTMLElement)){
                console.error("Child of staging regions was not an HTMLElement");
                return;
            }
            if(!child.dataset.start || !child.dataset.end){
                console.error("Region element was missing start or end data attributes");
                return;
            }
            const start = Number(child.dataset.start) / CONSTANTS.SAMPLE_RATE;
            const end = Number(child.dataset.end) / CONSTANTS.SAMPLE_RATE;
            if (end < startTime || start > endTime){
                child.style.display = "none";
                return;
            }
            child.style.display = "block";

            const left = Math.max(0,(start - startTime) / (endTime-startTime)) * timelinePxLen;
            const leftOverflow = Math.max(0, startTime - start);
            const rightOverflow = Math.max(0, end - endTime)
            const regionWidth = Math.min(1,(end - start - leftOverflow - rightOverflow) / (endTime-startTime)) * timelinePxLen;

            let borderRadius;
            if(start < startTime && end > endTime){
                borderRadius = "0px";
            }else if(start < startTime){
                borderRadius = "0px 7px 7px 0px";
            }else if(end > endTime){
                borderRadius = "7px 0px 0px 7px";
            }else{
                borderRadius = "7px";
            }

            child.style.left = "0";
            child.style.top = "35px";
            child.style.position = "absolute"
            child.style.transform = `translateX(${left}px)`;
            child.style.width = `${regionWidth}px`;
            child.style.height = '57px';
            child.style.background = "rgb(10, 138, 74,.5)";
            child.style.borderRadius = borderRadius;
            child.style.border = "2px solid rgb(220,220,2020,.8)";
            child.style.pointerEvents = "none";
        });
    }
    
    const timeline = uiControllerRef.current?.query("timeline");

    // Update regions whenever the timeline changes; useEffect w/ no dep ensures setRegions is called after render
    useEffect(() => {
        setRegions();
    });

    return <div><canvas 
            ref={stagingWaveformsRef}
            width={timelinePxLen}
            height={Math.floor(58*compactMode)}
            style={{width:`${timelinePxLen}px`,imageRendering:"pixelated",height:Math.floor(58*compactMode)}} 
            className={`row-start-2 col-start-3`}
            onMouseDown={handleCanvasMouseDown}
            >
            </canvas>

            <div ref={stagingRegionsRef} className="">
                {timeline.staging.map((region:Region) => {
                    return <div
                    key={region.name}
                    data-start={region.start}
                    data-end={region.end}
                    className="region"
                    >
                    <div></div>
                    <div></div>
                    </div>
                })}
            </div>
            </div>
}
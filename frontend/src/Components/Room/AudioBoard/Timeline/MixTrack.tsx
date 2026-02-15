import { CONSTANTS } from "@/Constants/constants";
import type { Region } from "@/Types/AudioState";
import { useRef } from "react";
import { DOMElements } from "@/Constants/DOMElements";

type MixTrackProps = {
    timelinePxLen: number;
    trackHeights: {
        stagingHeight: number;
        mixHeight: number;
    };
    uiControllerRef: React.RefObject<any>;
}

export default function MixTrack({timelinePxLen, trackHeights, uiControllerRef}: MixTrackProps) {

    const mixWaveformsRef = useRef<HTMLCanvasElement>(null);
    const mixRegionsRef = useRef<HTMLDivElement>(null);

    function setRegions(): void {
        const viewport = uiControllerRef.current?.query("viewport");
        if (!viewport) return;

        const startTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const endTime = viewport.startTime + (timelinePxLen * samplesPerPx / CONSTANTS.SAMPLE_RATE);
        
        if(!mixRegionsRef.current) return;

        const mixContainer = mixRegionsRef.current;
        const mixChildren = mixContainer.children;
        if(!mixChildren || mixChildren.length === 0) return;
        
        const elements: Element[] = Array.from(mixChildren);
        let endSample = 0;

        elements.forEach((child: Element) => {
            if(!(child instanceof HTMLElement)) return;
            if(child.dataset.end) {
                endSample = Math.max(endSample, Number(child.dataset.end));
            }
            child.style.display = "none";
        });
        
        const regionToDisplay = elements[0] as HTMLElement;
        if (!regionToDisplay) return;

        const start = 0;
        const end = endSample * 1 / CONSTANTS.SAMPLE_RATE;

        if (end < startTime || start > endTime){
            return;
        }

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
        
        regionToDisplay.style.display = "block"
        regionToDisplay.style.left = "0";
        regionToDisplay.style.top = "93px";
        regionToDisplay.style.position = "absolute"
        regionToDisplay.style.transform = `translateX(${left}px)`;
        regionToDisplay.style.width = `${regionWidth}px`;
        regionToDisplay.style.height = `${trackHeights.mixHeight}px`;
        regionToDisplay.style.background = "rgb(10, 138, 74,.5)";
        regionToDisplay.style.borderRadius = borderRadius;
        regionToDisplay.style.border = "2px solid rgb(220,220,2020,.8)";
        regionToDisplay.style.pointerEvents = "none";
    }

    const timeline = uiControllerRef.current?.query("timeline");
    
    if(uiControllerRef.current){
        uiControllerRef.current.registerRef(DOMElements.TRACK_TWO, mixWaveformsRef);
        setRegions();
    };

    return (
        <div>
            <canvas
                ref={mixWaveformsRef}
                height={trackHeights.mixHeight}
                width={timelinePxLen}
                style={{width:`${timelinePxLen}px`,imageRendering:"pixelated",height:`${trackHeights.mixHeight}px`}}
            ></canvas>

            <div ref={mixRegionsRef} className="">
                {timeline?.mix.map((track: Region[]) => 
                    track.map((region: Region) => (
                        <div
                            key={region.name}
                            data-start={region.start}
                            data-end={region.end}
                            className="region"
                        >
                            <div></div>
                            <div></div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

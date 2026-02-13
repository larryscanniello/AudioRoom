import { CONSTANTS } from "@/Constants/constants";
import type { Region } from "@/Types/AudioState";
import { useRef, useEffect } from "react";
import { DOMElements } from "@/Constants/DOMElements";

type MixTrackProps = {
    timelinePxLen: number;
    compactMode: number;
    uiControllerRef: React.RefObject<any>;
}

export default function MixTrack({timelinePxLen, compactMode, uiControllerRef}: MixTrackProps) {

    const mixWaveformsRef = useRef<HTMLCanvasElement>(null);
    const mixRegionsRef = useRef<HTMLDivElement>(null);

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if(uiControllerRef.current){
            uiControllerRef.current.timelineMouseDown(e, mixWaveformsRef);
        } else {
            console.error("UI Controller reference was not available when handling canvas mouse down in mix track");
        }
    }

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
        regionToDisplay.style.height = '57px';
        regionToDisplay.style.background = "rgb(10, 138, 74,.5)";
        regionToDisplay.style.borderRadius = borderRadius;
        regionToDisplay.style.border = "2px solid rgb(220,220,2020,.8)";
        regionToDisplay.style.pointerEvents = "none";
    }

    const timeline = uiControllerRef.current?.query("timeline");

    // Update regions whenever render occurs, intentionally no deps map to StagingTrack logic
    useEffect(() => {
        setRegions();
    });

    if(uiControllerRef.current){
        uiControllerRef.current.registerRef(DOMElements.TRACK_TWO, mixWaveformsRef);
    };

    return (
        <div>
            <canvas
                ref={mixWaveformsRef}
                height={Math.floor(57*compactMode)}
                width={timelinePxLen}
                style={{width:`${timelinePxLen}px`,imageRendering:"pixelated",height:Math.floor(57*compactMode)}}
                onMouseDown={handleCanvasMouseDown}
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

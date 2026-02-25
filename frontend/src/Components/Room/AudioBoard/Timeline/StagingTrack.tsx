import { CONSTANTS } from "@/Constants/constants";
import type { Region } from "@/Types/AudioState";
import { useRef } from "react"; 
import { DOMElements } from "@/Constants/DOMElements";

type StagingTrackProps = {
    timelinePxLen: number;
    trackHeights: {
        stagingHeight: number;
        mixHeight: number;
    };
    uiControllerRef: React.RefObject<any>;
}

export default function StagingTrack({timelinePxLen,trackHeights,uiControllerRef}:StagingTrackProps) {

    const stagingWaveformsRef = useRef<HTMLCanvasElement>(null);
    const stagingRegionsRef = useRef<HTMLDivElement>(null);



    
    
    const timeline = uiControllerRef.current ? uiControllerRef.current.query("timeline") : {staging: [[]]};

    if(uiControllerRef.current){
        uiControllerRef.current.registerRef(DOMElements.TRACK_ONE, stagingWaveformsRef);
        uiControllerRef.current.registerRef(DOMElements.TRACK_ONE_REGIONS, stagingRegionsRef);
    }


    return <div><canvas 
            ref={stagingWaveformsRef}
            width={timelinePxLen}
            height={trackHeights.stagingHeight}
            style={{width:`${timelinePxLen}px`,imageRendering:"pixelated",height:`${trackHeights.stagingHeight}px`}} 
            className={`row-start-2 col-start-3`}
            >
            </canvas>

            <div ref={stagingRegionsRef} 
            data-timelinepxlen={timelinePxLen}
            data-mixheight={trackHeights.mixHeight}
            data-stagingheight={trackHeights.stagingHeight}
            data-track={"staging"}
            className="">
                {timeline.staging[0].map((region:Region) => {
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
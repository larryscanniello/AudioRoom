import { CONSTANTS } from "@/Constants/constants";

import { type StateContainer } from "@/Core/State/State";

export function renderStagingWaveforms(ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array){

    if(!(ref.current instanceof HTMLCanvasElement)){
        console.error("Reference in renderStagingWaveforms is not a HTMLCanvasElement");
        return
    };
    const canvasCtx = ref.current.getContext("2d")!;

    const timeline = data.timeline.staging;
    if(timeline.length === 0) return;

    Atomics.load(mipMap,0);

    const {startTime, samplesPerPx} = data.viewport;

    const pxPerSecond = CONSTANTS.SAMPLE_RATE / samplesPerPx;

    const WIDTH = canvasCtx.canvas.width;
    const HEIGHT = canvasCtx.canvas.height;

    const endTime = startTime + WIDTH / pxPerSecond;

    canvasCtx.globalAlpha = 1.0
    canvasCtx.lineWidth = 1; // slightly thicker than 1px
    canvasCtx.strokeStyle =  "#1c1e22";
    canvasCtx.lineCap = "round";
    canvasCtx.lineJoin = "round";

    const vpStartSamples = Math.round(startTime * CONSTANTS.SAMPLE_RATE);

    const vpEndSamples = Math.round(endTime * CONSTANTS.SAMPLE_RATE);

    const pxPerTimeline = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE / (vpEndSamples-vpStartSamples) * WIDTH;
    
    const resolutions = CONSTANTS.MIPMAP_RESOLUTIONS;

    let currRes = 0;
    while(currRes+1<resolutions.length && resolutions[currRes + 1] > pxPerTimeline){
        currRes += 1;
    } 

    let j=0; //j is the region number in the timeline
    while(j<timeline.length && timeline[j].end <= vpStartSamples){
        j += 1;
    }
    if(j===timeline.length || timeline[j].start >= vpEndSamples) return;

    const halfLength = CONSTANTS.MIPMAP_HALF_SIZE;
    const iterateAmount = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE / halfLength;
    
    const mipMapStart = resolutions.slice(0,currRes).reduce((acc, curr) => acc + curr, 0);
    const pxGap = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS / (endTime - startTime) * CONSTANTS.MIPMAP_HALF_SIZE / resolutions[currRes]; 
    canvasCtx.beginPath();
    while(j<timeline.length && timeline[j].start < vpEndSamples){ // iterate through regions of the timeline whose start is left of the viewport

        const regionStartSamples = timeline[j].start;
        const startSamples = Math.max(regionStartSamples,vpStartSamples);

        let startBucket = Math.floor(startSamples/iterateAmount) //the index of the lowest level of the pyramid corresponding to the start
        
        let mipMapIndex = mipMapStart + Math.floor(startBucket / 2**(currRes+1));
        let k = 0; //k iterates through vertical lines to be drawn
        while((k+1)*pxGap  < WIDTH * (startSamples - vpStartSamples)/(vpEndSamples - vpStartSamples)){ 
            k+=1;
        }
        while(k*pxGap < WIDTH * (timeline[j].end - vpStartSamples)/(vpEndSamples - vpStartSamples)){
            const max = mipMap[mipMapIndex]/127;
            const min = mipMap[halfLength + mipMapIndex]/127;
            const y1 = ((1 + min) * HEIGHT) / 2;
            const y2 = ((1 + max) * HEIGHT) / 2;
            
            canvasCtx.moveTo(k*pxGap,y1);
            canvasCtx.lineTo(k*pxGap,y2);
            mipMapIndex += 1; k+=1;
        }
        j+=1
    }
    canvasCtx.stroke();

        
}
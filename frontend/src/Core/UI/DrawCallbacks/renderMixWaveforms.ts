import { CONSTANTS } from "@/Constants/constants";
import type { StateContainer } from "@/Core/State/State";

export function renderMixWaveforms(ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array){
        if(!(ref.current instanceof HTMLCanvasElement)){
            console.error("Reference in renderMixWaveforms is not a HTMLCanvasElement");
            return
        };
        const canvasCtx = ref.current.getContext("2d")!;
        Atomics.load(mipMap,0);

        const timeline = data.timeline.mix;
        const startTime = data.viewport.startTime;
        const WIDTH = canvasCtx.canvas.width;
        const HEIGHT = canvasCtx.canvas.height;
        const pxPerSecond = CONSTANTS.SAMPLE_RATE / data.viewport.samplesPerPx;
        const endTime = startTime + WIDTH / pxPerSecond;

        if(timeline.length === 0) return;
        
        canvasCtx.globalAlpha = 1.0
        canvasCtx.lineWidth = 1; // slightly thicker than 1px
        canvasCtx.strokeStyle =  "#1c1e22";
        canvasCtx.lineCap = "round";
        canvasCtx.lineJoin = "round";

        const vpStartSamples = Math.round(startTime * CONSTANTS.SAMPLE_RATE);
        const vpEndSamples = Math.round(endTime * CONSTANTS.SAMPLE_RATE);

        const pxPerTimeline = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE / (vpEndSamples-vpStartSamples) * WIDTH;
        
        let currRes = 0;
        const resolutions = CONSTANTS.MIPMAP_RESOLUTIONS;
        while(currRes+1<resolutions.length && resolutions[currRes + 1] > pxPerTimeline){
            currRes += 1;
        } 

        const halfLength = CONSTANTS.MIPMAP_HALF_SIZE;
        const iterateAmount = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE / halfLength;
        
        const mipMapStart = resolutions.slice(0,currRes).reduce((acc, curr) => acc + curr, 0);
        const pxGap = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS / (endTime - startTime) * CONSTANTS.MIPMAP_HALF_SIZE / resolutions[currRes];
        let startBucket = Math.floor(vpStartSamples/iterateAmount) //the index of the lowest level of the pyramid corresponding to the start
        
        let mipMapIndex = mipMapStart + Math.floor(startBucket / 2**(currRes+1));
        let k = 0; //k iterates through vertical lines to be drawn

        let endSample = 0;
        for(let track of timeline){
            for(let region of track){
                endSample = Math.max(endSample,region.end)
            }
        }
            
        
        canvasCtx.beginPath();
        while(k*pxGap < WIDTH * (endSample - vpStartSamples)/(vpEndSamples - vpStartSamples)){
            const max = mipMap[mipMapIndex]/127;
            const min = mipMap[halfLength + mipMapIndex]/127;
            const y1 = ((1 + min) * HEIGHT) / 2;
            const y2 = ((1 + max) * HEIGHT) / 2;
            
            canvasCtx.moveTo(k*pxGap,y1);
            canvasCtx.lineTo(k*pxGap,y2);
            mipMapIndex += 1; k+=1;
        }
        
        canvasCtx.stroke();

    }
import {Region } from "./types"

export function getMixTimelineEndSample(mixTimelines:Region[][]){
    let endSample:number = 0;
    for(let i=0;i<mixTimelines.length;i++){
        const currTimeline:Region[] = mixTimelines[i];
        const len = currTimeline.length;
        if(len>0){
            endSample = Math.max(endSample,currTimeline[len-1].end);
        }
    }
    return endSample;
}
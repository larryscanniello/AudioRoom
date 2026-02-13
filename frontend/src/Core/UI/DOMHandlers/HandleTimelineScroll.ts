import type { GlobalContext } from "@/Core/Mediator";
import type React from "react";
import { CONSTANTS } from "../../../Constants/constants";
import { Scroll } from "@/Core/Events/UI/Scroll";

export class HandleTimelineScroll {
    #context: GlobalContext
    constructor(context: GlobalContext) {
        this.#context = context;
    }
    timelineScroll(e: React.WheelEvent<HTMLDivElement>,ref: React.RefObject<HTMLElement|null>){
        e.preventDefault();
        console.log("Handling timeline scroll with delta: ", e.deltaX);
        if(!ref || !ref.current || !(ref.current instanceof HTMLCanvasElement)){
            console.error("Reference for canvas container was not found when handling timeline scroll");
            return;
        }
        const viewport = this.#context.query('viewport');
        const startTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const width = ref.current.width;
        const endTime = startTime + (width * samplesPerPx / CONSTANTS.SAMPLE_RATE);

        //the scroll speed needs to take zoom into account,
        //otherwise scrolling would be too fast when zoomed out and too slow when zoomed in
        const pxPerTimeline = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS / (endTime - startTime) * width;
            
        let currRes = 0;
        const resolutions = CONSTANTS.MIPMAP_RESOLUTIONS;
        while(currRes+1<resolutions.length && resolutions[currRes + 1] > pxPerTimeline){
            currRes += 1;
        } 
        let newStart = Math.max(0, startTime+(e.deltaX/25*(2**(currRes-6))));
        const newEnd = Math.min(CONSTANTS.TIMELINE_LENGTH_IN_SECONDS, endTime+(e.deltaX/25*(2**(currRes-6))));
        if(newEnd >= CONSTANTS.TIMELINE_LENGTH_IN_SECONDS){
            newStart = Math.max(0,CONSTANTS.TIMELINE_LENGTH_IN_SECONDS - (endTime - startTime));
        }
        const newViewport = { startTime: newStart, samplesPerPx };
        this.#context.dispatch(Scroll.getDispatchEvent({param: newViewport, emit: false}));
    }
}
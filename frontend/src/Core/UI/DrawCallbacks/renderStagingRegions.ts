import type { StateContainer } from "../../State/State";
import { CONSTANTS } from "@/Constants/constants";



export function renderStagingRegions(
    ref: React.RefObject<HTMLElement|null>,
    data: StateContainer,
    _mipMap: Int8Array
):void{
        if(!ref.current) {
            console.error("Reference in renderStagingRegions is not available");
            return;
        }
        if(!(ref.current instanceof HTMLDivElement)){
            console.error("Reference in renderStagingRegions is not a HTMLDivElement");
            return
        };

        const {viewport} = data;

        const stagingHeight = Number(ref.current.dataset.stagingheight);
        if(isNaN(stagingHeight)){
            console.error("Failed to parse staging track height from canvas dataset in renderStagingRegions");
            return;
        }
        const timelinePxLen = Number(ref.current.dataset.timelinepxlen);
        if(isNaN(timelinePxLen)){
            console.error("Failed to parse timeline pixel length from canvas dataset in renderStagingRegions");
            return;
        }
        const startTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const endTime = viewport.startTime + (timelinePxLen * samplesPerPx / CONSTANTS.SAMPLE_RATE);

        const stagingChildren = ref.current.children;
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
            child.style.height = `${stagingHeight}px`;
            child.style.background = "rgb(10, 138, 74,.5)";
            child.style.borderRadius = borderRadius;
            child.style.border = "2px solid rgb(220,220,2020,.8)";
            child.style.pointerEvents = "none";
        });
    }
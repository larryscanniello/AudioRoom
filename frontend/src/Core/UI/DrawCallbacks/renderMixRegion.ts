
import type { StateContainer } from "../../State/State";
import { CONSTANTS } from "@/Constants/constants";



export function renderMixRegion(
    ref: React.RefObject<HTMLElement|null>,
    data: StateContainer,
    _mipMap: Int8Array
):void{
        if(!ref.current) {
            console.error("Reference in renderMixRegion is not available");
            return;
        }
        if(!(ref.current instanceof HTMLDivElement)){
            console.error("Reference in renderMixRegion is not a HTMLDivElement");
            return
        };

        const {viewport} = data;

        const mixHeight = Number(ref.current.dataset.mixheight);
        if(isNaN(mixHeight)){
            console.error("Failed to parse mix track height from canvas dataset in renderMixRegion");
            return;
        }
        const timelinePxLen = Number(ref.current.dataset.timelinepxlen);
        if(isNaN(timelinePxLen)){
            console.error("Failed to parse timeline pixel length from canvas dataset in renderMixRegion");
            return;
        }
        const startTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const endTime = viewport.startTime + (timelinePxLen * samplesPerPx / CONSTANTS.SAMPLE_RATE);


        const mixChildren = ref.current.children;
        const elements: Element[] = Array.from(mixChildren);
        if(!elements || !mixChildren || mixChildren.length === 0) return;
        
        let lastSample = 0;
        elements.forEach((child:Element) => {
            if(!(child instanceof HTMLElement)){
                console.error("Child of mix regions was not an HTMLElement");
                return;
            }
            if(!child.dataset.start || !child.dataset.end){
                console.error("Region element was missing start or end data attributes");
                return;
            }
            const end = Number(child.dataset.end);
            lastSample = Math.max(lastSample,end);
        });

        const regionToDisplay = mixChildren[0];
        if(!(regionToDisplay instanceof HTMLElement)) {
            console.error("Region to display was not an HTMLElement");
            return;
        }
        const start = 0;
        const end = lastSample / CONSTANTS.SAMPLE_RATE;
        const left = Math.max(0,(start - startTime) / (endTime-startTime)) * Number(ref.current.dataset.timelinepxlen);
        const leftOverflow = Math.max(0, startTime - start);
        const rightOverflow = Math.max(0, end - endTime)
        const regionWidth = Math.min(1,(end - start - leftOverflow - rightOverflow) / (endTime-startTime)) * Number(ref.current.dataset.timelinepxlen);
        /*let borderRadius;
            if(start < startTime && end > endTime){
                borderRadius = "0px";
            }else if(start < startTime){
                borderRadius = "0px 7px 7px 0px";
            }else if(end > endTime){
                borderRadius = "7px 0px 0px 7px";
            }else{
                borderRadius = "7px";
            }*/
        regionToDisplay.style.display = "block"
        regionToDisplay.style.left = "0";
        regionToDisplay.style.top = "93px";
        regionToDisplay.style.position = "absolute"
        regionToDisplay.style.transform = `translateX(${left}px)`;
        regionToDisplay.style.width = `${regionWidth}px`;
        regionToDisplay.style.height = '57px';
        regionToDisplay.style.background = "rgb(10, 138, 74,.5)";
        //regionToDisplay.style.borderRadius = borderRadius;
        //regionToDisplay.style.border = "2px solid rgb(220,220,2020,.8)";
        regionToDisplay.style.pointerEvents = "none";
    }
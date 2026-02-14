import { CONSTANTS } from "@/Constants/constants";
import { type StateContainer } from "@/Core/State";

export function setPlayhead(ref: React.RefObject<HTMLElement|null>,data: StateContainer,_mipMap: Int8Array){
        if(!ref.current){
            console.error("Reference in setPlayhead is not available");
            return;
        }
        const {viewport,playheadTimeSeconds} = data;
        const containerWidth = ref.current.dataset.containerWidth;
        if(!containerWidth){
            console.error("Container width data attribute is missing in setPlayhead");
        }
        const startTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const endTime = startTime + samplesPerPx * Number(containerWidth) / CONSTANTS.SAMPLE_RATE;
        const totalTime = endTime - startTime;
        if(playheadTimeSeconds < startTime || playheadTimeSeconds >= endTime){
            ref.current.style.display = "none";
            return;
        }
        const playheadViewportTime = (playheadTimeSeconds - startTime)/totalTime;
        const playheadPx = playheadViewportTime * Number(containerWidth);
        ref.current.style.display = "block";
        ref.current.style.transform = `translateX(${playheadPx}px)`
    }
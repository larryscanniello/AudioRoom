import { type StateContainer } from "@/Classes/State";

export function setPlayhead(ref: React.RefObject<HTMLElement>,data: StateContainer,_mipMap: Int8Array){
        const {viewport,playheadLocation} = data;
        const containerWidth = ref.current.dataset.containerWidth;
        if(!containerWidth){
            console.error("Container width data attribute is missing in setPlayhead");
        }
        const startTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const endTime = startTime + samplesPerPx * Number(containerWidth);
        const totalTime = endTime - startTime;
        if(playheadLocation < startTime || playheadLocation >= endTime){
            ref.current.style.display = "none";
            return;
        }
        const playheadViewportTime = (playheadLocation - startTime)/totalTime;
        const playheadPx = playheadViewportTime * Number(containerWidth);
        ref.current.style.display = "block";
        ref.current.style.transform = `translateX(${playheadPx}px)`
    }
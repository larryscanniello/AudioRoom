import type { GlobalContext } from "@/Classes/Mediator";
import type React from "react";
import { CONSTANTS } from "../../../Constants/constants"
import Playhead from "@/Components/Room/AudioBoard/Timeline/Playhead";

export class HandlePlayheadMouseDown{
    #context: GlobalContext;
    #viewportStartTime: number = 0;
    #viewportEndTime: number = 0;

    constructor(context: GlobalContext) {
        this.#context = context;
    }

    playheadMouseDown = (e:React.MouseEvent,
                        waveformContainerRef:React.RefObject<HTMLCanvasElement>,
                        playheadRef:React.RefObject<HTMLDivElement>,
                    ) => {
       /*const rect = waveformContainerRef.current.getBoundingClientRect()
        if(e.clientY-rect.y < 30) return;*/
        const width = waveformContainerRef.current.width;
        const viewport = this.#context.query("viewport");
        this.#viewportStartTime = viewport.startTime;
        this.#viewportEndTime = viewport.startTime + width * viewport.samplesPerPx / CONSTANTS.SAMPLE_RATE;
        const handleMouseMove = (e: MouseEvent) => {
            if (!waveformContainerRef.current) return;
            const rect = waveformContainerRef.current.getBoundingClientRect();
            const x = e.clientX-rect.left
            const pxWindowRatio = (e.clientX-rect.left)/width
            const totalTime = this.#viewportEndTime - this.#viewportStartTime;
            const playheadPosInSeconds = this.#viewportStartTime+pxWindowRatio*totalTime;
            if(x<0){
                this.#context.dispatch(new PlayheadLocationChange(0));
            }
            else if(playheadPosInSeconds>this.#viewportEndTime){
                this.#context.dispatch(new PlayheadLocationChange(this.#viewportEndTime));
            }else{
                this.#context.dispatch(new PlayheadLocationChange(playheadPosInSeconds));
            }
        }
        
        const handleMouseUp = (_e: MouseEvent) => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

    }    
}
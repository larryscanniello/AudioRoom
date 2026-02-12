import type { GlobalContext } from "@/Core/Mediator";
import { CONSTANTS } from "../../../Constants/constants"
import { MovePlayhead } from "@/Core/Events/UI/MovePlayhead";

export class HandlePlayheadMouseDown{
    #context: GlobalContext;
    #viewportStartTime: number = 0;
    #viewportEndTime: number = 0;

    constructor(context: GlobalContext) {
        this.#context = context;
    }

    playheadMouseDown = (waveformContainer: HTMLCanvasElement) => {
       /*const rect = waveformContainerRef.current.getBoundingClientRect()
        if(e.clientY-rect.y < 30) return;*/
        const width = waveformContainer.width;
        const viewport = this.#context.query("viewport");
        this.#viewportStartTime = viewport.startTime;
        this.#viewportEndTime = viewport.startTime + width * viewport.samplesPerPx / CONSTANTS.SAMPLE_RATE;
        const handleMouseMove = (e: MouseEvent) => {
            const rect = waveformContainer.getBoundingClientRect();
            const x = e.clientX-rect.left
            const pxWindowRatio = (e.clientX-rect.left)/width
            const totalTime = this.#viewportEndTime - this.#viewportStartTime;
            const playheadPosInSeconds = this.#viewportStartTime+pxWindowRatio*totalTime;
            if(x<0){
                this.#context.dispatch(MovePlayhead.getDispatchEvent({param: 0, emit: true}));
            }
            else if(playheadPosInSeconds>this.#viewportEndTime){
                this.#context.dispatch(MovePlayhead.getDispatchEvent({param: this.#viewportEndTime, emit: true}));
            }else{
                this.#context.dispatch(MovePlayhead.getDispatchEvent({param: playheadPosInSeconds, emit: true}));
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
import type { GlobalContext } from "@/Core/Mediator";
import { ChangeBPM } from "@/Core/Events/UI/ChangeBPM";

export class HandleBPMBoxMouseDown {
    #context: GlobalContext;
    #startX: number = 0;
    #startBPM: number = 0;

    constructor(context: GlobalContext) {
        this.#context = context;
    }

    bpmBoxMouseDown(e: React.MouseEvent<HTMLElement>){
        e.preventDefault();
        this.#startX = e.clientX;
        this.#startBPM = this.#context.query("bpm");

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = (this.#startX - e.clientX)/2;
            const rawbpm = this.#startBPM - Math.floor(deltaX)
            const newbpm = Math.min(400, Math.max(30, rawbpm));
            this.#context.dispatch(ChangeBPM.getDispatchEvent({emit: false, param: newbpm}))
        };

        const handleMouseUp = () => {
            // On mouse up, we want to emit the final BPM value to ensure it gets sent to other clients
            this.#context.dispatch(ChangeBPM.getDispatchEvent({emit: true, param: this.#context.query("bpm")}))
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }
}
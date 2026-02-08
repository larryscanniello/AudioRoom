
import type { GlobalContext } from "../../Mediator";
import type { AppEvent } from "../../Events/AppEvent";
import { DOMElements } from "@/Constants/DOMElements";
import { HandleTimelineMouseDown } from "./HandleTimelineMouseDown";


export class DOMHandlers {
    #context: GlobalContext;
    #handleTimelineMouseDown: HandleTimelineMouseDown;
    #handlePlayheadMouseDown: HandlePlayheadMouseDown;
    #refs: Map<keyof typeof DOMElements, React.RefObject<HTMLElement>>;

    constructor(context: GlobalContext) {
        this.#context = context
        this.#refs = new Map();
        this.#handleTimelineMouseDown = new HandleTimelineMouseDown(context);
    }

    public registerRef(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLElement>) {
        this.#refs.set(ID, ref);
    }

    timelineMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
        const ref = this.#refs.get(DOMElements.CANVAS_CONTAINER);
        if(!ref){
            console.error("Reference for canvas container was not found when handling timeline mouse down");
            return;
        }
        this.#handleTimelineMouseDown.timelineMouseDown(e,ref);
    }

    handleTempoMouseDown(e: MouseEvent){
        e.preventDefault();
        const startX = e.clientX;
        const startBPM = this.#context.query("bpm");

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = (startX - e.clientX)/2;
            const newbpm = startBPM - Math.floor(deltaX)
            const BPMchange = new BPMchange();
            setBPM(prev=>{
                const newbpm = startBPM - Math.floor(deltaX)
                if(30<=newbpm&&newbpm<=400){
                    BPMRef.current = newbpm
                    return newbpm
                }else{
                    return prev
                }
            });
        };

        const handleMouseUp = () => {
            if(BPMRef.current&& numConnectedUsersRef.current >= 2){
                socket.current.emit("receive_bpm_client_to_server",{roomID,BPM:BPMRef.current})
            }
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }

    terminate() {
        window.removeEventListener("keydown", this.#handleKeyDown);
    }
}
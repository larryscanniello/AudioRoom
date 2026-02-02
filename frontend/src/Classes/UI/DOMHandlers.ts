
import type { GlobalContext } from "../DAW";
import type { AppEvent } from "../Events/AppEvent";


export class DOMHandlers {
    #context: GlobalContext;
    #handleKeyDown: (e: KeyboardEvent) => void;

    constructor(context: GlobalContext) {
        this.#context = context
        this.#handleKeyDown =
    }

    handleTempoMouseDown(e: MouseEvent){
        e.preventDefault();
        const startX = e.clientX;
        const startBPM = this.#query("bpm");

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
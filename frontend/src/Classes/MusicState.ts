import type {Timeline} from "./types/Timeline";
import { SocketManager } from "./SocketManager";

export class MusicState {
    private BPM: number = 100;
    private timeSignature: {numerator: number, denominator: number} = {numerator:4, denominator:4};
    private delayCompensation: number[] = [0];
    private looping: boolean = false;
    private streamAudioToPartner: boolean = false;
    private monitorPartner: boolean = false;
    private socketManager: SocketManager;

    //private timeline:Timeline;

    constructor(socketManager: SocketManager){
        this.socketManager = socketManager;

        this.socketManager.on("bpmUpdate", this.handleBPMUpdate.bind(this));
    }

    private handleBPMUpdate(BPM: number) {
        this.BPM = BPM;
        console.log(`BPM updated to ${BPM}`);
    }

    public setBPM(BPM: number) {
        this.BPM = BPM;
        this.socketManager.emitEvent("send_bpm_client_to_server", { BPM });
    }

    getLooping():boolean{
        return this.looping;
    }


}
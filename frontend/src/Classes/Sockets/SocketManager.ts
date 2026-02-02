import type { RefObject } from "react";
import type { MusicState } from "../MusicState";
import type { UIManager } from "./UIManager";
import { Orchestrator } from "../DAW";
import { CommunicationManager } from "../CommunicationManager";

export class SocketManager {
    private orchestrator: Orchestrator;
    private socket: any;
    private roomID: string;
    #communicationManager: CommunicationManager;

    constructor(orchestrator: Orchestrator, communicationManager: CommunicationManager, socket: any, roomID: string) {
        this.orchestrator = orchestrator;
        this.#communicationManager = communicationManager;
        this.socket = socket;
        this.roomID = roomID;
        this.initializeListeners();
    }

    // External Emitters called by Orchestrator
    public emitBPMChange(bpm: number) {
        this.socket.emit("send_bpm_client_to_server", { roomID: this.roomID, bpm });
    }

    public emitPlay() {
        this.socket.emit("client_to_server_play_audio", { roomID: this.roomID });
    }

    public emitStop() {
        this.socket.emit("stop_audio_client_to_server", this.roomID);
    }

    public emitStartRecording() {
        this.socket.emit("start_recording_client_to_server", this.roomID);
    }
    
    public emitSelection(start: any, end: any, snapToGrid: boolean) {
        this.socket.emit("send_play_window_to_server", {
            mouseDragStart: start,
            mouseDragEnd: end,
            snapToGrid,
            roomID: this.roomID
        });
    }

    private initializeListeners() {
        this.socket.on("server_to_client_play_audio", () => {
            this.orchestrator.onNetPlay();
            this.#communicationManager.sendMessage("PartnerAction", "Partner's audio played.");
        });

        this.socket.on("stop_audio_server_to_client", () => {
            this.orchestrator.onNetStop();
            this.#communicationManager.sendMessage("PartnerAction", "Partner's audio stopped.");
        });

        this.socket.on("send_bpm_server_to_client", (bpm: number) => {
            this.orchestrator.onNetBPMChange(bpm);
            this.#communicationManager.sendMessage("PartnerAction", `Partner changed BPM to ${bpm}.`);
        });

        this.socket.on("send_play_window_to_clients", (data: any) => {
             // Logic to update state via Orchestrator
             // this.orchestrator.updateState({ ... });
        });

        // ... Add remaining listeners from AudioBoardOld ...
    }

    public handlePartnerAction(action: string): void {
        this.#communicationManager.sendMessage("PartnerAction", `Partner's ${action} happened.`);
    }
}

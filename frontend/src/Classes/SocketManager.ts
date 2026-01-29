import type { RefObject } from "react";
import type { MusicState } from "./MusicState";
import type { UIManager } from "./UIManager";

export class SocketManager {
    private socket:RefObject<any>; 
    private musicState: MusicState;
    private UIManager: UIManager;
    private roomID: string = "default_room"

    constructor(socket: RefObject<any>, musicState: MusicState,) {
        this.socket = socket;
        this.musicState = musicState;
        this.initializeSocketListeners();
    }

    private initializeSocketListeners() {
        this.socket.on("send_play_window_to_clients", (data: any) => {
            this.setMouseDragStart(data.mouseDragStart);
            this.setMouseDragEnd(data.mouseDragEnd);
            let start = data.mouseDragEnd ? data.mouseDragStart.trounded : data.mouseDragStart.t;
            this.setPlayheadLocation(start);
            if (this.numConnectedUsersRef.current! >= 2 && !data.mouseDragEnd) {
                this.socket.emit("comm_event", {
                    type: "notify_that_partner_playhead_moved",
                    locationByMeasure: this.convertTimeToMeasuresRef.current!(start),
                    roomID: this.roomID,
                });
            } else if (this.numConnectedUsersRef.current! >= 2) {
                this.socket.emit("comm_event", {
                    type: "notify_that_partner_region_selection_changed",
                    roomID: this.roomID,
                    mouseDragStart: this.convertTimeToMeasuresRef.current!(start),
                    mouseDragEnd: this.convertTimeToMeasuresRef.current!(data.mouseDragEnd.trounded),
                });
            }
        });

        this.socket.on("server_to_client_play_audio", () => {
            this.handlePlayAudioRef.current!(true);
        });

        this.socket.on("handle_skipback_server_to_client", () => {
            this.setMouseDragEnd(null);
            this.setMouseDragStart({ trounded: 0, t: 0 });
            this.scrollWindowRef.current!.scrollLeft = 0;
            this.setPlayheadLocation(0);
            if (this.numConnectedUsersRef.current! >= 2) {
                this.socket.emit("comm_event", {
                    type: "notify_that_partner_playhead_moved",
                    roomID: this.roomID,
                    locationByMeasure: "1.1",
                });
            }
        });

        this.socket.on("request_audio_server_to_client", () => {
            return;
            const currentChunks = this.audioChunksRef.current;
            if (currentChunks && currentChunks.length > 0) {
                for (let i = 0; i < currentChunks.length; i++) {
                    this.socket.emit("send_audio_client_to_server", {
                        audio: currentChunks[i],
                        roomID: this.roomID,
                        i,
                        length: currentChunks.length,
                    });
                }
            }
        });

        this.socket.on("send_bpm_server_to_client", (bpm: number) => {
            this.setBPM(bpm);
            this.BPMRef.current = bpm;
            this.socket.emit("comm_event", {
                roomID: this.roomID,
                bpm,
                type: "notify_that_partner_BPM_changed",
            });
            clearTimeout(this.commsClearTimeoutRef.current!);
            this.setCommMessage({ text: `Partner changed BPM to ${bpm}`, time: performance.now() });
            this.commsClearTimeoutRef.current = setTimeout(() => this.setCommMessage(""), COMM_TIMEOUT_TIME);
        });

        this.socket.on("stop_audio_server_to_client", () => {
            this.handleStop(false, true, true);
        });

        this.socket.on("send_latency_server_to_client", (delayComp: number[]) => {
            this.setDelayCompensation2(delayComp);
            clearTimeout(this.commsClearTimeoutRef.current!);
            this.setCommMessage({ text: `Track 2 latency adjusted`, time: performance.now() });
            this.commsClearTimeoutRef.current = setTimeout(() => this.setCommMessage(""), COMM_TIMEOUT_TIME);
            this.socket.emit("comm_event", { roomID: this.roomID, type: "notify_that_partner_latency_comp_changed" });
        });

        this.socket.on("start_recording_server_to_client", () => {
            // Handle recording logic
        });

        this.socket.on("user_connected_server_to_client", (numConnectedUsers: number) => {
            this.numConnectedUsersRef.current = numConnectedUsers;
        });

        this.socket.on("user_disconnected_server_to_client", (numConnectedUsers: number) => {
            this.numConnectedUsersRef.current = numConnectedUsers;
            if (numConnectedUsers < 2) {
                this.setOtherPersonMonitoringOn(false);
                this.setMonitoringOn(false);
            }
        });

        this.socket.on("server_to_client_delete_audio", (track: number) => {
            this.handleStop(false, false, true);
        });

        this.socket.on("looping_server_to_client", (looping: boolean) => {
            this.setLooping(looping);
            this.socket.emit("comm_event", {
                type: "notify_that_partner_received_looping_change",
                roomID: this.roomID,
                looping,
            });
        });
    }
}

import type { Observer } from "@/Types/Observer";
import type { DataConnection } from "Peerjs";

export interface WebRTCManager extends Observer {
    getRemoteStream(): MediaStream | null;
    getLocalStream(): MediaStream | null;
    getLocalChatGain(): GainNode | null;
    getRemoteChatGain(): GainNode | null;
    getDataChannel(): DataConnection | null;
    joinSocketRoom(roomID: string): void;
    initializePeer(): void;
    loadStream(): Promise<GainNode | null>;
    getAVStream(): MediaStream;
    terminate(): void;
}
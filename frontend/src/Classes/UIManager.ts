import { SocketManager } from "./SocketManager";
import { MusicState } from "./MusicState";

export class UIManager {
    private mouseDragStart: { trounded: number; t: number };
    private mouseDragEnd: { trounded: number; t: number } | null;
    private playheadLocation: number;
    private viewPort: {startTime: number; endTime: number};
    private musicState: MusicState;

    constructor(musicState: MusicState) {
        this.musicState = musicState;   
    }

    private updatePlayWindow(data: any) {
        console.log("Play window updated:", data);
        // Update UI state here...
    }

    public setMouseDragStart(t:number) {
        const trounded = 

    }
}

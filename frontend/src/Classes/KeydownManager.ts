export class KeydownManager {
    private engine: AudioEngine;
    private session: SessionState;

    constructor(engine: AudioEngine, session: SessionState) {
        this.engine = engine;
        this.session = session;
        this.handleKeyDown = this.handleKeyDown.bind(this); // Bind the method to the class instance
        window.addEventListener("keydown", this.handleKeyDown);
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        switch (e.key) {
            case "Enter":
                setMouseDragStart({ trounded: 0, t: 0 });
                setMouseDragEnd(null);
                setPlayheadLocation(0);
                scrollWindowRef.current.scrollLeft = 0;
                if (numConnectedUsersRef.current >= 2) {
                    socket.current.emit("send_play_window_to_server", {
                        mouseDragStart: { trounded: 0, t: 0 }, mouseDragEnd: null, snapToGrid, roomID
                    })
                }
                break;
            case " ":
                if (currentlyRecording.current || currentlyPlayingAudio.current) {
                    handleStop(true, true, false);
                } else {
                    handlePlayAudioRef.current(false)
                    if (numConnectedUsersRef.current >= 2) {
                        socket.current.emit("client_to_server_play_audio", { roomID })
                    }
                }
                break;
            case "r":
                handleRecord();
                break;
        }
    }

    dispose(): void {
        // Remove the event listener to prevent memory leaks
        window.removeEventListener("keydown", this.handleKeyDown);
    }
}
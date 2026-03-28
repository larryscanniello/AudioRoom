import type { AudioController } from "../Audio/AudioController";
import type { HandleRegionEdit } from "./DOMHandlers/HandleRegionEdit";

export class KeydownManager {
    #audioController: AudioController;
    #handleRegionEdit: HandleRegionEdit;

    constructor(audioController: AudioController, handleRegionEdit: HandleRegionEdit) {
        this.#audioController = audioController;
        this.#handleRegionEdit = handleRegionEdit;
        this.addKeyDownListener();
    }

    addKeyDownListener() {
        window.addEventListener("keydown", this.handleKeyDown.bind(this));
    }

    public handleKeyDown(e: KeyboardEvent) {
        if (!e.target) return;

        const ctrl = e.ctrlKey || e.metaKey;
        const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

        // Region editing keys — skip when typing in an input
        if (!inInput) {
            if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
                e.preventDefault(); this.#handleRegionEdit.deleteSelected(); return;
            }
            if (ctrl && e.key === 'c') { e.preventDefault(); this.#handleRegionEdit.copy(); return; }
            if (ctrl && e.key === 'x') { e.preventDefault(); this.#handleRegionEdit.cut(); return; }
            if (ctrl && e.key === 'v') { e.preventDefault(); this.#handleRegionEdit.paste(); return; }
            if (!ctrl && e.key.toLowerCase() === 'x') { e.preventDefault(); this.#handleRegionEdit.splitAtPlayhead(); return; }
        }

        if (inInput) return;
        e.preventDefault();
        switch (e.key.toLowerCase()) {
            case 'enter':
                this.#audioController.skipBack(); break;
            case ' ': {
                const isPlaying = this.#audioController.query("isPlaying");
                const isRecording = this.#audioController.query("isRecording");
                if (isPlaying || isRecording) this.#audioController.stop();
                else this.#audioController.play();
                break;
            }
            case 'r':
                this.#audioController.record(); break;
            case 'z':
                if (ctrl) {
                    e.shiftKey ? this.#audioController.redo() : this.#audioController.undo();
                }
                break;
        }
    }

    terminate() {
        window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    }
}
import { State } from "./State";
import { AudioController } from "./Audio/AudioController";
import { UIController } from "./UI/UIController";
import { SocketManager } from "./Sockets/SocketManager";
import { WebRTCManager } from "./WebRTC/WebRTCManager";
import { UIEngine } from "./UI/UIEngine";
import { KeydownManager } from "./UI/KeydownManager";
import { DOMHandlers } from "./UI/DOMHandlers";

import type {StateContainer} from "./State"
import { type AppEvent,EventTypes } from "./Events/AppEvent";
import { type Observer, type Subject } from "../Types/Observer";
import { AudioEngine } from "./Audio/AudioEngine";

export type GlobalContext = {
    dispatch: (event: AppEvent<any>) => void,
    commMessage: (message: string, color: string) => void,
    query: <K extends keyof StateContainer>(key: K) => StateContainer[K];
}

export class DAW implements Subject {
    #state: State;
    #audioController: AudioController;
    #UIController: UIController;
    #socketManager: SocketManager|null = null;
    #webRTCManager: WebRTCManager|null = null;

    #observers: Observer<any>[] = [];

    constructor(
        audioEngine = new AudioEngine(), 
        uiEngine = new UIEngine(),
        socketManager  = null, 
        webRTCManager  = null
    ) {
        this.#state = new State();
        this.attach(audioEngine);
        this.attach(uiEngine);
        const globalContext:GlobalContext = {
            dispatch: this.dispatch,
            commMessage: this.#state.commMessage,
            query: this.#state.query,
        }

        this.#audioController = new AudioController(audioEngine, globalContext);
        this.#UIController = new UIController(uiEngine,globalContext,new KeydownManager(globalContext), new DOMHandlers(globalContext));
        this.#socketManager = socketManager;
        this.#webRTCManager = webRTCManager;
        //if (this.#socketManager) this.attach(this.#socketManager);
        //if (this.#webRTCManager) this.attach(this.#webRTCManager);
    }


    private dispatch<T>(event: AppEvent<T>): void {
        if (!event.canExecute(this.#state)) {
            return;
        }
        event.mutateState(this.#state);
        this.notify(event.type, event.getPayload(this.#state));
    }

    notify(type: keyof typeof EventTypes, data?: any): void {
        this.#observers.forEach(observer => observer.update(type, data));
    }

    public attach(observer: Observer<any>): void {
        this.#observers.push(observer);
    }

    public detach(observer: Observer<any>): void {
        this.#observers = this.#observers.filter(obs => obs !== observer);
    }

    public queryState<K extends keyof StateContainer>(key: K): StateContainer[K] {
        return this.#state.query(key);
    }

    public getAudioController(): AudioController {
        return this.#audioController;
    }

    public getUIController(): UIController {
        return this.#UIController;
    }
}
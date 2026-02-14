import type { State, TransactionData } from "../State"
import type { AudioEngine } from "../Audio/AudioEngine";
import type { UIEngine } from "../UI/UIEngine";
import type { SocketManager } from "../Sockets/SocketManager";
import type { DispatchEvent } from "../Mediator";

export const EventTypes = {
    START_PLAYBACK: 'START_PLAYBACK',
    START_RECORDING: 'START_RECORDING',
    STOP: 'STOP',
    SKIPBACK: 'SKIPBACK',
    CHANGE_BPM: 'CHANGE_BPM',
    JOIN_SOCKET_ROOM: 'JOIN_SOCKET_ROOM',
    TOGGLE_LOOPING: 'TOGGLE_LOOPING',
    TOGGLE_METRONOME: 'TOGGLE_METRONOME',
    SCROLL: 'SCROLL',
    ZOOM: 'ZOOM',
    MOVE_PLAYHEAD: 'MOVE_PLAYHEAD',
    EMIT_PEER_ID: 'EMIT_PEER_ID',
    DRAW_ALL_CANVASES: 'DRAW_ALL_CANVASES',
    SET_MOUSE_DRAG_START: 'SET_MOUSE_DRAG_START',
    SET_MOUSE_DRAG_END: 'SET_MOUSE_DRAG_END',
} as const;

export type EventParams = {
    [EventTypes.START_PLAYBACK]: null;
    [EventTypes.START_RECORDING]: null;
    [EventTypes.STOP]: null;
    [EventTypes.SKIPBACK]: null,
    [EventTypes.CHANGE_BPM]: number,
    [EventTypes.JOIN_SOCKET_ROOM]: {roomID: string},
    [EventTypes.TOGGLE_LOOPING]: null,
    [EventTypes.TOGGLE_METRONOME]: null,
    [EventTypes.SCROLL]: {startTime: number, samplesPerPx: number},
    [EventTypes.ZOOM]: {startTime: number, samplesPerPx: number},
    [EventTypes.MOVE_PLAYHEAD]: number,
    [EventTypes.EMIT_PEER_ID]: {peerID: string},
    [EventTypes.DRAW_ALL_CANVASES]: null,
    [EventTypes.SET_MOUSE_DRAG_START]: {t: number, trounded: number},
    [EventTypes.SET_MOUSE_DRAG_END]: {t: number, trounded: number} | null,
};

/*
    I decided to go with a fat event model. Everything you need to know about an event
    is encapsulated in its event object. Each event class is an object that conforms to the 
    EventNamespace type. 
*/
export type EventNamespace<K extends keyof EventParams> = {


    //Simple bool to track if event alters shared state. Some, like zoom, are not shared state
    sharedState: boolean;
    
    /*
        I wanted to make an event bus system that 
        1) can handle every type of event in the app uniformly
        2) does not require the new keyword for events, since certain events are high-frequency.
        So the app dispatches a plain js object with type DispatchEvent, which is held statically by all event namespaces
        getDispatchEvent always takes arg emit, which indicates if the event should be emitted to the server
        But param is optional; it is there for events that need to pass data (like zoom level, playhead time, etc)
    */
    getDispatchEvent: ({emit, param}:{emit: boolean, param: EventParams[K]}) => DispatchEvent;

    /*
        This will determine if a server validation is needed for a state transaction.
        These will almost always follow this pattern. So a function in a separate utility
        is provided. Unfortunately, this is necessary because typescript makes it hard 
        to work with static properties (can't just make an abstract class)
    */
    stateTransaction(state: State, transactionData: TransactionData): boolean;
    
    /*
        Retrieve any data needed that audio engine or ui engine will need from state
    */
    getLocalPayload(state: State): any;


    //Perform needed action in audio engine (ex: play needs to tell audio engine to play audio)
    executeAudio(engine: AudioEngine, data: any): void; 
    //Perform needed action in ui engine (ex: play needs to tell ui engine to start playhead animation)
    executeUI(engine: UIEngine, data: any): void;
    // Perform needed action over socket; will almost always be the same and use generic function
    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: any): void;
}
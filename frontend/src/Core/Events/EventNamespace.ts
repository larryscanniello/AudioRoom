import type { State, StateContainer, TransactionData } from "../State/State"
import type { AudioEngine } from "../Audio/AudioEngine";
import type { UIEngine } from "../UI/UIEngine";
import type { SocketManager } from "../Sockets/SocketManager";
import type { DispatchEvent } from "../Mediator";
import type { TimelineState } from "@/Types/AudioState";
import type { WebRTCManager } from "../WebRTC/WebRTCManager";

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
    PLAYHEAD_MOVE_MOUSE_DOWN: 'PLAYHEAD_MOVE_MOUSE_DOWN',
    PLAYHEAD_MOVE_AUTO: 'PLAYHEAD_MOVE_AUTO',
    DRAW_ALL_CANVASES: 'DRAW_ALL_CANVASES',
    SET_MOUSE_DRAG_START: 'SET_MOUSE_DRAG_START',
    SET_MOUSE_DRAG_END: 'SET_MOUSE_DRAG_END',
    RECORDING_FINISHED: 'RECORDING_FINISHED',
    MIPMAPS_DONE: 'MIPMAPS_DONE',
    BOUNCE: "BOUNCE",
    SET_NUMBER_OF_CONNECTED_USERS: "SET_NUMBER_OF_CONNECTED_USERS",
    REMOTE_STREAM_ATTACHED: "REMOTE_STREAM_ATTACHED",
    STATE_SYNC: "STATE_SYNC",
    RECORDING_PROGRESS: "RECORDING_PROGRESS",
    OTHER_PERSON_RECORDING: "OTHER_PERSON_RECORDING",
    DELETE_STAGING_REGIONS: "DELETE_STAGING_REGIONS",
    DELETE_MIX_REGIONS: "DELETE_MIX_REGIONS",
    UNDO_TIMELINE: "UNDO_TIMELINE",
    REDO_TIMELINE: "REDO_TIMELINE",
    TRIM_REGION: "TRIM_REGION",
    MOVE_REGION: "MOVE_REGION",
} as const;

export type EventParams = {
    [EventTypes.START_PLAYBACK]: null;
    [EventTypes.START_RECORDING]: number;
    [EventTypes.STOP]: number;
    [EventTypes.SKIPBACK]: null,
    [EventTypes.CHANGE_BPM]: number,
    [EventTypes.JOIN_SOCKET_ROOM]: string,
    [EventTypes.TOGGLE_LOOPING]: boolean,
    [EventTypes.TOGGLE_METRONOME]: boolean,
    [EventTypes.SCROLL]: {startTime: number, samplesPerPx: number},
    [EventTypes.ZOOM]: {startTime: number, samplesPerPx: number},
    [EventTypes.PLAYHEAD_MOVE_MOUSE_DOWN]: number,
    [EventTypes.PLAYHEAD_MOVE_AUTO]: number,
    [EventTypes.DRAW_ALL_CANVASES]: null,
    [EventTypes.SET_MOUSE_DRAG_START]: {t: number, trounded: number},
    [EventTypes.SET_MOUSE_DRAG_END]: {t: number, trounded: number} | null,
    [EventTypes.RECORDING_FINISHED]: TimelineState,
    [EventTypes.MIPMAPS_DONE]: null,
    [EventTypes.BOUNCE]: {timeline: TimelineState, bounce: number},
    [EventTypes.SET_NUMBER_OF_CONNECTED_USERS]: number,
    [EventTypes.REMOTE_STREAM_ATTACHED]: boolean,
    [EventTypes.STATE_SYNC]: StateContainer,
    [EventTypes.RECORDING_PROGRESS]: {start: number, end: number},
    [EventTypes.OTHER_PERSON_RECORDING]: number,
    [EventTypes.DELETE_STAGING_REGIONS]: TimelineState,
    [EventTypes.DELETE_MIX_REGIONS]: TimelineState,
    [EventTypes.UNDO_TIMELINE]: TimelineState,
    [EventTypes.REDO_TIMELINE]: TimelineState,
    [EventTypes.TRIM_REGION]: TimelineState,
    [EventTypes.MOVE_REGION]: TimelineState,
}
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
    getDispatchEvent: ({emit, param, serverMandated}:{emit: boolean, param: EventParams[K], serverMandated?: boolean}) => DispatchEvent;

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
    //Optional since this will only needed by a few events
    executeRTC?(webRTCManager: WebRTCManager, data: any): void;
}
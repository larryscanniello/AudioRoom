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
    SET_ZOOM: 'SET_ZOOM',
    CHANGE_BPM: 'CHANGE_BPM',
    JOIN_SOCKET_ROOM: 'JOIN_SOCKET_ROOM',
    TOGGLE_LOOPING: 'TOGGLE_LOOPING',
    TOGGLE_METRONOME: 'TOGGLE_METRONOME',
    SCROLL: 'SCROLL',
    ZOOM: 'ZOOM',
} as const;

export type EventParams = {
    [EventTypes.START_PLAYBACK]: null;
    [EventTypes.START_RECORDING]: null;
    [EventTypes.STOP]: null;
    [EventTypes.SKIPBACK]: null,
    [EventTypes.SET_ZOOM]: number,
    [EventTypes.CHANGE_BPM]: number,
    [EventTypes.JOIN_SOCKET_ROOM]: {roomId: string},
    [EventTypes.TOGGLE_LOOPING]: null,
    [EventTypes.TOGGLE_METRONOME]: null,
    [EventTypes.SCROLL]: number
    [EventTypes.ZOOM]: number,
};

/*
    I decided to go with a fat event model. Everything you need to know about an event
    is encapsulated in its event object. Each event class is an object that conforms to the 
    EventNamespace type. 
*/
export type EventNamespace = {
    /*
        This is an object with an array of queries and array of mutations.
        If the queries all succeed, then the mutations will be applied.
        For 2+ people, I use an optimistic approach with distributed state.
        First, the event is applied locally.
        then the event will be sent to the server for validation. If the server approves the event,
        then the event will be applied on all clients. If the server denies the event, 
        then the server will send a new state snapshot that will override the current state snapshot.
    */
    transactionData: TransactionData;

    //Simple bool to track if event alters shared state. Some, like zoom, are not shared state
    sharedState: boolean;
    
    /*
        I wanted to make an event bus system that 
        1) can handle every type of event in the app uniformly
        2) does not require the new keyword for events, since certain events are high-frequency.
        So the app dispatches a plain js object with type DispatchEvent, which is held statically by all event namespaces
        getDispatchEvent can either take a data argument or not, depending on needs of the event
        (ex: play doesn't need any data, but change zoom needs the new zoom level as data)
    */
    getDispatchEvent: ({emit, data}:{emit: boolean, data: any}) => DispatchEvent;

    /*
        This will determine if a server validation is needed for a state transaction.
        These will almost always follow this pattern. So a function in a separate utility
        is provided. Unfortunately, this is necessary because typescript makes it hard 
        to work with static properties (can't just make an abstract class)
    */
    stateTransaction(state: State, transactionData: TransactionData, sharedState: boolean): boolean;
    
    /*
        Retrieve any data needed that audio engine or ui engine will need from state
    */
    getLocalPayload(state: State): any;


    //Perform needed action in audio engine (ex: play needs to tell audio engine to play audio)
    executeAudio(engine: AudioEngine, data: any): void; 
    //Perform needed action in ui engine (ex: play needs to tell ui engine to start playhead animation)
    executeUI(engine: UIEngine, data: any): void;
    // Perform needed action over socket; will almost always be the same and use generic function
    executeSocket(socketManager: SocketManager, eventType: string, data: any): void;
}
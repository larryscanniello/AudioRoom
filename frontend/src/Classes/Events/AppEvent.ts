import { State } from "../State"
import type { StateContainer } from "../State";

export const EventTypes = {
    START_PLAYBACK: 'START_PLAYBACK',
    START_RECORDING: 'START_RECORDING',
    STOP: 'STOP',
    UPDATE: 'UPDATE',
    SKIPBACK: 'SKIPBACK',
    SET_ZOOM: 'SET_ZOOM',
    CHANGE_BPM: 'CHANGE_BPM',
} as const;

export interface AppEvent<T extends keyof typeof EventTypes = any, P = any>{
    readonly type: T
    payload: P;

    canExecute(state: State): "process" | "queue" | "denied"; //check if event can happen
    
    mutateState(state: State): void; //mutate state
    
    getPayload(state: State): P;
}

export interface StateChange<K extends keyof StateContainer = keyof StateContainer> extends AppEvent{
    
    toChangeTo: StateContainer[K];

}
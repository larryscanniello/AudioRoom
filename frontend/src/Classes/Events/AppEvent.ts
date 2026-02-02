import type { AudioEngine } from "../Audio/AudioEngine";
import type { UIEngine } from "../UI/UIEngine";
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

export interface AppEvent<T> {
    readonly type: typeof EventTypes[keyof typeof EventTypes];

    canExecute(state: State): boolean; //check if event can happen
    
    mutateState(state: State): void; //mutate state
    
    getPayload(state: State): any; //send data to the endpoint (audio worklet, canvas, etc.) required by event

    execute(param: T, data?:any): void;
}

export interface StateChange<K extends keyof StateContainer = keyof StateContainer> extends AppEvent<void>{
    readonly key: K;
    
    toChangeTo: StateContainer[K];

    setToChangeTo(newValue: StateContainer[K]): void;
}

export interface AudioEvent<S> extends AppEvent<AudioEngine> {
    data: S;
    execute(audioEngine: AudioEngine,data?:S): void;
}

export interface CanvasEvent<S> extends AppEvent<UIEngine> {
    data: S;
    execute(UIEngine: UIEngine,data?:S): void;
}
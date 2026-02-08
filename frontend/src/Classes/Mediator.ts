import { State } from "./State";
import { EventQueue } from "./EventQueue";
import { EVENT_QUEUE_LENGTH } from "@/Constants/constants";

import type { StateContainer } from "./State"
import { type AppEvent,EventTypes } from "./Events/AppEvent";
import type { Observer, Subject } from "../Types/Observer";

export type GlobalContext = {
    dispatch: (event: AppEvent) => void,
    commMessage: (message: string, color: "white" | "red" | "green") => void,
    query: <K extends keyof StateContainer>(key: K) => StateContainer[K];
}

export class Mediator implements Subject {
    #state: State;
    #globalContext: GlobalContext;
    #eventQueue: EventQueue;

    #observers: Observer[] = [];

    constructor(state: State = new State()){ {
        this.#state = state;
        this.#globalContext = {
            dispatch: this.#dispatch.bind(this),
            commMessage: this.#state.commMessage.bind(this.#state),
            query: this.#state.query.bind(this.#state),
        }
        this.#eventQueue = new EventQueue(EVENT_QUEUE_LENGTH);
    }

    public getGlobalContext(): GlobalContext {
        return this.#globalContext;
    }

    #dispatch(event: AppEvent): void {
        const action = event.canExecute(this.#state);
        if(action === "process"){this.#processEvent(event);}
        else if(action === "queue"){this.#eventQueue.enqueue(event);}
    }

    #processEvent(event: AppEvent){
        event.mutateState(this.#state);
        this.notify(event.type, event.getPayload(this.#state));
    }

    notify(type: keyof typeof EventTypes, data?: any): void {
        this.#observers.forEach(observer => observer.update(type, data));
    }

    attach(observer: Observer): void {
        this.#observers.push(observer);
    }

    detach(observer: Observer): void {
        this.#observers = this.#observers.filter(obs => obs !== observer);
    }
}
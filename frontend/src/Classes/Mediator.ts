import { State } from "./State";

import type { StateContainer } from "./State"
import { type EventParams } from "./Events/EventNamespace";
import type { Observer, Subject } from "../Types/Observer";

export type GlobalContext = {
    dispatch: (event: DispatchEvent) => void,
    commMessage: (message: string, color: "white" | "red" | "green") => void,
    query: <K extends keyof StateContainer>(key: K) => StateContainer[K];
}

export type DispatchEvent = {
    [K in keyof EventParams]: {
        type: K;
        data: EventParams[K];
        getEventNamespace: () => any; 
    }
}[keyof EventParams];

export class Mediator implements Subject {
    #state: State;
    #globalContext: GlobalContext;

    #observers: Observer[] = [];

    constructor(state: State = new State()) {
        this.#state = state;
        this.#globalContext = {
            dispatch: this.#dispatch.bind(this),
            commMessage: this.#state.commMessage.bind(this.#state),
            query: this.#state.query.bind(this.#state),
        }
    }

    public getGlobalContext(): GlobalContext {
        return this.#globalContext;
    }

    #dispatch(event: DispatchEvent): void {
        const namespace = event.getEventNamespace();
        const successfulTransaction = namespace.stateTransaction(this.#state, namespace.transactionData, namespace.sharedState);
        if(successfulTransaction){this.#processEvent(event);}
    }

    #processEvent(event: DispatchEvent): void {
        const namespace = event.getEventNamespace();
        this.notify(event, namespace.getLocalPayload(this.#state));
    }

    notify(event: DispatchEvent, data: any): void {
        this.#observers.forEach(observer => observer.update(event, data));
    }

    attach(observer: Observer): void {
        this.#observers.push(observer);
    }

    detach(observer: Observer): void {
        this.#observers = this.#observers.filter(obs => obs !== observer);
    }
}
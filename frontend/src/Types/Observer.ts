import type { DispatchEvent } from "@/Core/Mediator";

interface Observer {
    update(event: DispatchEvent,data:any): void;
}

interface Subject {
    attach(observer: Observer): void;

    detach(observer: Observer): void;

    notify(event: DispatchEvent, data: any): void;
}



export type { Observer, Subject };
import { EventTypes } from "@/Classes/Events/AppEvent";
import type { AppEvent } from "@/Classes/Events/AppEvent";

interface Observer {
    update(event: AppEvent,data?:any): void;
}

interface Subject {
    attach(observer: Observer): void;

    detach(observer: Observer): void;

    notify(event: keyof typeof EventTypes,data: any): void;
}



export type { Observer, Subject };
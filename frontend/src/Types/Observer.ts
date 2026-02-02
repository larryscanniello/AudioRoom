import { EventTypes } from "@/Classes/Events/AppEvent";
import type { AppEvent } from "@/Classes/Events/AppEvent";

interface Observer<T> {
    update(event: AppEvent<T>,data?:any): void;
}

interface Subject {
    attach(observer: Observer<any>): void;

    detach(observer: Observer<any>): void;

    notify(event: keyof typeof EventTypes,data: any): void;
}



export type { Observer, Subject };
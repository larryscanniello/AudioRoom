
import type { AppEvent } from "./Events/AppEvent";

type QueueMember = {
    event: AppEvent;
    time: number,
    status: "pending" | "accepted" | "denied" | "aborted";
}

export class EventQueue {
    #keys: Uint32Array;
    #map: Map<number, QueueMember>;
    #front: number = 0; //this points to point to insert at the front of the queue, as in the one to be dequeued next
    #back: number = 0; //this points the element at the back of the queue, as in the one most recently enqueued
    #isFull: boolean = false;

    constructor(capacity:number){
        this.#keys = new Uint32Array(capacity);
        this.#map = new Map<number, QueueMember>();
    }

    enqueue(event: AppEvent) {
        if(this.#isFull) {
            throw new Error("Queue is full");
        }
        event.setID(this.#back);
        this.#map.set(event.id, {event, time: performance.now(), status: "pending"});
        this.#keys[this.#back] = event.id;
        this.#back = (this.#back + 1) % this.#keys.length;
        if((this.#back + 1) % this.#keys.length === this.#front) {
            this.#isFull = true;
        }
    }

    dequeue(): AppEvent | undefined {
        if(this.#front === this.#back) {
            return undefined;
        }
        const eventId = this.#keys[this.#front];
        const queuemember = this.#map.get(eventId);
        this.#map.delete(eventId);
        this.#front = (this.#front + 1) % this.#keys.length;
        this.#isFull = false;
        return queuemember ? queuemember.event : undefined;
    }

    isFull(): boolean {
        return this.#isFull;
    }

    isEmpty(): boolean {
        return !this.#isFull && (this.#front === this.#back);
    }

    updateStatus(id: number, status: "accepted" | "denied" | "aborted"): void {
        const queuemember = this.#map.get(id);
        if(queuemember){
            queuemember.status = status;
        }
    }

    peek(): QueueMember | undefined {
        if(this.isEmpty()) {
            return undefined;
        }
        const eventId = this.#keys[this.#front];
        return this.#map.get(eventId);
    }

    processQueue(processEvent: (event: AppEvent) => void) {
    let curr = this.peek();
    while (curr) {
        const isStale = performance.now() - curr.time > 2000;
        const isResolved = curr.status !== "pending";

        if (isResolved || isStale) {
            processEvent(curr.event); 
            this.dequeue();   
            curr = this.peek();
        } else {
            break; 
        }
    }
}
}
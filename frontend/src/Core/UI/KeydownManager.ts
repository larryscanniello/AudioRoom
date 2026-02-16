import { Skipback } from "../Events/Audio/Skipback";
import { Play } from "../Events/Audio/Play"
import { Record } from "../Events/Audio/Record"
import { Stop } from "../Events/Audio/Stop";

import type { GlobalContext } from "../Mediator"

export class KeydownManager {
    #context: GlobalContext;
    
    constructor(context: GlobalContext) {
        this.#context = context;
        this.addKeyDownListener();
    }

    addKeyDownListener() {
        window.addEventListener("keydown", this.handleKeyDown.bind(this));
    }

    public handleKeyDown(e: KeyboardEvent) {   
        if(!e.target) return;
        e.preventDefault();
        switch(e.key.toLowerCase()) {
            case"enter":
                this.#context.dispatch(Skipback.getDispatchEvent({param: null, emit: true}));
                break;
            case" ":
                const isPlaying = this.#context.query("isPlaying");
                const isRecording = this.#context.query("isRecording");
                if(isPlaying || isRecording){
                    this.#context.dispatch(Stop.getDispatchEvent({param: null, emit: true}));
                }else{
                    this.#context.dispatch(Play.getDispatchEvent({param: null, emit: true}));
                }
                break;
            case"r":
                this.#context.dispatch(Record.getDispatchEvent({param: null, emit: true}));
                break;
        }
        
    }

    terminate() {
        window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    }
}
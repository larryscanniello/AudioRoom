import { Skipback } from "../Events/Audio/Skipback";
import { Play } from "../Events/Audio/Play"
import { Record } from "../Events/Audio/Record"

import type { GlobalContext } from "../DAW"

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
                this.#context.dispatch(new Skipback());
                break;
            case" ":
                this.#context.dispatch(new Play());
                break;
            case"r":
                this.#context.dispatch(new Record());
                break;
        }
        
    }

    terminate() {
        window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    }
}

import { Play } from "../Events/Audio/Play"
import { Record } from "../Events/Audio/Record"
import { Stop } from "../Events/Audio/Stop"
import { Skipback } from "../Events/Audio/Skipback";
import { Metronome } from "../Events/Audio/Metronome";
import { Loop } from "../Events/Audio/Loop";

import type { StateContainer } from "../State/State";
import type { GlobalContext } from "../Mediator"
import type { AudioEngine } from "./AudioEngine";
import type { Mixer } from "./Mixer";

import timelineReducer from "../State/timelineReducer";
import { Bounce } from "../Events/Audio/Bounce";
import { DeleteStagingRegions } from "../Events/Audio/DeleteStagingRegions";
import { DeleteMixRegions } from "../Events/Audio/DeleteMixRegions";
import { UndoTimeline } from "../Events/Audio/UndoTimeline";
import { RedoTimeline } from "../Events/Audio/RedoTimeline";
import { TrimRegion } from "../Events/Audio/TrimRegion";
import { MoveRegion } from "../Events/Audio/MoveRegion";


export class AudioController{
    #context: GlobalContext;
    #mixer: Mixer;
    #audioEngine: AudioEngine;

    constructor(audioEngine: AudioEngine,context:GlobalContext,mixer:Mixer) {
        this.#audioEngine = audioEngine;
        this.#context = context;
        this.#mixer = mixer;
    }

    public play() {
        this.#context.dispatch(Play.getDispatchEvent({emit:true, param: null,serverMandated: false}));
    }

    public record() {
        const prevTakeNum = this.#context.query("take");
        this.#context.dispatch(Record.getDispatchEvent({emit:true, param: prevTakeNum + 1,serverMandated: false}));
    }

    public stop() {
        const stopTime = this.#context.query("playheadTimeSeconds");
        this.#context.dispatch(Stop.getDispatchEvent({emit:true, param: stopTime,serverMandated: false}));
    }  

    public skipBack() {
        this.#context.dispatch(Skipback.getDispatchEvent({emit:true, param: null,serverMandated: false}));
    }

    public bounce(){
        const timeline = this.#context.query("timeline");
        const newTimeline = timelineReducer(timeline, { type: "bounce_to_mix" });
        const prevBounce = this.#context.query("bounce");
        const bounceState = {timeline: newTimeline, bounce: prevBounce + 1};
        this.#context.dispatch(Bounce.getDispatchEvent({emit:true, param: bounceState,serverMandated: false}));
    }

    public toggleMetronome() {
        const isMetronomeOn = this.#context.query("isMetronomeOn");
        this.#context.dispatch(Metronome.getDispatchEvent({emit:true, param: !isMetronomeOn,serverMandated: false}));
    }

    public toggleLooping() {
        const isLooping = this.#context.query("isLooping");
        this.#context.dispatch(Loop.getDispatchEvent({emit:true, param: !isLooping,serverMandated: false}));
    }

    public changeStagingVolume(volume: number) {
        this.#mixer.setStagingMasterVolume(volume);
    }

    public changeMixVolume(volume: number) {
        this.#mixer.setMixMasterVolume(volume);
    }

    public muteStagingToggle() {
        this.#mixer.muteStagingToggle();
    }

    public muteMixToggle() {
        this.#mixer.muteMixToggle();
    }

    public isStagingTrackMuted(): boolean {
        return this.#context.query("stagingMuted");
    }

    public isMixTrackMuted(): boolean {
        return this.#context.query("mixMuted");
    }

    public deleteStagingRegions() {
        const timeline = this.#context.query("timeline");
        const newTimeline = timelineReducer(timeline, { type: "delete_staging_regions" });
        this.#context.dispatch(DeleteStagingRegions.getDispatchEvent({emit:true, param: newTimeline,serverMandated: false}));
    }

    public deleteMixRegions() {
        const timeline = this.#context.query("timeline");
        const newTimeline = timelineReducer(timeline, { type: "delete_mix_regions" });
        this.#context.dispatch(DeleteMixRegions.getDispatchEvent({emit:true, param: newTimeline, serverMandated: false}));
    }

    public undo() {
        const timeline = this.#context.query("timeline");
        if (timeline.undoStack.length === 0) return;
        const newTimeline = timelineReducer(timeline, { type: "undo" });
        this.#context.dispatch(UndoTimeline.getDispatchEvent({emit:true, param: newTimeline, serverMandated: false}));
    }

    public redo() {
        const timeline = this.#context.query("timeline");
        if (timeline.redoStack.length === 0) return;
        const newTimeline = timelineReducer(timeline, { type: "redo" });
        this.#context.dispatch(RedoTimeline.getDispatchEvent({emit:true, param: newTimeline, serverMandated: false}));
    }

    //trimRegion and moveRegion are not currently actually used in the code, but they are implemented in case future use is needed
    public trimRegion(id: string, newStart: number, newEnd: number) {
        const newTimeline = timelineReducer(this.#context.query("timeline"), { type: "trim_region", id, newStart, newEnd });
        this.#context.dispatch(TrimRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
    }

    public moveRegion(id: string, deltaSamples: number) {
        const newTimeline = timelineReducer(this.#context.query("timeline"), { type: "move_region", id, deltaSamples });
        this.#context.dispatch(MoveRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
    }

    public query<K extends keyof StateContainer>(query: K): StateContainer[K] {
        return this.#context.query(query);
    }

    public initAudioEngine(){
        this.#audioEngine.init();
        this.#audioEngine.toggleMetronome();
    }

}
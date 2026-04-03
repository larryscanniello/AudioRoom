
import { Play } from "../Events/Audio/Play"
import { Record } from "../Events/Audio/Record"
import { Stop } from "../Events/Audio/Stop"
import { Skipback } from "../Events/Audio/Skipback";
import { Metronome } from "../Events/Audio/Metronome";
import { Loop } from "../Events/Audio/Loop";

import type { StateContainer } from "../State/State";
import type { GlobalContext } from "../Mediator"
import type { AudioEngine } from "./AudioEngine";

import timelineReducer from "../State/timelineReducer";
import { Bounce } from "../Events/Audio/Bounce";
import { DeleteStagingRegions } from "../Events/Audio/DeleteStagingRegions";
import { DeleteMixRegions } from "../Events/Audio/DeleteMixRegions";
import { DeleteMixBounces } from "../Events/Audio/DeleteMixBounces";
import { ReStage } from "../Events/Audio/ReStage";
import { UndoTimeline } from "../Events/Audio/UndoTimeline";
import { RedoTimeline } from "../Events/Audio/RedoTimeline";
import { TrimRegion } from "../Events/Audio/TrimRegion";
import { MoveRegion } from "../Events/Audio/MoveRegion";
import { ToggleSnapToGrid } from "../Events/Audio/SnapToGrid";
import { StartLatencyTest } from "../Events/Audio/StartLatencyTest";
import { ToggleMixMute } from "../Events/Audio/ToggleMixMute";
import { ToggleStagingMute } from "../Events/Audio/ToggleStagingMute";
import { ChangeMixVolume } from "../Events/Audio/ChangeMixVolume";
import { ChangeStagingVolume } from "../Events/Audio/ChangeStagingVolume";
import { ChangeChannelVolume } from "../Events/Audio/ChangeChannelVolume";
import mixerReducer from "../State/mixerReducer";


export class AudioController{
    #context: GlobalContext;
    #audioEngine: AudioEngine;

    constructor(audioEngine: AudioEngine,context:GlobalContext) {
        this.#audioEngine = audioEngine;
        this.#context = context;
    }

    public play() {
        const playCount = this.#context.query("globalPlayCount");
        this.#context.dispatch(Play.getDispatchEvent({emit:true, param: playCount + 1,serverMandated: false}));
    }

    public record() {
        const prevTakeNum = this.#context.query("take");
        const prevGlobalTakeNum = this.#context.query("globalTake");
        this.#context.dispatch(Record.getDispatchEvent({emit:true, param: {take: prevTakeNum + 1, globalTake: prevGlobalTakeNum + 1},serverMandated: false}));
    }

    public stop() {
        const stopTime = this.#context.query("playheadTimeSeconds");
        this.#context.dispatch(Stop.getDispatchEvent({emit:true, param: stopTime,serverMandated: false}));
    }  

    public skipBack() {
        this.#context.dispatch(Skipback.getDispatchEvent({emit:true, param: null,serverMandated: false}));
    }

    public bounce(name: string){
        const timeline = this.#context.query("timeline");
        if ((timeline.staging[0]?.length ?? 0) === 0) return;
        const newTimeline = timelineReducer(timeline, { type: "bounce_to_mix", name });
        const prevBounce = this.#context.query("bounce");
        const prevGlobalTake = this.#context.query("globalTake");
        const bounceState = {timeline: newTimeline, bounce: prevBounce + 1, globalTake: prevGlobalTake + 1};
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
        this.#context.dispatch(ChangeStagingVolume.getDispatchEvent({ emit: true, param: volume, serverMandated: false }));
    }

    public changeStagingVolumeLocal(volume: number) {
        this.#context.dispatch(ChangeStagingVolume.getDispatchEvent({ emit: false, param: volume, serverMandated: false }));
    }

    public changeMixVolume(volume: number) {
        this.#context.dispatch(ChangeMixVolume.getDispatchEvent({ emit: true, param: volume, serverMandated: false }));
    }

    public changeMixVolumeLocal(volume: number) {
        this.#context.dispatch(ChangeMixVolume.getDispatchEvent({ emit: false, param: volume, serverMandated: false }));
    }

    public changeChannelVolumeLocal(channelId: string, volume: number) {
        const newMixerState = mixerReducer(this.#context.query("mixerState"), { type: 'change_channel_volume', channelId, volume });
        this.#context.dispatch(ChangeChannelVolume.getDispatchEvent({ emit: false, param: newMixerState, serverMandated: false }));
    }

    public changeChannelVolume(channelId: string, volume: number) {
        const newMixerState = mixerReducer(this.#context.query("mixerState"), { type: 'change_channel_volume', channelId, volume });
        this.#context.dispatch(ChangeChannelVolume.getDispatchEvent({ emit: true, param: newMixerState, serverMandated: false }));
    }

    public muteStagingToggle() {
        this.#context.dispatch(ToggleStagingMute.getDispatchEvent({ emit: true, param: !this.#context.query("stagingMuted"), serverMandated: false }));
    }

    public muteMixToggle() {
        this.#context.dispatch(ToggleMixMute.getDispatchEvent({ emit: true, param: !this.#context.query("mixMuted"), serverMandated: false }));
    }

    public startLatencyTest(){
        console.log("Dispatching StartLatencyTest event");
        this.#context.dispatch(StartLatencyTest.getDispatchEvent({emit:false, param: null,serverMandated: false}));
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

    public reStage(bounceIndex: number) {
        const timeline = this.#context.query("timeline");
        const newTimeline = timelineReducer(timeline, { type: "restage_from_mix", bounceIndex });
        this.#context.dispatch(ReStage.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
    }

    public deleteMixBounces(bounceIndices: number[]) {
        const timeline = this.#context.query("timeline");
        const newTimeline = timelineReducer(timeline, { type: "delete_mix_bounces", bounceIndices });
        this.#context.dispatch(DeleteMixBounces.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
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

    //trimRegion and moveRegion are not currently actually used in the code, but they are implemented in case future use is needed
    public moveRegion(id: string, deltaSamples: number) {
        const newTimeline = timelineReducer(this.#context.query("timeline"), { type: "move_region", id, deltaSamples });
        this.#context.dispatch(MoveRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
    }

    public toggleSnapToGrid() {
        const snapToGrid = this.#context.query("snapToGrid");
        this.#context.dispatch(ToggleSnapToGrid.getDispatchEvent({ emit: true, param: !snapToGrid, serverMandated: false }));
    }

    public query<K extends keyof StateContainer>(query: K): StateContainer[K] {
        return this.#context.query(query);
    }

    public initAudioEngine(){
        this.#audioEngine.init();
        this.#audioEngine.toggleMetronome();
    }

}
import type { Region, TimelineState, Action } from '../../Types/AudioState';

export default function timelineReducer(state:TimelineState, action: any): TimelineState {
        switch(action.type){
            case "add_region":
                const {timelineStart,timelineEnd,takeNumber,fileName,bounceNumber,delayCompensation} = action.data;
                if(timelineEnd <= timelineStart){
                    console.error("Invalid region: end must be greater than start");
                    return state;
                }
                const newRegion = {
                    start:timelineStart,
                    end:timelineEnd,
                    bounce:bounceNumber,
                    take:takeNumber,
                    name:fileName,
                    offset: delayCompensation[0],
                }
                if(state.regionStack.length === 0){ 
                    return {
                    regionStack: [newRegion],
                    staging:[[newRegion]],
                    mix: state.mix,
                    redoStack: [],
                }};
                const regionStack = [...state.regionStack,newRegion];
                const timeline: Region[] = [];
                for(const r of regionStack.reverse()){ 
                    const shards: (Region|null)[] = [r];
                    for(let i=timeline.length-1;i>=0;i--){
                        for(let j=0;j<shards.length;j++){
                            const s = shards[j];
                            if(!s) continue;
                            const startCollision = timeline[i].start <= s.start && s.start < timeline[i].end;
                            const endCollision = timeline[i].start < s.end && s.end <= timeline[i].end;
                            const shardContainsRegion = s.start <= timeline[i].start && timeline[i].end < s.end;
                            if(shardContainsRegion){
                                const newShard1:Region = {...s,end:timeline[i].start};
                                const newShard2:Region = {...s,start:timeline[i].end};
                                shards[j] = null;
                                shards.push(newShard1); shards.push(newShard2);
                            }else if(startCollision && endCollision){
                                shards[j] = null;
                            }else if(startCollision){
                                const newStart = timeline[i].end;
                                if(newStart < s.end){
                                    shards[j] = {...s,start:newStart}
                                }else{
                                    shards[j] = null;
                                }
                            }else if(endCollision){
                                const newEnd = timeline[i].start;
                                if(newEnd > s.start){
                                    shards[j] = {...s,end:newEnd}
                                }else{
                                    shards[j] = null;
                                }
                            }
                        }
                    }
                    for(const s of shards){
                        if(s) timeline.push(s);
                    }
                }
                timeline.sort((a, b) => a.start - b.start);
                regionStack.reverse();
                const toReturn = {regionStack,staging:[timeline],mix:state.mix,redoStack:[]};
                 //there's another return earlier in the function... lol
                return toReturn;
            case "bounce_to_mix":
                const newState = {
                    staging: [],
                    mix: [...state.mix,[...state.staging[0]]],
                    regionStack: [],
                    redoStack: [],
                };
                return newState
            default:
                if(import.meta.env.PRODUCTION){
                    return state;
                }else{
                    throw new Error(`Unhandled action type: ${(action as any).type}`);    
                }
            
        }
    }
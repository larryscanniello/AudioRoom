

export default function timelineReducer(state,action){
        switch(action.type){
            case "add_region":
                const {timelineStart,timelineEnd,takeNumber,fileName,fileLength} = action.data;
                const newRegion = {
                    start:timelineStart,
                    end:timelineEnd,
                    number:takeNumber,
                    name:fileName,
                    offset: delayCompensation[0],
                    length:fileLength,
                }
                if(state.regionStack.length === 0) return {
                    regionStack: [newRegion],
                    stagingTimeline:[newRegion],
                    mixTimeline: state.mixTimeline,
                    undoStack: [], //clear undo stack
                };
                const regionStack = [...state.regionStack,newRegion];
                const timeline = [];
                for(const r of regionStack.reverse()){ 
                    const shards = [r];
                    for(let i=timeline.length-1;i>=0;i--){
                        for(let j=0;j<shards.length;j++){
                            const s = shards[j];
                            if(!s) continue;
                            const startCollision = timeline[i].start <= s.start && s.start < timeline[i].end;
                            const endCollision = timeline[i].start <= s.end && s.end < timeline[i].end;
                            const shardContainsRegion = s.start <= timeline[i].start && timeline[i].end < s.end;
                            if(shardContainsRegion){
                                const newShard1 = {...shards[j],end:timeline[i].start};
                                const newShard2 = {...shards[j],start:timeline[i].end};
                                shards[j] = null;
                                shards.push(newShard1); shards.push(newShard2);
                            }else if(startCollision && endCollision){
                                shards[j] = null;
                            }else if(startCollision){
                                const newStart = timeline[i].end;
                                if(newStart < shards[j].end){
                                    shards[j] = {...shards[j],start:newStart}
                                }else{
                                    shards[j] = null;
                                }
                            }else if(endCollision){
                                const newEnd = timeline[i].start;
                                if(newEnd > shards[j].start){
                                    shards[j] = {...shards[j],end:newEnd}
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
                const toReturn = {regionStack,stagingTimeline:timeline,undoStack:[],mixTimeline:state.mixTimeline}
                action.fileSystemRef.current.postMessage({type:"fill_staging_mipmap",newTake:regionStack[regionStack.length-1]});
                return toReturn;
        }
    }
import { useWindowSize } from "../../useWindowSize.tsx"

import { AudioController } from "../../../Core/Audio/AudioController.ts";
import { UIController } from "../../../Core/UI/UIController.ts";
import { PeerJSManager } from "../../../Core/WebRTC/PeerJSManager.ts";

import TrackList from "./TrackList/TrackList";
import UpperLeftBox from "./TrackList/UpperLeftBox";
import StagingTrackHeader from "./TrackList/StagingTrackHeader";
import MixTrackHeader from "./TrackList/MixTrackHeader";
import Timeline from "./Timeline/Timeline";
import Transport from "./Transport/Transport";
import Stop from "./Transport/Stop";
import Record from "./Transport/Record";
import ZoomSlider from "./BottomRight/ZoomSlider";

import { CONSTANTS } from "@/Constants/constants.ts";

import { useState, useEffect, } from "react";
import MeasureTicks from "./Timeline/MeasureTicks.tsx";
import TimelineContainer from "./Timeline/TimelineContainer.tsx";
import StagingTrack from "./Timeline/StagingTrack.tsx";
import Playhead from "./Timeline/Playhead.tsx";
import MixTrack from "./Timeline/MixTrack.tsx";
import Play from "./Transport/Play.tsx";
import Skipback from "./Transport/Skipback.tsx";
import Metronome from "./Transport/Metronome.tsx";
import Loop from "./Transport/Loop.tsx";
import BPM from "./Transport/BPM.tsx";
import { ButtonGroupSeparator } from "@/Components/ui/button-group.tsx";
import Settings from "./BottomRight/Settings.tsx";
import Latency from "./BottomRight/Latency.tsx";
import CommMessage from "./BottomRight/CommMessage.tsx";

type AudioBoardProps = {
    uiControllerRef:React.RefObject<UIController|null>,
    audioControllerRef:React.RefObject<AudioController|null>,
    webRTCManagerRef?:React.RefObject<PeerJSManager|null>,
}

export default function AudioBoard({uiControllerRef,audioControllerRef}:AudioBoardProps){
    const [width,height] = useWindowSize();

    const [compactMode,setCompactMode] = useState<number>(1);

    const timelinePxLen = Math.max(750,width-CONSTANTS.LEFT_CONTROLS_WIDTH-50);

    useEffect(()=>{
        if(height<700){
            setCompactMode(4/7);
        }else{
            setCompactMode(1);
        }
    },[height])
    

    if(uiControllerRef.current){
        uiControllerRef.current.drawAllCanvases();
    }

    return <div className="">
            <div className="w-full grid place-items-center items-center">
                <div 
                className={`grid bg-gray-700 border-gray-500 border-4 rounded-2xl shadow-gray shadow-md`}
                    style={{
                        gridTemplateRows: `1px ${Math.floor(172*compactMode)}px`,
                        width: `${Math.max(1050,width)}px`, 
                        height: Math.floor(232*compactMode) 
                    }}>
                    <div className={`relative row-start-2 grid pt-3 grid-cols-[20px_250px_0px]`}
                    style={{height:Math.floor(172*compactMode)}}
                    >
                    <TrackList compactMode={compactMode}>
                        <UpperLeftBox compactMode={compactMode}/>
                        <div className="bg-[rgb(114,120,155)]"
                            style={{width:`${CONSTANTS.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(115*compactMode)}}
                        >
                            <StagingTrackHeader audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                            <MixTrackHeader audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        </div>
                    </TrackList>
                    <Timeline timelinePxLen={timelinePxLen} compactMode={compactMode}>
                        <MeasureTicks timelinePxLen={timelinePxLen} compactMode={compactMode} uiControllerRef={uiControllerRef} />
                        <TimelineContainer timelinePxLen={timelinePxLen} compactMode={compactMode} uiControllerRef={uiControllerRef} />
                        <div className="row-start-2 col-start-3">
                            <StagingTrack timelinePxLen={timelinePxLen} compactMode={compactMode} uiControllerRef={uiControllerRef} />
                            <MixTrack timelinePxLen={timelinePxLen} compactMode={compactMode} uiControllerRef={uiControllerRef}/>
                        </div>
                        <Playhead compactMode={compactMode} windowLen={timelinePxLen} UIControllerRef={uiControllerRef} />
                    </Timeline>
                        {/*<Button variant="default" size={compactMode==1?"lg":"sm"} onClick={()=>setSnapToGrid(prev=>!prev)} 
                            className="border-1 border-gray-300 hover:bg-gray-800"
                            style={{position:"absolute",right:15,top:Math.floor(120*compactMode),transform:"scale(.7)"}}>
                            <Magnet color={snapToGrid ? "lightblue" : "white"} style={{transform:"rotate(315deg)"+(compactMode==1?"scale(1.5)":"scale(1)")}}></Magnet>
                            <Columns4 color={snapToGrid ? "lightblue" : "white"} style={{transform:compactMode==1?"scale(1.5)":"scale(1)"}}></Columns4>
                        </Button>*/}
                    </div>
                    <Transport compactMode={compactMode}>
                        <Play audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        <ButtonGroupSeparator/>
                        <Stop audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        <ButtonGroupSeparator/>
                        <Record audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        <ButtonGroupSeparator/>
                        <Skipback audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        <ButtonGroupSeparator/>
                        <Loop audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        <ButtonGroupSeparator/>
                        <Metronome audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        <ButtonGroupSeparator/>
                        <BPM audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        <ZoomSlider uiControllerRef={uiControllerRef} compactMode={compactMode} timelinePxLen={timelinePxLen}/>
                        <Settings compactMode={compactMode}/>
                        <Latency compactMode={compactMode}/>
                        <CommMessage uiControllerRef={uiControllerRef} compactMode={compactMode}/>
                    </Transport>
                </div>
            </div>
        </div>
}
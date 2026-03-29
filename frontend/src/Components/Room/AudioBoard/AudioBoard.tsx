import { useWindowSize } from "../../useWindowSize.tsx"

import { AudioController } from "../../../Core/Audio/AudioController.ts";
import { UIController } from "../../../Core/UI/UIController.ts";
import { PeerJSManager } from "../../../Core/WebRTC/PeerJSManager.ts";

import BounceOrchestrator from "./BounceOrchestrator";
import type { BounceOrchestratorHandle } from "./BounceOrchestrator";
import TrackList from "./TrackList/TrackList";
import UpperLeftBox from "./TrackList/UpperLeftBox";
import StagingTrackHeader from "./TrackList/StagingTrackHeader";
import MixTrackHeader from "./TrackList/MixTrackHeader";
import Timeline from "./Timeline/Timeline";
import Transport from "./BottomControls/Transport/Transport";
import Stop from "./BottomControls/Transport/Stop.tsx";
import Record from "./BottomControls/Transport/Record.tsx";
import ZoomSlider from "./BottomControls/BottomRight/ZoomSlider.tsx";

import { CONSTANTS } from "@/Constants/constants.ts";

import { useEffect, useRef } from "react";
import MeasureTicks from "./Timeline/MeasureTicks.tsx";
import TimelineContainer from "./Timeline/TimelineContainer.tsx";
import StagingTrack from "./Timeline/StagingTrack.tsx";
import MixTrack from "./Timeline/MixTrack.tsx";
import Play from "./BottomControls/Transport/Play.tsx";
import Skipback from "./BottomControls/Transport/Skipback.tsx";
import Metronome from "./BottomControls/Transport/Metronome.tsx";
import Loop from "./BottomControls/Transport/Loop.tsx";
import BPM from "./BottomControls/Transport/BPM.tsx";
import { ButtonGroupSeparator } from "@/Components/ui/button-group.tsx";
import Settings from "./BottomControls/BottomRight/Settings.tsx";
import Latency from "./BottomControls/BottomRight/Latency.tsx";
import CommMessage from "./BottomControls/BottomRight/CommMessage.tsx";
import TouchOverlay from "./Timeline/TouchOverlay.tsx";
import BottomControls from "./BottomControls/BottomControls.tsx";
import SnapToGrid from "./Timeline/SnapToGrid.tsx";

type AudioBoardProps = {
    uiControllerRef:React.RefObject<UIController|null>,
    audioControllerRef:React.RefObject<AudioController|null>,
    compactMode:number,
    webRTCManagerRef?:React.RefObject<PeerJSManager|null>,
}

export default function AudioBoard({uiControllerRef,audioControllerRef,compactMode}:AudioBoardProps){
    const [width,height] = useWindowSize();
    const bounceOrchestratorRef = useRef<BounceOrchestratorHandle | null>(null);

    const timelinePxLen = Math.max(1050-CONSTANTS.LEFT_CONTROLS_WIDTH - 50,width-CONSTANTS.LEFT_CONTROLS_WIDTH - 50);

    useEffect(()=>{
        if(uiControllerRef.current){
            uiControllerRef.current.drawAllCanvases();
        }
    },[height,width])
    

    if(uiControllerRef.current){
        uiControllerRef.current.drawAllCanvases();
    }

    const stagingTrackHeight = Math.floor(58*compactMode);
    const mixTrackHeight = Math.floor(57*compactMode);
    const measureTickHeight = Math.floor(35*compactMode);

    const trackHeights = {
        measureTickHeight,
        stagingHeight: stagingTrackHeight,
        mixHeight: mixTrackHeight,
    }

    return <div className="relative">
            <div className="w-full grid place-items-center items-center">
                <div 
                className={`grid bg-gray-700 border-gray-500 border-4 rounded-2xl shadow-gray shadow-md`}
                    style={{
                        gridTemplateRows: `1px ${Math.floor(172*compactMode)}px`,
                        width: `${Math.max(1050,width)}px`, 
                        height: Math.floor(232*compactMode) 
                    }}>
                    <div className={`relative row-start-2 grid pt-3 `}
                    style={{
                        gridTemplateColumns: `20px ${CONSTANTS.LEFT_CONTROLS_WIDTH}px 0px`,
                        height: Math.floor(172*compactMode)
                    }}
                    >
                    <TrackList compactMode={compactMode}>
                        <UpperLeftBox compactMode={compactMode} audioControllerRef={audioControllerRef} onBounceClick={() => bounceOrchestratorRef.current?.onBounceClick()} onRestageRequest={(i) => bounceOrchestratorRef.current?.onRestageRequest(i)}/>
                        <div className="bg-[rgb(114,120,155)]"
                            style={{width:`${CONSTANTS.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(115*compactMode)}}
                        >
                            <StagingTrackHeader audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                            <MixTrackHeader audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                        </div>
                    </TrackList>
                    <Timeline timelinePxLen={timelinePxLen} compactMode={compactMode}>
                        <TouchOverlay timelinePxLen={timelinePxLen} compactMode={compactMode} trackHeights={trackHeights} uiControllerRef={uiControllerRef}/>
                        <MeasureTicks timelinePxLen={timelinePxLen} compactMode={compactMode} uiControllerRef={uiControllerRef} />
                        <TimelineContainer timelinePxLen={timelinePxLen} compactMode={compactMode} uiControllerRef={uiControllerRef} />
                        <div className="row-start-2 col-start-3">
                            <StagingTrack timelinePxLen={timelinePxLen} trackHeights={trackHeights} uiControllerRef={uiControllerRef} />
                            <MixTrack timelinePxLen={timelinePxLen} trackHeights={trackHeights} uiControllerRef={uiControllerRef}/>
                        </div>
                        {/*<Playhead compactMode={compactMode} windowLen={timelinePxLen} UIControllerRef={uiControllerRef} />*/}
                    </Timeline>
                    <SnapToGrid audioControllerRef={audioControllerRef} compactMode={compactMode}/>
                    </div>
                    <BottomControls compactMode={compactMode}>
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
                            <BPM uiControllerRef={uiControllerRef} compactMode={compactMode}/>
                        </Transport>
                        <ZoomSlider uiControllerRef={uiControllerRef} compactMode={compactMode} timelinePxLen={timelinePxLen}/>
                        <Settings compactMode={compactMode}/>
                        <Latency compactMode={compactMode} audioControllerRef={audioControllerRef}/>
                        <CommMessage uiControllerRef={uiControllerRef} compactMode={compactMode}/>
                    </BottomControls>
                </div>
            </div>
        <BounceOrchestrator ref={bounceOrchestratorRef} audioControllerRef={audioControllerRef} />
        </div>
}
import UpperLeftBox from "./UpperLeftBox";
import StagingControls from "./StagingControls";
import MixControls from "./MixControls";

export default function ControlPanel({audioEngineRef}){

    return <div
                        ref={params.controlPanelRef}
                        className="col-start-2 hello"
                        style={{width:`${params.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(150*params.compactMode)}}
                    >
                    <UpperLeftBox audioEngineRef={audioEngineRef}/>
                    <div className="bg-[rgb(114,120,155)]"
                        style={{width:`${params.LEFT_CONTROLS_WIDTH}`,height:Math.floor(115*params.compactMode)}}
                    >
                        <StagingControls audioEngineRef={audioEngineRef}/>
                        <MixControls audioEngineRef={audioEngineRef}/>
                    </div>
                    </div>
}
import UpperLeftBox from "./UpperLeftBox";
import StagingControls from "./StagingControls";
import MixControls from "./MixControls";

export default function ControlPanel({params}){

    return <div
                        ref={params.controlPanelRef}
                        className="col-start-2 hello"
                        style={{width:`${params.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(150*params.compactMode)}}
                    >
                    <UpperLeftBox params={params}/>
                    <div className="bg-[rgb(114,120,155)]"
                        style={{width:`${params.LEFT_CONTROLS_WIDTH}`,height:Math.floor(115*params.compactMode)}}
                    >
                        <StagingControls params={params}/>
                        <MixControls params={params}/>
                    </div>
                    </div>
}
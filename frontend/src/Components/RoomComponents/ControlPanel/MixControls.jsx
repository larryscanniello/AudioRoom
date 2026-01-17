import { Trash2} from "lucide-react";
import { Slider } from "@/Components/ui/slider"

export default function MixControls({params}){

    const {LEFT_CONTROLS_WIDTH,compactMode,track2Muted,gain2Ref,setTrack2Muted} = params;
    
    return <div style={{width:`${LEFT_CONTROLS_WIDTH}`,height:Math.floor(58*compactMode)}} className="border-b border-black flex flex-row items-center">
    <button
         className="scale-75">
        <Trash2/>
    </button>
    <button className={"border-1 border-black text-xs text-white w-8 h-5 ml-1 pr-1 pl-1 rounded-sm " + (track2Muted ? "bg-amber-600" : "")}
        onClick={(e)=>{
                e.preventDefault();
                if(!track2Muted){
                    gain2Ref.current.gain.value = 0;
                }else{
                    gain2Ref.current.gain.value = track2Vol;
                }
                streamOnPlayProcessorRef.current.port.postMessage({
                    actiontype:"gain2",
                    gain:gain2Ref.current.gain.value,
                })
                setTrack2Muted(prev=>!prev);
            }}
    >
        M
    </button>
    <Slider className="ml-2 mr-2"
    defaultValue={[1.0]} max={1.0} min={0.0} step={.025}
    onValueChange={(value)=>{
            if(!track2Muted){
                gain2Ref.current.gain.value = value;
                streamOnPlayProcessorRef.current.port.postMessage({
                    actiontype:"gain2",
                    gain:value,
                })
            }
            setTrack2Vol(value);
        }} 
    >

    </Slider>
</div>
}


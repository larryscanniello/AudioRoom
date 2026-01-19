import { Trash2, Undo, Redo, KeyboardMusic, ArrowDownToLine, CassetteTape} from "lucide-react";
import { Slider } from "@/Components/ui/slider"


export default function StagingControls({params}){

    const {LEFT_CONTROLS_WIDTH,compactMode,gainRef,track1Muted,setTrack1Muted,
        streamOnPlayProcessorRef,timelineDispatch,fileSystemRef,recorderRef} = params;

    return <div style={{width:`${LEFT_CONTROLS_WIDTH}`,height:Math.floor(58*compactMode)}} className="border-b border-black flex flex-row items-center">
                <button>
                    <Undo className="scale-75"/>
                </button>
                <button>
                    <Redo className="scale-75"/>
                </button>
                <button>
                    <Trash2 className="scale-75"/>
                </button>
                <button>
                    <KeyboardMusic className="scale-75"/>
                </button>
                <button className={"border-1 border-black text-white text-xs w-8 h-5 ml-1 pr-1 pl-1 rounded-sm " + (track1Muted ? "bg-amber-600" : "")}
                    onClick={(e)=>{
                        e.preventDefault();
                        if(!track1Muted){
                            gainRef.current.gain.value = 0;
                        }else{
                            gainRef.current.gain.value = track1Vol;
                        }
                        streamOnPlayProcessorRef.current.port.postMessage({
                                actiontype:"gain1",
                            gain:gainRef.current.gain.value,
                    })
                    setTrack1Muted(prev=>!prev);
                }}
            >
                M
            </button>
            <Slider className="ml-2 mr-2"
                defaultValue={[1.0]} max={1.0} min={0.0} step={.025}
                onValueChange={(value)=>{
                    if(!track1Muted){
                        gainRef.current.gain.value = value;
                        streamOnPlayProcessorRef.current.port.postMessage({
                            actiontype:"gain1",
                            gain:value,
                        })
                    }
                    setTrack1Vol(value);
                }} 
            >
            </Slider>
            <button className="mr-3 relative w-8 h-5"
            onClick={()=>{
                timelineDispatch({type:"bounce_to_mix",fileSystemRef});
                recorderRef.current.processor.port.postMessage({actiontype:"bounce_to_mix"});
            }}
            >
                    <ArrowDownToLine className="absolute scale-75 -top-2.5 -left-1"/>
                    <CassetteTape className="absolute scale-75 top-1.5 -left-1"/>
            </button>       
        </div>
}
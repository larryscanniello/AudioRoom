import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/Components/ui/popover";
import { Button } from "@/Components/ui/button";

export default function Latency({compactMode}: {compactMode:number}){

    const [latencyPopoverOpen, setLatencyPopoverOpen] = useState<boolean>(false);
    const [firstEnteredRoom, _setFirstEnteredRoom] = useState<boolean>(true);
    const [popoverMoreInfo, setPopoverMoreInfo] = useState<boolean>(false);

    return <Popover open={latencyPopoverOpen} onOpenChange={setLatencyPopoverOpen}>
            <PopoverTrigger className={"col-start-5 hover:underline text-blue-200 "+(compactMode!=1?"-translate-y-2":"")}>Latency</PopoverTrigger>
            <PopoverContent className="w-122">
                <div>
                    <div className="flex flex-col items-center justify-center">
                        <div className="text-xl font-bold">{firstEnteredRoom && "Required For Sync: " } Latency Calibration</div>
                    </div>
                    {/*<div className="text-sm">For synchronized web audio, it is essential to do a latency test. Three steps:</div>*/}
                    <div className="text-xs">1. Unplug your headphones. Your mic needs to hear your speakers.</div>
                    <div className="text-xs">2. Set your volume to a normal listening level.</div>
                    <div className="text-xs">3. Press the button below. It will emit a test tone.</div>
                </div>
                <div className="grid place-items-center p-2">
                    <Button 
                        variant="default" size="lg" className="bg-white hover:bg-gray-300 border-1 border-gray-400 text-red-500"
                        onClick={()=>{}}
                        >
                        Start Latency Test
                    </Button>
                </div>
                {/*!!latencyTestRes && <div className="text-green-600">
                    Latency compensation applied. {Math.round(1000 * latencyTestRes/AudioCtxRef.current.sampleRate)} ms</div>*/}
                
                {!firstEnteredRoom && <div className="flex flex-col items-center justify-center"><div className="font-bold">Adjust latency compensation manually:
                    </div>
                    {/*!firstEnteredRoom && <div className="flex flex-row"><Slider style={{width:100}} max={20000} step={delayCompensationStep}
                        onValueChange={(value)=>{
                            if(!currentlyPlayingAudio.current && !currentlyRecording.current){
                                setDelayCompensation(value);
                            }
                            }}
                        onValueCommit={(value)=>{
                            if(!currentlyPlayingAudio.current && !currentlyRecording.current && numConnectedUsersRef.current >= 2){
                            socket.current.emit("send_latency_client_to_server",{
                            roomID,delayCompensation:value})
                            }
                        }}
                        className="pt-2 pb-2"
                        value={delayCompensation}
                        > 
                    </Slider><div className="pl-2">{AudioCtxRef.current && Math.round(1000 * delayCompensation[0]/AudioCtxRef.current.sampleRate)} ms</div>
                    </div>*/}

                
                </div>}
                <div className="flex flex-col items-center justify-center">
                </div>
                <div className="flex flex-col items-center justify-center">
                    <button className="hover:underline text-sm" onClick={()=>setPopoverMoreInfo(prev=>!prev)}>
                        Latency Info
                    </button>
                </div>
                {popoverMoreInfo && <div className="text-xs">
                    <ul className="list-disc">
                    <li>Recording in the browser introduces latency, but this latency is measurable, predictable, and can be mitigated through calibration.</li>
                    <li>
                    Over time, the browser may take slightly longer or shorter to process audio.
                    Press the latency button to recalibrate at any time. Any changes will be immediately reflected on both yours and your 
                    partner's recorders.</li>
                    </ul>
                    <li>
                        If you change your audio configuration (mic, interface, etc.) you may need to recalibrate.
                    </li>
                    <li>
                        Bluetooth headphones are not supported.
                    </li>
                    </div>
                    }
                <div className="flex flex-col items-center justify-center">
                    <button className="text-xl hover:underline" onClick={()=>setLatencyPopoverOpen(false)}>
                        Close
                    </button>
                </div>
            </PopoverContent>
        </Popover>
}
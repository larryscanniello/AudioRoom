/*";
import { useRef,useState,useEffect,useReducer } from "react";
import { useParams } from "react-router-dom";
import Metronome from "../../Classes/Audio/Metronome"
import { useAudioRecorder } from "./useAudioRecorder";
import RecorderInterface from "./Timeline";
import { Button } from "@/Components/ui/button"
import { Play, Square, Circle,SkipBack,Lock,LockOpen,Undo,Redo,
    Columns4,Magnet,Trash2,Repeat2} from "lucide-react"
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/Components/ui/button-group"
import { PiKeyReturnLight, PiMetronomeDuotone } from "react-icons/pi";
import { Slider } from "@/Components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover"
import { FaMagnifyingGlass } from "react-icons/fa6";
import demoacoustic from "/audio/audioboarddemoacoustic.mp3"
import demoelectric from "/audio/audioboarddemoelectric.mp3"
import { useWindowSize } from "../useWindowSize";
import "./AudioBoard.css";
import timelineReducer from "./timelineReducer";
import ControlPanel from "./ControlPanel/ControlPanel";
import WaveformWindow from "./Timeline";
import Timeline from "./Timeline";*/

import { useWindowSize } from "../useWindowSize.tsx"

import { AudioController } from "../../Classes/Audio/AudioController";
import { Mixer } from "../../Classes/Audio/Mixer";
import { MipMap } from "../../Classes/UI/MipMap";
import { KeydownMangager } from "@/Classes/UI/KeydownManager";
import { DAW } from "@/Classes/DAW";

import type { Pointers, Buffers } from "../../Types/AudioState";
import type { MipMapData } from "../../Types/UI";


import { useState,useEffect, useRef } from "react";

const MIX_MAX_TRACKS = 16;


const LEFT_CONTROLS_WIDTH = 250;
const COMM_TIMEOUT_TIME = 5000;
const PACKET_SIZE = 960;
const TIMELINE_LENGTH = 15 * 60; //15 minutes
const START_VIEWPORT_TIMELENGTH = 20;
const TOTAL_TIMELINE_SAMPLES = TIMELINE_LENGTH * 48000;
const MIX_TRACK_COUNT = 16;
const MIX_MIPMAP_BUFFER_SIZE_PER_TRACK = 2**16;
const SAMPLE_RATE = 48000;

    


export default function AudioBoard(webRTCManager?: WebRTCManager, socketManager?: SocketManager

){
    const [width, height] = useWindowSize();
    const WAVEFORM_WINDOW_LEN = Math.max(750,width-LEFT_CONTROLS_WIDTH-50);
    const MIPMAP_HIGHEST_RESOLUTION = 2**Math.ceil(Math.log2(TIMELINE_LENGTH / .2 * WAVEFORM_WINDOW_LEN));
    const MIPMAP_RESOLUTIONS = [MIPMAP_HIGHEST_RESOLUTION];
    let curr = MIPMAP_HIGHEST_RESOLUTION;
    while(curr/2>WAVEFORM_WINDOW_LEN){
        MIPMAP_RESOLUTIONS.push(curr/2);
        curr = MIPMAP_RESOLUTIONS[MIPMAP_RESOLUTIONS.length-1];
    }

    const MIPMAP_HALF_SIZE = MIPMAP_RESOLUTIONS.reduce((acc, curr) => acc + curr, 0);

    const AudioControllerRef = useRef<AudioController|null>(null);
    const UIControllerRef = useRef<UIController|null>(null);
    const [render,setRender] = useState<(number)>(performance.now());

    useEffect(() => {

            const daw = new DAW(socketManager, webRTCManager);
            AudioControllerRef.current = daw.getAudioController();
            UIControllerRef.current = daw.getUIController();

            mixerRef.current = new Mixer(new AudioContext({latencyHint:'interactive'}), 1 + MIX_MAX_TRACKS); //staging track + mix tracks

            const stagingSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12);
            const mixSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT * MIX_MAX_TRACKS + 12);
            const recordSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12); 

    
            const stagingMipMapSAB = new SharedArrayBuffer(2 * MIPMAP_HALF_SIZE + 1);
            const mixMipMapSAB = new SharedArrayBuffer(2 * MIPMAP_HALF_SIZE + 1);
            const mipMapData:MipMapData = {
                MIPMAP_HALF_SIZE, 
                MIPMAP_RESOLUTIONS,
                TIMELINE_LENGTH,
                TOTAL_TIMELINE_SAMPLES
            }

            const mipMap = new MipMap(stagingMipMapSAB,mixMipMapSAB,mipMapData);
    
            fileSystemRef.current = new Worker(new URL("/opfs_worker.ts",import.meta.url),{type:'module'});
            fileSystemRef.current.postMessage({
                type:"init",
                stagingPlaybackSAB:stagingSAB,
                mixPlaybackSAB:mixSAB,
                recordSAB:recordSAB,
                mipMap:{
                    MIPMAP_HALF_SIZE,
                    MIPMAP_RESOLUTIONS,
                    TOTAL_TIMELINE_SAMPLES,
                    staging: stagingMipMapSAB,
                    mix: mixMipMapSAB,
                },
                MIX_MIPMAP_BUFFER_SIZE_PER_TRACK,
                MIX_TRACK_COUNT,
                MIX_BUFFER_SIZE: 48000 * Float32Array.BYTES_PER_ELEMENT * TRACK_COUNT,
            });
    
            opusRef.current = new Worker("/opus_worker.js",{type:'module'});
        
            keyDownManager.current = new KeydownMangager(audioEngineRef.current,/*sessionStateRef.current*/);
    
            socketManagerRef.current = new SocketManager(/*params*/);
    
            setInitializeRecorder(true);
    
    
            return ()=>{
                UIControllerRef.current.terminate();
                /*if(numConnectedUsersRef.current>=2){
                    socket.current.disconnect();
                }x
                AudioCtxRef.current?.close();
                opusRef.current.terminate();
                window.removeEventListener("keydown",handleKeyDown);
                fileSystemRef.current.terminate();
                */ //remember to handle these later
            }
    
            
        },[]);



        /*to handle later
            useEffect(()=>{
            if(!popoverOpen){
                setTimeout(()=>{
                setFirstEnteredRoom(false);
                setDisplayDelayCompensationMessage(false);
                setPopoverMoreInfo(false);
                },400)
            }
        },[popoverOpen])
        */
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
                    <ControlPanel
                        DAWRef={DAWRef}
                    />
    
    
                    <Timeline audio={audio} BPM={BPM} mouseDragEnd={mouseDragEnd} zoomFactor={zoomFactor}
                                    delayCompensation={delayCompensation} measureTickRef={measureTickRef}
                                    mouseDragStart={mouseDragStart}
                                    audioCtxRef={AudioCtxRef} waveform1Ref={waveform1Ref}
                                    playheadRef={playheadRef} setMouseDragStart={setMouseDragStart}
                                    setMouseDragEnd={setMouseDragEnd} socket={socket} roomID={roomID}
                                    scrollWindowRef={scrollWindowRef} playheadLocation={playheadLocation}
                                    setPlayheadLocation={setPlayheadLocation} audioURL={audioURL}
                                    snapToGrid={snapToGrid} currentlyPlayingAudio={currentlyPlayingAudio}
                                    setSnapToGrid={setSnapToGrid} numConnectedUsersRef={numConnectedUsersRef}
                                    waveform2Ref={waveform2Ref} audio2={audio2} delayCompensation2={delayCompensation2}
                                    WAVEFORM_WINDOW_LEN={WAVEFORM_WINDOW_LEN} autoscrollEnabledRef={autoscrollEnabledRef}
                                    setZoomFactor={setZoomFactor} compactMode={compactMode} loadingAudio={loadingAudio}
                                    pxPerSecondRef={pxPerSecondRef} convertTimeToMeasuresRef={convertTimeToMeasuresRef}
                                    fileSystemRef={fileSystemRef} timeSignature={timeSignature}
                                    viewportDataRef={viewportDataRef} timeline={timeline}
                                    mipMapRef={mipMapRef} width={width} height={height}
                        />
                        {/*<Button variant="default" size={compactMode==1?"lg":"sm"} onClick={()=>setSnapToGrid(prev=>!prev)} 
                            className="border-1 border-gray-300 hover:bg-gray-800"
                            style={{position:"absolute",right:15,top:Math.floor(120*compactMode),transform:"scale(.7)"}}>
                            <Magnet color={snapToGrid ? "lightblue" : "white"} style={{transform:"rotate(315deg)"+(compactMode==1?"scale(1.5)":"scale(1)")}}></Magnet>
                            <Columns4 color={snapToGrid ? "lightblue" : "white"} style={{transform:compactMode==1?"scale(1.5)":"scale(1)"}}></Columns4>
                        </Button>*/}
                    </div>
                    
                    <div className="row-start-3 grid grid-cols-[20px_400px_125px_75px_75px_250px]" 
                        style={{height:Math.floor(32*compactMode),transform:`${compactMode!=1?"translateY(3px)":""}`}}>
                        <ButtonGroup className="rounded border-1 border-gray-300 col-start-2"
                            style={{transform:compactMode!=1?"scale(.7) translate(-55px,-10px)":""}}
                        >
                            <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                                onClick={()=>{
                                        DAWRef.current.AudioController.play();
                                        if(numConnectedUsersRef.current>=2){
                                            socket.current.emit("client_to_server_play_audio",{roomID})
                                        }  
                                    }}>
                                <Play color={"lightgreen"} style={{width:20,height:20}}/> 
                            </Button>
                            <ButtonGroupSeparator/>
                            <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                                onClick={()=>handleStop(true,true,false)}>
                                <Square color={"lightblue"} className="" style={{width:20,height:20}}/>
                            </Button>
                            <ButtonGroupSeparator/>
                            <Button 
                                variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                                onClick={handleRecord}
                            >
                                <Circle color={"red"}className="" style={{width:20,height:20}}/>
                            </Button>
                            <ButtonGroupSeparator/>
                            <Button variant="default" size={compactMode==1?"lg":"sm"} className={"hover:bg-gray-800"}
                                onClick={()=>{handleSkipBack();
                                    socket.current.emit("handle_skipback_client_to_server",roomID)
                                }}
                                >
                                <SkipBack style={{width:20,height:20}} color="orange"/>
                            </Button>
                            <ButtonGroupSeparator/>
                            <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                                onClick={()=>{
                                    if(!currentlyPlayingAudio.current && !currentlyRecording.current){
                                        setLooping(prev=>{
                                            if(numConnectedUsersRef.current >= 2){
                                                socket.current.emit("looping_client_to_server",{looping:!prev,roomID});
                                                socket.current.emit("comm_event",
                                                    {type:"looping_changed_by_partner",status:!prev,roomID});
                                            }
                                            return !prev;
                                        })
                                    };
                                }}
                            >
                                <Repeat2 style={{width:20,height:20}} color={looping ? "lightskyblue" : "white"}/>
                            </Button>
                            <ButtonGroupSeparator/>
                            <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                                    onClick={()=>{
                                            setMetronomeOn(prev=>{
                                                metronomeOnRef.current = !prev;
                                                if(metronomeOnRef.current){
                                                    metronomeGainRef.current.gain.value = 1.0;
                                                }else{
                                                    metronomeGainRef.current.gain.value = 0.0;
                                                }
                                                if(numConnectedUsersRef.current >= 2){
                                                    socket.current.emit("comm_event",
                                                        {type:"metronome_changed_by_partner",status:!prev,roomID});
                                                }
                                                return !prev;
                                            })
                                        
                                    }}>
                                <PiMetronomeDuotone style={{width:20,height:20}} 
                                                    color={metronomeOn ? "pink" : ""}
                                                    />
                            </Button>
                            <ButtonGroupSeparator/>
                            <Button className={compactMode==1?"test-lg":"text-sm"} variant="default" size={compactMode==1?"lg":"sm"} onMouseDown={handleTempoMouseDown}>
                                {BPM}
                            </Button>
                        </ButtonGroup>
                        <div className={"flex flex-row items-center col-start-3 " + (compactMode!=1?"-translate-y-2":"")}>
                            <FaMagnifyingGlass style={{transform:"scale(1.1)",marginRight:1}} className="text-blue-200"/>
                            <Slider style={{width:100}}
                            defaultValue={[1000-Math.round(Math.log10(START_VIEWPORT_TIMELENGTH*5)/Math.log10((TIMELINE_LENGTH*5)**(1/1000)))]} max={1000} min={0} step={1} 
                                className="pl-2 group" 
                                value={[1000 - Math.round(Math.log10((zoomFactor)*5)/Math.log10((TIMELINE_LENGTH*5)**(1/1000)))]}
                                onValueChange={handleZoom}
    
                                >
                            </Slider>
                        </div>
                        <Popover>
                            <PopoverTrigger className={"col-start-4 hover:underline text-blue-200 "+(compactMode!=1?"-translate-y-2":"")}>Settings</PopoverTrigger>
                            <PopoverContent>
                                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={autoTestLatency} 
                                        onChange={() => setAutoTestLatency(prev => !prev)} 
                                    />
                                    Auto-test recording latency
                                    </label>
                            </PopoverContent>
                        </Popover>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
                                        onClick={()=>{
                                            if(!currentlyPlayingAudio.current && !currentlyRecording.current){
                                                startDelayCompensationRecording(metronomeRef);
                                                setTimeout(()=>setDisplayDelayCompensationMessage(true),1000)
                                            }
                                        }}
                                        >
                                        Start Latency Test
                                    </Button>
                                </div>
                                {!!latencyTestRes && <div className="text-green-600">
                                    Latency compensation applied. {AudioCtxRef.current && Math.round(1000 * latencyTestRes/AudioCtxRef.current.sampleRate)} ms</div>}
                                
                                {!firstEnteredRoom && <div className="flex flex-col items-center justify-center"><div className="font-bold">Adjust latency compensation manually:
                                    </div>
                                    {!firstEnteredRoom && <div className="flex flex-row"><Slider style={{width:100}} max={20000} step={delayCompensationStep}
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
                                    </div>}
    
                                
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
                                    <button className="text-xl hover:underline" onClick={()=>setPopoverOpen(false)}>
                                        Close
                                    </button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        {commMessage.text && <div className={"flex flex-col items-center justify-center " + (compactMode<1?"-translate-y-1.5":"")}>
                                <div className={"col-start-5 text-white fade-in-element text-sm"} key={commMessage.time}>
                                    {commMessage.text}
                                </div>
                        </div>}
                    </div>
                </div>
            </div>
            </div>
}
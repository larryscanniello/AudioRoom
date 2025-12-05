import { useRef,useState,useEffect } from "react";
import { useParams } from "react-router-dom";
import Metronome from "../../Classes/Metronome"
import { useAudioRecorder } from "./useAudioRecorder";
import RecorderInterface from "./RecorderInterface";
import { Button } from "@/Components/ui/button"
import { Play, Square, Circle,SkipBack,Lock,LockOpen,
    Columns4,Magnet} from "lucide-react"
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/Components/ui/button-group"
import { PiMetronomeDuotone } from "react-icons/pi";
import { Slider } from "@/Components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover"
import { FaMagnifyingGlass } from "react-icons/fa6";
import demoacoustic from "/audio/audioboarddemoacoustic.mp3"
import demoelectric from "/audio/audioboarddemoelectric.mp3"

const WAVEFORM_WINDOW_LEN = 900;

export default function AudioBoard({isDemo,socket}){

    const [audioURL,setAudioURL] = useState(null);
    const [audio,setAudio] = useState(null);
    const [audio2,setAudio2] = useState(null);
    const [BPM,setBPM] = useState(isDemo ? 112 : 120);
    const [mouseDragStart,setMouseDragStart] = useState(isDemo ? {trounded:2.142857142857143,t:2.142857142857143} : {trounded:0,t:0}); //time in seconds
    const [mouseDragEnd,setMouseDragEnd] = useState(isDemo ? {trounded:10.714285714285714,t:10.714285714285714}: null); //time in seconds
    const [roomResponse,setRoomResponse] = useState(null);
    const [audioChunks,setAudioChunks] = useState([]);
    const [zoomFactor,setZoomFactor] = useState(2);
    const [delayCompensation,setDelayCompensation] = useState([0]); //delayCompensation is in samples
    const [delayCompensation2,setDelayCompensation2] = useState([0]);
    const [currentlyAdjustingLatency,setCurrentlyAdjustingLatency] = useState(null);
    const [displayDelayCompensationMessage,setDisplayDelayCompensationMessage] = useState(false);
    const [metronomeOn,setMetronomeOn] = useState(true);
    const [playheadLocation,setPlayheadLocation] = useState(isDemo ? 2.142857142857143 : 0);
    const [snapToGrid,setSnapToGrid] = useState(true);
    const [track1Vol,setTrack1Vol] = useState(1.0);
    const [track2Vol,setTrack2Vol] = useState(1.0);
    const [track1Muted,setTrack1Muted] = useState(false);
    const [track2Muted,setTrack2Muted] = useState(false);

    const waveform1Ref = useRef(null);
    const waveform2Ref = useRef(null);
    const playheadRef = useRef(null);
    const delayCompensationSourceRef = useRef(null);
    const measureTickRef = useRef(null);
    const scrollWindowRef = useRef(null);
    const controlPanelRef = useRef(null);
    const autoscrollEnabledRef = useRef(false);

    const handlePlayAudioRef = useRef(null);
    const currentlyPlayingAudio = useRef(false); //this ref stores a bool depending on whether audio is playing
    const currentlyRecording = useRef(false);
    const playingAudioRef = useRef(null); //this ref stores an audio context source 
    const playingAudioRef2 = useRef(null);
    const gainRef = useRef(null);
    const gain2Ref = useRef(null);
    const BPMRef = useRef(BPM);
    const recordAnimationRef = useRef(null);
    const recorderRef = useRef(null);
    const metronomeOnRef = useRef(true);
    const metronomeGainRef = useRef(true);

    const metronomeRef = useRef(null);
    const AudioCtxRef = useRef(null);

    const { roomID } = useParams();

    const {startRecording,
            stopRecording,
            startDelayCompensationRecording,
            isRecorderReady} = useAudioRecorder({AudioCtxRef,metronomeRef,socket,roomID,
                                            setAudio,setAudioURL,setAudioChunks,
                                            setMouseDragStart,BPMRef,
                                            setMouseDragEnd,playheadRef,setDelayCompensation,
                                            metronomeOn,waveform1Ref,waveform2Ref,BPM,scrollWindowRef,
                                            currentlyRecording,setPlayheadLocation,isDemo,delayCompensation,
                                            recorderRef,recordAnimationRef,metronomeOnRef,gain2Ref,
                                            metronomeGainRef,WAVEFORM_WINDOW_LEN,autoscrollEnabledRef})
    

    useEffect(() => {
        //This effect runs only when component first mounts. 
        //Inititializes audio context, metronome, demo stuff, sockets
        AudioCtxRef.current = new AudioContext({latencyHint:'interactive'});
        metronomeRef.current = new Metronome;
        metronomeRef.current.audioContext = AudioCtxRef.current;
        const analyser = AudioCtxRef.current.createAnalyser();
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        gainRef.current = AudioCtxRef.current.createGain();
        gain2Ref.current = AudioCtxRef.current.createGain();
        metronomeGainRef.current = AudioCtxRef.current.createGain();
        gainRef.current.connect(AudioCtxRef.current.destination);
        gain2Ref.current.connect(AudioCtxRef.current.destination);
        metronomeGainRef.current.connect(AudioCtxRef.current.destination);
        metronomeRef.current.gainRef = metronomeGainRef;
        const getDemo = async ()=>{
            const acousticresponse = await fetch(demoacoustic)
            const electricresponse = await fetch(demoelectric)
            const arrayBufferAcoustic = await acousticresponse.arrayBuffer();
            const arrayBufferElectric = await electricresponse.arrayBuffer();
            const decoded1 = await AudioCtxRef.current.decodeAudioData(arrayBufferAcoustic)
            const decoded2 = await AudioCtxRef.current.decodeAudioData(arrayBufferElectric)
            setAudio(decoded2);
            setAudio2(decoded1);
        }
        if(isDemo){
            getDemo()
        }
        
        

        const processAudio = async (newchunks) => {
            const recordedBuffers = newchunks;
            const length = recordedBuffers.reduce((sum,arr) => sum+arr.length,0)
            const fullBuffer = new Float32Array(length);
            let offset = 0;
            for(const arr of recordedBuffers){
                fullBuffer.set(arr,offset)
                offset += arr.length;
            }
            

            const audioBuffer = AudioCtxRef.current.createBuffer(1,fullBuffer.length,AudioCtxRef.current.sampleRate);
            audioBuffer.copyToChannel(fullBuffer,0);

            setAudioChunks(recordedBuffers);
            setMouseDragStart({trounded:0,t:0});
            setMouseDragEnd(null);
            setPlayheadLocation(0);
            setAudio2(audioBuffer);
        }


        const handleKeyDown = (e) => {
            e.preventDefault();
            if(e.key==="Enter"){
                setMouseDragStart({trounded:0,t:0});
                setMouseDragEnd(null);
                setPlayheadLocation(0);
                scrollWindowRef.current.scrollLeft = 0;
                if(!isDemo){
                    socket.current.emit("send_play_window_to_server",{
                        mouseDragStart:{trounded:0,t:0},mouseDragEnd:null,snapToGrid,roomID
                    })
                }
            }
            if(e.key===" "){
                if(currentlyRecording.current||currentlyPlayingAudio.current){
                    handleStop(true);
                }else{
                    handlePlayAudioRef.current()
                    if(!isDemo){
                        socket.current.emit("client_to_server_play_audio",{roomID})
                    }
                }
            }
        }

        window.addEventListener("keydown",handleKeyDown)
        
        if(!isDemo){
            socket.current.on("receive_audio_server_to_client", async (data) => {
                if(data.i==0){
                    setAudioChunks(()=>{
                        if(data.length===1){
                            currentlyRecording.current = false;
                            processAudio([data.audio])
                            setMouseDragStart({trounded:0,t:0});
                            setMouseDragEnd(null);
                            setPlayheadLocation(0);
                        }
                        return [data.audio]
                    })
                }else {
                    setAudioChunks(prev => {
                        if(data.i!=prev.length){
                            return prev
                        }

                        const newchunks = [...prev, data.audio]
                        
                        if(data.length==newchunks.length){
                            currentlyRecording.current = false;
                            processAudio(newchunks);
                            setMouseDragStart({trounded:0,t:0});
                            setMouseDragEnd(null);
                            setPlayheadLocation(0);
                        }
                        return newchunks
                    });
                }
                setDelayCompensation2(data.delayCompensation)
            });
            
            socket.current.on("send_play_window_to_clients", (data)=>{
                setMouseDragStart(data.mouseDragStart);
                setMouseDragEnd(data.mouseDragEnd);
                let start;
                if(data.snapToGrid){
                    start = data.mouseDragStart.trounded
                }else{
                    start = data.mouseDragStart.t
                }
                //start = data.mouseDragEnd ? data.mouseDragStart.trounded : data.mouseDragStart ? data.mouseDragStart.t : 0;
                setPlayheadLocation(start)
            })

            socket.current.on("server_to_client_play_audio",(data)=>{
                handlePlayAudioRef.current();
            })

            socket.current.on("handle_skipback_server_to_client",()=>{
                setMouseDragEnd(null);
                setMouseDragStart({trounded:0,t:0});
                scrollWindowRef.current.scrollLeft = 0;
                setPlayheadLocation(0);
            })
            
            socket.current.on("request_audio_server_to_client", (data) => {
                setAudioChunks(currentChunks => {
                    if(currentChunks && currentChunks.length > 0){
                        for(let i = 0; i < currentChunks.length; i++){
                            socket.current.emit("send_audio_client_to_server", {
                                audio: currentChunks[i],roomID,
                                i,user: data.user,
                                length: currentChunks.length,
                                delayCompensation,
                            });
                        }
                    }
                    return currentChunks;
                });
            })
            
            socket.current.on("send_bpm_server_to_client",bpm=>{
                setBPM(bpm);
                BPMRef.current = bpm;
            });

            socket.current.on("stop_audio_server_to_client",()=>{
                handleStop(false);
            });

            socket.current.on("send_latency_server_to_client",(delayComp)=>{
                setDelayCompensation2(delayComp);
            });

            socket.current.on("start_recording_server_to_client",()=>{
                currentlyRecording.current = true;
                recordAnimationRef.current(waveform2Ref,AudioCtxRef.current.currentTime);
            });
        }

        


        return ()=>{
            if(!isDemo){
                socket.current.disconnect();
            }
            AudioCtxRef.current?.close();
            window.removeEventListener("keydown",handleKeyDown)
        }

        
    }, []);


    useEffect(() => {
        handlePlayAudioRef.current = handlePlayAudio;

    });


    if(metronomeRef.current){
        metronomeRef.current.tempo = BPM;
    }

    const handlePlayAudio = () => {
        //This function handles the dirty work of playing audio correctly no matter where the playhead is
        if(!audio&&!audio2) return;
        autoscrollEnabledRef.current = true;
        if (playingAudioRef.current) {
            playingAudioRef.current.disconnect();
            playingAudioRef.current = null;
        }
        if (playingAudioRef2.current) {
            playingAudioRef2.current.disconnect();
            playingAudioRef2.current = null;
        }
        const source = AudioCtxRef.current.createBufferSource();
        const source2 = AudioCtxRef.current.createBufferSource();
        source.connect(gainRef.current);
        source2.connect(gain2Ref.current);
        
        const stereoBuffer = AudioCtxRef.current.createBuffer(2, audio ? audio.length:1, AudioCtxRef.current.sampleRate);
        if(audio){
            stereoBuffer.getChannelData(0).set(audio.getChannelData(0));
            stereoBuffer.getChannelData(1).set(audio.getChannelData(0));
        }
        source.buffer = stereoBuffer;
        const stereoBuffer2 = AudioCtxRef.current.createBuffer(2, audio2?audio2.length:1, AudioCtxRef.current.sampleRate);
        if(audio2){
            stereoBuffer2.getChannelData(0).set(audio2.getChannelData(0));
            stereoBuffer2.getChannelData(1).set(audio2.getChannelData(0));
        }
        source2.buffer = stereoBuffer2
        //currentPlayingAudio is set to 2 when audio is playing; when one source ends it -= 1
        source.onended = () => {
            currentlyPlayingAudio.current -= 1;
            source.disconnect();
        }
        source2.onended = () => {
            currentlyPlayingAudio.current -= 1;
            source2.disconnect();
        }
        const rect = waveform1Ref.current.getBoundingClientRect();
        //Pixels per second calculates the rate at which the playhead must move. Depends on BPM
        //Divides full width of canvas by the total time in seconds 128 beats takes
        const pixelsPerSecond = rect.width/((60/BPM)*128)
        //totalTime is is length of time if audio the length of entire canvas is played
        const totalTime = (128*60/BPM)
        const duration = Math.max(source.buffer.length,source2.buffer.length)/AudioCtxRef.current.sampleRate;
        //startTime, endTime are relative to the audio, not absolute times, in seconds
        let startTime = 0;
        let endTime = Math.min(duration,totalTime);
        let timeToNextMeasure = 0; //seconds
        if(mouseDragStart&&(!mouseDragEnd||!snapToGrid)){
            //This if handles startTime if no region is selected and there is no snap to grid
            //startTime is totalTime times (pixels so far)/(total pixels in canvas)
            startTime = totalTime * mouseDragStart.t*pixelsPerSecond/waveform1Ref.current.width;
            //find the next beat so metronome is aligned
            const nextBeat = 128*mouseDragStart.t*pixelsPerSecond/waveform1Ref.current.width
            metronomeRef.current.currentBeatInBar = Math.ceil(nextBeat)%4
            const beatFractionToNextMeasure = Math.ceil(nextBeat)-nextBeat
            const secondsPerBeat = (60/BPM)
            timeToNextMeasure = beatFractionToNextMeasure * secondsPerBeat
        }else if(mouseDragStart&&mouseDragEnd&&snapToGrid){
            //startTime is totalTime times (pixels so far)/(total pixels in canvas)
            startTime = totalTime * mouseDragStart.trounded*pixelsPerSecond/ waveform1Ref.current.width;
            const currBeat = 128*mouseDragStart.trounded*pixelsPerSecond/waveform1Ref.current.width
            //this assumes that we are snapping to grid, so we use floor instead of ceil here
            //so that the first beat of selected region plays
            metronomeRef.current.currentBeatInBar = Math.floor(currBeat)%4
        }
        if(mouseDragEnd&&!snapToGrid){
            endTime = totalTime * Math.min(1,mouseDragEnd.t*pixelsPerSecond/ waveform1Ref.current.width);
        }else if(mouseDragEnd&&snapToGrid){
            endTime = totalTime * Math.min(1,mouseDragEnd.trounded*pixelsPerSecond/ waveform1Ref.current.width);
        }

        //updatePlayhead uses requestAnimationFrame to animate the playhead
        //note we need the start parameter to keep track of where in the audio we are starting
        //as opposed to now which is the current time absolutely
        const updatePlayhead = (start) => {
            const elapsed = Math.max(AudioCtxRef.current.currentTime - now,0);
            setPlayheadLocation(start+elapsed);
            const x = (start+elapsed) * pixelsPerSecond;
            //auto scroll right if playhead moves far right enough
            const visibleStart = scrollWindowRef.current.scrollLeft
            const visibleEnd = visibleStart + WAVEFORM_WINDOW_LEN
            if((x-visibleStart)/(visibleEnd-visibleStart)>(10/11)&&autoscrollEnabledRef.current){
                scrollWindowRef.current.scrollLeft = 750 + visibleStart;
            }
            
            if(start+elapsed<endTime&&(currentlyPlayingAudio.current)){
                requestAnimationFrame(()=>{updatePlayhead(start)});
            }else if(!mouseDragEnd){
                //if no region has been dragged, and end is reached, reset playhead to the beginning
                metronomeRef.current.stop();
                setMouseDragStart({trounded:x/pixelsPerSecond,t:x/pixelsPerSecond})
                setMouseDragEnd(null)
                setPlayheadLocation(x/pixelsPerSecond);
            }else{
                //if a region has been dragged, reset playhead to 
                metronomeRef.current.stop();
                setPlayheadLocation(start)
            }
            
        }
        const secondsToDelay = delayCompensation/AudioCtxRef.current.sampleRate; //convert delayComp in samples to seconds
        const secondsToDelay2 = delayCompensation2/AudioCtxRef.current.sampleRate;
        const audiolength = Math.max(audio ? audio.getChannelData(0) : 0,audio2 ? audio2.getChannelData(0) : 0);
        if(startTime+secondsToDelay>=audiolength/AudioCtxRef.current.sampleRate){
            //if someone tries to play audio after the end of the audio, play audio from the beginning
            startTime = 0;
            endTime = duration;
            timeToNextMeasure = 0;
            setMouseDragStart({trounded:0,t:0})
            setMouseDragEnd(null)
            start = 0;
        }
        //add .05 to match the delay of audio/metronome (metronome needs delay for first beat to sound)
        let now = AudioCtxRef.current.currentTime+.05;
        //the .05 added to now previously was for playhead rendering purposes, we need to subtract it here
        metronomeRef.current.start(now-.05+timeToNextMeasure);
        //source.start arguments are (time to wait to play audio,location in audio to start,duration to play)
        source.start(now,startTime+secondsToDelay,endTime-startTime);
        source2.start(now,startTime+secondsToDelay2,endTime-startTime);
        playingAudioRef.current = source;
        playingAudioRef2.current = source2;
        currentlyPlayingAudio.current = 2;
        updatePlayhead(startTime)
    }

    const handleTempoMouseDown = (e) => {
        //handles the BPM adjuster
        if(currentlyPlayingAudio.current||currentlyRecording.current){
            return
        }
        e.preventDefault();
        const startY = e.clientY;
        const startBPM = BPM;

        const handleMouseMove = (e) => {
            const deltaY = (startY - e.clientY)/2;
            setBPM(prev=>{
                const newbpm = startBPM + Math.floor(deltaY)
                if(30<=newbpm&&newbpm<=400){
                    BPMRef.current = newbpm
                    return newbpm
                }else{
                    return prev
                }
            });
        };

        const handleMouseUp = () => {
            if(BPMRef.current&&!isDemo){
                socket.current.emit("receive_bpm_client_to_server",{roomID,BPM:BPMRef.current})
            }
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const handleSkipBack = () => {
        if(!currentlyPlayingAudio.current&&!currentlyRecording.current){
            setMouseDragEnd(null);
            setMouseDragStart({trounded:0,t:0});
            scrollWindowRef.current.scrollLeft = 0;
            setPlayheadLocation(0);
            socket.current.emit("handle_skipback_client_to_server",roomID)
        }
    }

    const handleStop = (sendSocket) => {
        if(playingAudioRef.current){
            playingAudioRef.current.stop();
        }
        if(playingAudioRef2.current){
            playingAudioRef2.current.stop();
        }
        currentlyRecording.current = false;
        recorderRef.current.stopRecording();
        metronomeRef.current.stop();
        if(!isDemo && sendSocket){
            socket.current.emit("stop_audio_client_to_server",roomID)
        }
    }

    let delayCompensationStep;
    if(AudioCtxRef.current){
        delayCompensationStep = Math.floor(AudioCtxRef.current.sampleRate * .01);
    }else{
        delayCompensationStep = 410;
    }
    

    return <div className="">
        <div className="w-full grid place-items-center items-center">
            <div className="grid grid-rows-[1px_172px] h-58 bg-gray-700 border-gray-500 border-4 rounded-2xl shadow-gray shadow-md"
                style={{width:1050}}>
                <div className="relative row-start-2 grid h-43 pt-3 grid-cols-[20px_100px_0px] ">
                    <div
                        ref={controlPanelRef}
                        className="col-start-2"
                        style={{width:100,height:150}}
                    >
                    <div className="bg-[rgb(86,86,133)]"
                            style={{width:100,height:35}}
                    >
                    </div>
                    <div className="bg-[rgb(114,120,155)]"
                        style={{width:100,height:115}}
                    >
                        <div style={{width:100,height:58}} className="border-b border-black flex flex-row items-center">
                            <button className={"border-1 border-black text-white text-xs w-8 h-6 ml-1 rounded-sm " + (track1Muted ? "bg-amber-600" : "")}
                                onClick={(e)=>{
                                    e.preventDefault();
                                    if(!track1Muted){
                                        gainRef.current.gain.value = 0;
                                    }else{
                                        gainRef.current.gain.value = track1Vol;
                                    }
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
                                    }
                                    setTrack1Vol(value);
                                }} 
                            >

                            </Slider>
                        </div>
                        <div style={{width:100,height:58}} className="border-b border-black flex flex-row items-center">
                            <button className={"border-1 border-black text-xs text-white w-8 h-6 ml-1 rounded-sm " + (track2Muted ? "bg-amber-600" : "")}
                                onClick={(e)=>{
                                        e.preventDefault();
                                        if(!track2Muted){
                                            gain2Ref.current.gain.value = 0;
                                        }else{
                                            gain2Ref.current.gain.value = track2Vol;
                                        }
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
                                    }
                                    setTrack2Vol(value);
                                }} 
                            >

                            </Slider>
                        </div>

                    </div>
                    </div>
                    <RecorderInterface audio={audio} BPM={BPM} mouseDragEnd={mouseDragEnd} zoomFactor={zoomFactor}
                                delayCompensation={delayCompensation} measureTickRef={measureTickRef}
                                mouseDragStart={mouseDragStart}
                                audioCtxRef={AudioCtxRef} waveform1Ref={waveform1Ref}
                                playheadRef={playheadRef} setMouseDragStart={setMouseDragStart}
                                setMouseDragEnd={setMouseDragEnd} socket={socket} roomID={roomID}
                                scrollWindowRef={scrollWindowRef} playheadLocation={playheadLocation}
                                setPlayheadLocation={setPlayheadLocation} audioURL={audioURL}
                                snapToGrid={snapToGrid} currentlyPlayingAudio={currentlyPlayingAudio}
                                setSnapToGrid={setSnapToGrid} isDemo={isDemo} waveform2Ref={waveform2Ref}
                                audio2={audio2} delayCompensation2={delayCompensation2}
                                WAVEFORM_WINDOW_LEN={WAVEFORM_WINDOW_LEN} autoscrollEnabledRef={autoscrollEnabledRef}
                    />
                    <Button variant="default" size="lg" onClick={()=>setSnapToGrid(prev=>!prev)} 
                        className="border-1 border-gray-300 hover:bg-gray-800"
                        style={{position:"absolute",right:15,top:120,transform:"scale(.7)"}}>
                        <Magnet color={snapToGrid ? "lightblue" : "white"} style={{transform:"rotate(315deg) scale(1.5)"}}></Magnet>
                        <Columns4 color={snapToGrid ? "lightblue" : "white"} style={{transform:"scale(1.5)"}}></Columns4>
                    </Button>
                </div>
                
                <div className="row-start-3 h-8 grid grid-cols-[20px_375px_125px_125px_125px_125px]" >
                    <ButtonGroup className="rounded border-1 border-gray-300 col-start-2">
                        <Button variant="default" size="lg" className="hover:bg-gray-800"
                            onClick={()=>{
                                if(!currentlyPlayingAudio.current&&!currentlyRecording.current){
                                    handlePlayAudio();
                                    if(!isDemo){
                                        socket.current.emit("client_to_server_play_audio",{roomID})
                                    }
                                }    
                                }}>
                            <Play color={"lightgreen"} style={{width:20,height:20}}/> 
                        </Button>
                        <ButtonGroupSeparator/>
                        <Button variant="default" size="lg" className="hover:bg-gray-800"
                            onClick={()=>handleStop(true)}>
                            <Square color={"lightblue"} className="" style={{width:20,height:20}}/>
                        </Button>
                        <ButtonGroupSeparator/>
                        <Button 
                            variant="default" size="lg" className="hover:bg-gray-800"
                            onClick={()=>{
                                if(!currentlyPlayingAudio.current&&!currentlyRecording.current){
                                    recorderRef.current.startRecording(audio2,delayCompensation2);
                                    if(!isDemo){
                                        socket.current.emit("start_recording_client_to_server",roomID);
                                    }
                                }
                            }}
                        >
                            <Circle color={"red"}className="" style={{width:20,height:20}}/>
                        </Button>
                        <ButtonGroupSeparator/>
                        <Button variant="default" size="lg" className="hover:bg-gray-800"
                            onClick={()=>{handleSkipBack();
                                socket.current.emit("handle_skipback_client_to_server",roomID)
                            }}
                            >
                            <SkipBack style={{width:20,height:20}} color="orange"/>
                        </Button>
                        <ButtonGroupSeparator/>
                        <Button variant="default" size="lg" className="hover:bg-gray-800"
                                onClick={()=>{
                                        setMetronomeOn(prev=>{
                                            metronomeOnRef.current = !prev;
                                            if(metronomeOnRef.current){
                                                metronomeGainRef.current.gain.value = 1.0;
                                            }else{
                                                metronomeGainRef.current.gain.value = 0.0;
                                            }
                                            return !prev;
                                        })
                                    
                                }}>
                            <PiMetronomeDuotone style={{width:20,height:20}} 
                                                color={metronomeOn ? "pink" : ""}
                                                />
                        </Button>
                        <ButtonGroupSeparator/>
                        <Button variant="default" size="lg" onMouseDown={handleTempoMouseDown}>
                            {BPM}
                        </Button>
                    </ButtonGroup>
                    <div className="flex flex-row items-center col-start-3">
                        <FaMagnifyingGlass style={{transform:"scale(1.1)",marginRight:3}} className="text-blue-200"/>
                        <Slider style={{width:100}}
                        defaultValue={[20000/32]} max={1000} min={0} step={1} 
                            className="pl-2 group" value={[Math.log10(zoomFactor)/Math.log10(10**(Math.log10(16)/1000))]} onValueChange={(value)=>{
                                setZoomFactor(prev => {
                                    /*if(currentlyPlayingAudio.current||currentlyRecording.current){
                                        return prev
                                    }*/
                                    const b = 10**(Math.log10(16)/1000)
                                    const newZoomFactor = b**value
                                    return newZoomFactor
                                })

                            }}>
                        </Slider>
                    </div>
                    <Popover>
                        <PopoverTrigger className="col-start-4 hover:underline text-blue-200">Latency</PopoverTrigger>
                        <PopoverContent onCloseAutoFocus={()=>setDisplayDelayCompensationMessage(false)}>
                            <div>Place your microphone near your speakers,
                                turn your volume up,
                            then hit the record button.</div>  
                            <div className="grid place-items-center p-4">
                                <Button 
                                    variant="default" size="lg" className="bg-white hover:bg-gray-300 border-1 border-gray-400"
                                    onClick={()=>{
                                        startDelayCompensationRecording(metronomeRef);
                                        setTimeout(()=>setDisplayDelayCompensationMessage(true),1000)
                                    }}
                                    >
                                    <Circle color={"red"}className="" style={{width:20,height:20}}/>
                                </Button>
                            </div>
                            {displayDelayCompensationMessage && <div className="text-green-600">
                                Latency compensatation attempted successfully.</div>}
                            <div className="pt-4">Alternatively, adjust it manually:
                                <Slider style={{width:100}} max={20000} step={delayCompensationStep}
                                    onValueChange={(value)=>setDelayCompensation(value)}
                                    onValueCommit={(value)=>socket.current.emit("send_latency_client_to_server",{
                                        roomID,delayCompensation:value
                                    })}
                                    className="p-4"
                                    value={delayCompensation}
                                    > 
                                </Slider>
                            </div>

                        </PopoverContent>
                    </Popover>
                    {/*<a download href={audioURL} className={"flex items-center col-start-5 " + (audio ? "hover:underline" : "opacity-25")}>
                    Download
                    </a>*/}
                    
                </div>
            </div>
        </div>
        </div>
}
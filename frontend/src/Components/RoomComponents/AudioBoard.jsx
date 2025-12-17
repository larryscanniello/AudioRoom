import { useRef,useState,useEffect } from "react";
import { useParams } from "react-router-dom";
import Metronome from "../../Classes/Metronome"
import { useAudioRecorder } from "./useAudioRecorder";
import RecorderInterface from "./RecorderInterface";
import { Button } from "@/Components/ui/button"
import { Play, Square, Circle,SkipBack,Lock,LockOpen,
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

const WAVEFORM_WINDOW_LEN = 900;
const COMM_TIMEOUT_TIME = 5000;

export default function AudioBoard({isDemo,socket,firstEnteredRoom,setFirstEnteredRoom}){

    const [width,height] = useWindowSize();

    const [audioURL,setAudioURL] = useState(null);
    const [audio,setAudio] = useState(null);
    const [audio2,setAudio2] = useState(null);
    const [BPM,setBPM] = useState(isDemo ? 112 : 120);
    const [mouseDragStart,setMouseDragStart] = useState(isDemo ? {trounded:2.142857142857143,t:2.142857142857143} : {trounded:0,t:0}); //time in seconds
    const [mouseDragEnd,setMouseDragEnd] = useState(isDemo ? {trounded:10.714285714285714,t:10.714285714285714}: null); //time in seconds
    const [roomResponse,setRoomResponse] = useState(null);
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
    const [compactMode,setCompactMode] = useState(height < 700 ? (4/7) : 1);
    const [loadingAudio,setLoadingAudio] = useState(null);
    const [looping,setLooping] = useState(true);
    const [commMessage,setCommMessage] = useState("");
    const [popoverOpen,setPopoverOpen] = useState(isDemo ? false : true);
    const [popoverMoreInfo,setPopoverMoreInfo] = useState(false);
    const [latencyTestRes,setLatencyTestRes] = useState(null);
    const [monitoringOn,setMonitoringOn] = useState(false);
    const [otherPersonMonitoringOn,setOtherPersonMonitoringOn] = useState(false);

    const waveform1Ref = useRef(null);
    const waveform2Ref = useRef(null);
    const playheadRef = useRef(null);
    const delayCompensationSourceRef = useRef(null);
    const measureTickRef = useRef(null);
    const scrollWindowRef = useRef(null);
    const controlPanelRef = useRef(null);
    const autoscrollEnabledRef = useRef(false);

    const pxPerSecondRef = useRef(null);
    const convertTimeToMeasuresRef = useRef(null);

    const otherPersonRecordingRef = useRef(false);
    const numConnectedUsersRef = useRef(0);

    const handlePlayAudioRef = useRef(null);
    const handleStreamAudioRef = useRef(null);
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
    const keepRecordingRef = useRef(true);
    const loopingRef = useRef(looping);
    const commsClearTimeoutRef = useRef(null);
    const streamingTimeRef = useRef(null);

    const audioChunksRef = useRef([]);

    const metronomeRef = useRef(null);
    const AudioCtxRef = useRef(null);

    useEffect(()=>{
        if(height<700){
            setCompactMode(4/7);
        }else{
            setCompactMode(1);
        }
    },[height])    

    const { roomID } = useParams();

    const {startRecording,
            stopRecording,
            startDelayCompensationRecording,
            isRecorderReady} = useAudioRecorder({AudioCtxRef,metronomeRef,socket,roomID,
                                            setAudio,setAudioURL,audioChunksRef,
                                            setMouseDragStart,BPMRef,
                                            setMouseDragEnd,playheadRef,setDelayCompensation,
                                            metronomeOn,waveform1Ref,waveform2Ref,BPM,scrollWindowRef,
                                            currentlyRecording,setPlayheadLocation,numConnectedUsersRef,delayCompensation,
                                            recorderRef,recordAnimationRef,metronomeOnRef,gain2Ref,
                                            metronomeGainRef,WAVEFORM_WINDOW_LEN,autoscrollEnabledRef,
                                            otherPersonRecordingRef,setLoadingAudio,setAudio2,setLatencyTestRes})

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

            audioChunksRef.current = recordedBuffers;
            setMouseDragStart({trounded:0,t:0});
            setMouseDragEnd(null);
            setPlayheadLocation(0);
            setAudio2(audioBuffer);
            //setLoadingAudio(null);
            socket.current.emit("client_to_server_incoming_audio_done_processing",roomID);
        }

        


        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            if(e.key==="Enter"){
                setMouseDragStart({trounded:0,t:0});
                setMouseDragEnd(null);
                setPlayheadLocation(0);
                scrollWindowRef.current.scrollLeft = 0;
                if(numConnectedUsersRef.current>=2){
                    socket.current.emit("send_play_window_to_server",{
                        mouseDragStart:{trounded:0,t:0},mouseDragEnd:null,snapToGrid,roomID
                    })
                }
            }
            if(e.key===" "){
                if(currentlyRecording.current||currentlyPlayingAudio.current){
                    handleStop(true,true,false);
                }else{
                    handlePlayAudioRef.current(false)
                    if(numConnectedUsersRef.current>=2){
                        socket.current.emit("client_to_server_play_audio",{roomID})
                    }
                }
            }
            if(e.key==="r"){
                if(currentlyRecording.current || currentlyPlayingAudio.current) return;
                recorderRef.current.startRecording(audio2,delayCompensation2);
                if(numConnectedUsersRef.current >= 2){
                    socket.current.emit("start_recording_client_to_server",roomID);
                }
            }
        }

        window.addEventListener("keydown",handleKeyDown)
        
        if(!isDemo){
            socket.current.on("receive_audio_server_to_client", async (data) => {
                const packet = new Float32Array(data.packet);
                handleStreamAudioRef.current(new Float32Array(data.packet),data.first,data.playbackSampleIndex);
                if(data.type==="streamOnRecord"){
                    if(data.first){
                        audioChunksRef.current = [packet];
                        if(data.last){
                            currentlyRecording.current = false;
                            processAudio([data.packet]);
                            setMouseDragStart({trounded:0,t:0});
                            setMouseDragEnd(null);
                            setPlayheadLocation(0);
                        }
                    }else {
                        const newchunks = [...audioChunksRef.current,packet];
                        audioChunksRef.current = newchunks;
                        if(data.last){
                            currentlyRecording.current = false;
                            processAudio(newchunks);
                            setMouseDragStart({trounded:0,t:0});
                            setMouseDragEnd(null);
                            setPlayheadLocation(0);
                            setDelayCompensation2(data.delayCompensation)
                        }
                    }
                }
                
            });
            
            socket.current.on("send_play_window_to_clients", (data)=>{
                setMouseDragStart(data.mouseDragStart);
                setMouseDragEnd(data.mouseDragEnd);
                let start;
                if(data.mouseDragEnd){
                    start = data.mouseDragStart.trounded
                }else{
                    start = data.mouseDragStart.t
                }
                //start = data.mouseDragEnd ? data.mouseDragStart.trounded : data.mouseDragStart ? data.mouseDragStart.t : 0;
                setPlayheadLocation(start)
                if(numConnectedUsersRef.current >= 2 && !data.mouseDragEnd){
                    socket.current.emit("comm_event",
                        {type:"notify_that_partner_playhead_moved",
                            locationByMeasure:convertTimeToMeasuresRef.current(start),roomID});
                }else if(numConnectedUsersRef.current >=2){
                    socket.current.emit("comm_event",{
                        type:"notify_that_partner_region_selection_changed",
                        roomID,
                        mouseDragStart:convertTimeToMeasuresRef.current(start),
                        mouseDragEnd:convertTimeToMeasuresRef.current(data.mouseDragEnd.trounded),
                    })
                }
            })

            socket.current.on("server_to_client_play_audio",(data)=>{
                handlePlayAudioRef.current(true);
            })

            socket.current.on("handle_skipback_server_to_client",()=>{
                
                setMouseDragEnd(null);
                setMouseDragStart({trounded:0,t:0});
                scrollWindowRef.current.scrollLeft = 0;
                setPlayheadLocation(0);
                if(numConnectedUsersRef.current >= 2){
                    socket.current.emit("comm_event",
                        {   type: "notify_that_partner_playhead_moved",
                            roomID,
                            locationByMeasure:"1.1"});
                }
            })
            
            socket.current.on("request_audio_server_to_client", (data) => {
                const currentChunks = audioChunksRef.current;
                if(currentChunks && currentChunks.length > 0){
                    const currentChunks = audioChunksRef.current;
                    for(let i = 0; i < currentChunks.length; i++){
                            socket.current.emit("send_audio_client_to_server", {
                                audio: currentChunks[i],roomID,
                                i,
                                length: currentChunks.length,
                                delayCompensation,
                            });
                        }
                }
            })
            
            socket.current.on("send_bpm_server_to_client",bpm=>{
                setBPM(bpm);
                BPMRef.current = bpm;
                socket.current.emit("comm_event",
                    {roomID,
                    bpm,
                    type:"notify_that_partner_BPM_changed"
                });
                clearTimeout(commsClearTimeoutRef.current);
                setCommMessage({text:`Partner changed BPM to ${bpm}`,time:performance.now()});
                commsClearTimeoutRef.current = setTimeout(()=>setCommMessage(""),COMM_TIMEOUT_TIME)
            });

            socket.current.on("stop_audio_server_to_client",()=>{
                handleStop(false,true,true);
            });

            socket.current.on("send_latency_server_to_client",(delayComp)=>{
                setDelayCompensation2(delayComp);
                clearTimeout(commsClearTimeoutRef.current);
                setCommMessage({text:`Track 2 latency adjusted`,time:performance.now()});
                commsClearTimeoutRef.current = setTimeout(()=>setCommMessage(""),COMM_TIMEOUT_TIME);
                socket.current.emit("comm_event",{roomID,type:"notify_that_partner_latency_comp_changed"})
            });

            socket.current.on("start_recording_server_to_client",()=>{
                currentlyRecording.current = true;
                recordAnimationRef.current(waveform2Ref,AudioCtxRef.current.currentTime);
                otherPersonRecordingRef.current = true;
            });

            socket.current.on("server_to_client_incoming_audio_done_processing",()=>{
                //setLoadingAudio(null);
            })

            socket.current.on("user_connected_server_to_client",numConnectedUsers=>{
                numConnectedUsersRef.current = numConnectedUsers;
            })

            socket.current.on("user_disconnected_server_to_client",numConnectedUsers=>{
                numConnectedUsersRef.current = numConnectedUsers;
                if(numConnectedUsers<2){
                    setOtherPersonMonitoringOn(false);
                    setMonitoringOn(false);
                    console.log("checkopmonitoringoff");
                }
            })

            socket.current.on("server_to_client_delete_audio",(track)=>{
                handleStop(false,false,true);
                //setLoadingAudio(null);
                //did this trick in the callbacks so that these always trigger a rerender, but have the same truthiness
                if(track==1) setAudio2(prev=>prev===null?false:null);
                else setAudio(prev=>prev===null?false:null);
            });

            socket.current.on("looping_server_to_client",(looping)=>{
                setLooping(looping);
                socket.current.emit("comm_event",
                    {type:"notify_that_partner_received_looping_change",
                        roomID,looping});
            });

            const commMessageMap = {
                partner_joined: () => "Partner joined room",
                partner_left: () => "Partner left room",
                partner_played_audio: () => "Partner played audio",
                notify_that_partner_audio_played: () => "Partner audio played",
                partner_stopped_audio: () => "Partner stopped audio",
                notify_that_partner_audio_stopped: () => "Partner audio stopped",
                recording_started: () => "Partner is recording",
                recording_stopped: () => "Partner recording stopped",
                looping_changed_by_partner: ({ roomID,status }) =>
                    `Partner turned looping ${status ? "on" : "off"}`,
                notify_that_partner_received_looping_change: ({roomID,looping}) =>
                    `Partner looping turned ${looping ? "on" : "off"}`,
                metronome_changed_by_partner: ({ roomID,status }) =>
                    `Partner turned metronome ${status ? "on" : "off"}`,
                notify_that_partner_received_metronome_change: ({roomID,status}) => 
                    `Parter metronome turned ${status ? "on" : "off"}`,
                playhead_moved_by_partner: ({ roomID,locationByMeasure }) =>
                    `Partner moved playhead to ${locationByMeasure}`,
                notify_that_partner_playhead_moved: ({roomID,locationByMeasure}) => 
                    `Partner playhead moved to ${locationByMeasure}`,
                region_selected_by_partner: ({ roomID,mouseDragStart, mouseDragEnd }) =>
                    `Partner selected region ${mouseDragStart} to ${mouseDragEnd}`,
                notify_that_partner_region_selection_changed: ({roomID,mouseDragStart,mouseDragEnd}) =>
                    `Partner selected region is ${mouseDragStart} to ${mouseDragEnd}`,
                partner_changed_BPM: ({ roomID,bpm }) =>
                    `Partner changed BPM to ${bpm}`,
                notify_that_partner_BPM_changed: ({roomID,bpm}) =>
                    `Partner BPM changed to ${bpm}`,
                partner_changed_latency_comp: () =>
                    `Track 2 latency adjusted`,
                notify_that_partner_latency_comp_changed: () =>
                    `Partner received latency adjustment`
            };

            socket.current.on("comm_event", (data) => {
                clearTimeout(commsClearTimeoutRef.current);

                const messageBuilder = commMessageMap[data.type];
                if (!messageBuilder) return;

                const text = messageBuilder(data);
                if (text) {
                    setCommMessage({ text, time: performance.now() });
                }

                commsClearTimeoutRef.current = setTimeout(
                    () => setCommMessage(""),COMM_TIMEOUT_TIME);
            });

            socket.current.on("monitoring_change_server_to_client",status=>{
                console.log('checkotherpersonmonitoringchange',status);
                if(status){
                    setMonitoringOn(false);
                }
                setOtherPersonMonitoringOn(status);
            })

            socket.current.emit("join_room", roomID);
        }

        


        return ()=>{
            if(numConnectedUsersRef.current>=2){
                socket.current.disconnect();
            }
            AudioCtxRef.current?.close();
            window.removeEventListener("keydown",handleKeyDown)
        }

        
    }, []);

    useEffect(()=>{
        if(!popoverOpen){
            setTimeout(()=>{
            setFirstEnteredRoom(false);
            setDisplayDelayCompensationMessage(false);
            setPopoverMoreInfo(false);
            },400)
        }
    },[popoverOpen])

    loopingRef.current = looping;

    if(metronomeRef.current){
        metronomeRef.current.tempo = BPM;
    }

    const streamAudio = (packet,first,samplePos) => {
        if(!monitoringOn) return;
        const incomingAudioSource = AudioCtxRef.current.createBufferSource();
        const stereoBuffer = AudioCtxRef.current.createBuffer(2,4096,AudioCtxRef.current.sampleRate);
        stereoBuffer.getChannelData(0).set(packet);
        stereoBuffer.getChannelData(1).set(packet);
        incomingAudioSource.buffer = stereoBuffer;
        let startTime;
        if(first){
            streamingTimeRef.current = AudioCtxRef.current.currentTime + .05;
        }else{
            streamingTimeRef.current += (4096 / AudioCtxRef.current.sampleRate);
        }
        startTime = streamingTimeRef.current;
        incomingAudioSource.connect(AudioCtxRef.current.destination);
        const playbackAudioSource = AudioCtxRef.current.createBufferSource();
        const playbackBuffer = AudioCtxRef.current.createBuffer(2,4096,AudioCtxRef.current.sampleRate)
        const startSample = samplePos;
        const endSample = samplePos + 4096;
        if(audio && samplePos >= 0){
            playbackBuffer.getChannelData(0).set(audio.getChannelData(0).subarray(startSample,endSample));
            playbackBuffer.getChannelData(1).set(audio.getChannelData(0).subarray(startSample,endSample));
        }
        playbackAudioSource.buffer = playbackBuffer;

        playbackAudioSource.start(startTime);
        incomingAudioSource.start(startTime);
    }

    const handlePlayAudio = (fromOtherPerson) => {
        //This function handles the dirty work of playing audio correctly no matter where the playhead is
        if(currentlyPlayingAudio.current || currentlyRecording.current) return;
        autoscrollEnabledRef.current = true;
        if (playingAudioRef.current) {
            playingAudioRef.current.disconnect();
            playingAudioRef.current = null;
        }
        if (playingAudioRef2.current) {
            playingAudioRef2.current.disconnect();
            playingAudioRef2.current = null;
        }

        const getBuffer = (localAudio,startTime,endTime) => {
            const startSample = Math.floor(startTime * AudioCtxRef.current.sampleRate);
            const endSample = Math.floor(endTime * AudioCtxRef.current.sampleRate);
            const length = endSample - startSample;
            const stereoBuffer = AudioCtxRef.current.createBuffer(2,length,AudioCtxRef.current.sampleRate);
            if(localAudio){
                stereoBuffer.getChannelData(0).set(localAudio.getChannelData(0).subarray(startSample,endSample));
                stereoBuffer.getChannelData(1).set(localAudio.getChannelData(0).subarray(startSample,endSample));
            }
            return stereoBuffer
        }

        const source = AudioCtxRef.current.createBufferSource();
        const source2 = AudioCtxRef.current.createBufferSource();
        source.connect(gainRef.current);
        source2.connect(gain2Ref.current);
        
        /*
        const stereoBuffer = AudioCtxRef.current.createBuffer(2, audio ? audio.length:1, AudioCtxRef.current.sampleRate);
        if(audio){
            stereoBuffer.getChannelData(0).set(audio.getChannelData(0));
            stereoBuffer.getChannelData(1).set(audio.getChannelData(0));
        }
        
        const stereoBuffer2 = AudioCtxRef.current.createBuffer(2, audio2?audio2.length:1, AudioCtxRef.current.sampleRate);
        if(audio2){
            stereoBuffer2.getChannelData(0).set(audio2.getChannelData(0));
            stereoBuffer2.getChannelData(1).set(audio2.getChannelData(0));
        }
        source2.buffer = stereoBuffer2
        */
        //currentPlayingAudio is set to 2 when audio is playing; when one source ends it -= 1
        source.onended = () => {
            source.disconnect();
        }
        source2.onended = () => {
            source2.disconnect();
        }
        const rect = waveform1Ref.current.getBoundingClientRect();
        //Pixels per second calculates the rate at which the playhead must move. Depends on BPM
        //Divides full width of canvas by the total time in seconds 128 beats takes
        const pixelsPerSecond = rect.width/((60/BPM)*128)
        //totalTime is is length of time if audio the length of entire canvas is played
        const totalTime = (128*60/BPM) 
        //const duration = Math.max(source.buffer.length,source2.buffer.length)/AudioCtxRef.current.sampleRate;
        //startTime, endTime are relative to the audio, not absolute times, in seconds
        let startTime = 0;
        let endTime = totalTime;
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
            endTime = mouseDragEnd.t//totalTime * Math.min(1,mouseDragEnd.t*pixelsPerSecond/ waveform1Ref.current.width);
        }else if(mouseDragEnd&&snapToGrid){
            endTime = mouseDragEnd.trounded//totalTime * Math.min(1,mouseDragEnd.trounded*pixelsPerSecond/ waveform1Ref.current.width);
        }

        //updatePlayhead uses requestAnimationFrame to animate the playhead
        //note we need the start parameter to keep track of where in the audio we are starting
        //as opposed to now which is the current time absolutely

        

        const updatePlayhead = (start) => {
            const elapsed = Math.max(AudioCtxRef.current.currentTime - now,0);
            (looping && mouseDragEnd) ? setPlayheadLocation(start+(elapsed%(endTime-startTime))) : setPlayheadLocation(start+elapsed);
            const x = (looping && mouseDragEnd) ? (start+(elapsed%(endTime-startTime)))*pixelsPerSecond : (start+elapsed) * pixelsPerSecond;
            //auto scroll right if playhead moves far right enough
            const visibleStart = scrollWindowRef.current.scrollLeft
            const visibleEnd = visibleStart + WAVEFORM_WINDOW_LEN
            if((x-visibleStart)/(visibleEnd-visibleStart)>(10/11)&&autoscrollEnabledRef.current){
                scrollWindowRef.current.scrollLeft = 750 + visibleStart;
            }
            
            if((start+elapsed<endTime&&currentlyPlayingAudio.current)||(looping && mouseDragEnd && currentlyPlayingAudio.current)){
                requestAnimationFrame(()=>{updatePlayhead(start)});
            }else if(!mouseDragEnd){
                //if no region has been dragged, and end is reached, reset playhead to the beginning
                metronomeRef.current.stop();
                setMouseDragStart({trounded:x/pixelsPerSecond,t:x/pixelsPerSecond})
                setMouseDragEnd(null)
                setPlayheadLocation(x/pixelsPerSecond);
                currentlyPlayingAudio.current = false;
            }else{
                //if a region has been dragged, reset playhead to 
                metronomeRef.current.stop();
                setPlayheadLocation(start)
                currentlyPlayingAudio.current = false;
            }
        }
        const secondsToDelay = delayCompensation/AudioCtxRef.current.sampleRate; //convert delayComp in samples to seconds
        const secondsToDelay2 = delayCompensation2/AudioCtxRef.current.sampleRate;
        /*const audiolength = Math.max(audio ? audio.getChannelData(0) : 0,audio2 ? audio2.getChannelData(0) : 0);
        if(startTime+secondsToDelay>=audiolength/AudioCtxRef.current.sampleRate){
            //if someone tries to play audio after the end of the audio, play audio from the beginning
            startTime = 0;
            endTime = duration;
            timeToNextMeasure = 0;
            setMouseDragStart({trounded:0,t:0})
            setMouseDragEnd(null)
            start = 0;
        }*/
        //add .05 to match the delay of audio/metronome (metronome needs delay for first beat to sound)
        let now = AudioCtxRef.current.currentTime+.05;
        //the .05 added to now previously was for playhead rendering purposes, we need to subtract it here
        
        //source.start arguments are (time to wait to play audio,location in audio to start,duration to play)
        source.buffer = getBuffer(audio,startTime+secondsToDelay,endTime+secondsToDelay);
        source2.buffer = getBuffer(audio2,startTime+secondsToDelay2,endTime+secondsToDelay2);
        if(otherPersonMonitoringOn){
            recorderRef.current.startStreamOnPlay(source.buffer,source2.buffer,delayCompensation,looping)
        }else if(!monitoringOn){
            source.loop = mouseDragEnd ? looping : false;
            source2.loop = mouseDragEnd ? looping : false;
            source.start(now);
            source2.start(now);
            metronomeRef.current.start(now-.05+timeToNextMeasure);
            playingAudioRef.current = source;
            playingAudioRef2.current = source2;
        }
        currentlyPlayingAudio.current = 2;
        updatePlayhead(startTime)
        if(numConnectedUsersRef.current>=2 && fromOtherPerson){
            socket.current.emit("comm_event",{type:"notify_that_partner_audio_played",roomID});
            clearTimeout(commsClearTimeoutRef.current);
            setCommMessage({text:"Partner played audio",time:performance.now()});
            setTimeout(()=>setCommMessage(""),COMM_TIMEOUT_TIME);
        }
    }

    handlePlayAudioRef.current = handlePlayAudio;
    handleStreamAudioRef.current = streamAudio;

    const handleTempoMouseDown = (e) => {
        //handles the BPM adjuster
        if(currentlyPlayingAudio.current||currentlyRecording.current){
            return
        }
        e.preventDefault();
        const startX = e.clientX;
        const startBPM = BPM;

        const handleMouseMove = (e) => {
            const deltaX = (startX - e.clientX)/2;
            setBPM(prev=>{
                const newbpm = startBPM - Math.floor(deltaX)
                if(30<=newbpm&&newbpm<=400){
                    BPMRef.current = newbpm
                    return newbpm
                }else{
                    return prev
                }
            });
        };

        const handleMouseUp = () => {
            if(BPMRef.current&& numConnectedUsersRef.current >= 2){
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
            if(numConnectedUsersRef.current >= 2){
                socket.current.emit("handle_skipback_client_to_server",roomID);
            }
        }
    }

    const handleStop = (sendSocket,keepRecording,fromOtherPerson,stoppingRecording) => {
        if(playingAudioRef.current){
            playingAudioRef.current.stop();
        }
        if(playingAudioRef2.current){
            playingAudioRef2.current.stop();
        }
        keepRecordingRef.current = keepRecording;
        if(currentlyRecording.current){
            recorderRef.current.stopRecording(keepRecording);
        }
        currentlyRecording.current = false;
        recorderRef.current.stopStreamOnPlay();
        if(numConnectedUsersRef.current >= 2 && fromOtherPerson && currentlyPlayingAudio.current){
            socket.current.emit("comm_event",{roomID,type:"notify_that_partner_audio_stopped"});
            clearTimeout(commsClearTimeoutRef.current);
            setCommMessage({text:"Partner stopped audio",time:performance.now()});
            setTimeout(()=>setCommMessage(""),COMM_TIMEOUT_TIME);
        }
        currentlyPlayingAudio.current = false;
        metronomeRef.current.stop();
        if(numConnectedUsersRef.current >=2 && sendSocket){
            socket.current.emit("stop_audio_client_to_server",roomID);
        }
    }

    let delayCompensationStep;
    if(AudioCtxRef.current){
        delayCompensationStep = Math.floor(AudioCtxRef.current.sampleRate * .005);
    }else{
        delayCompensationStep = 205;
    }
    

    return <div className="">
        <div className="w-full grid place-items-center items-center">
            <div 
            className={`grid bg-gray-700 border-gray-500 border-4 rounded-2xl shadow-gray shadow-md`}
                style={{
                    gridTemplateRows: `1px ${Math.floor(172*compactMode)}px`,
                    width: 1050, 
                    height: Math.floor(232*compactMode) 
                }}>
                <div className={"relative row-start-2 grid pt-3 grid-cols-[20px_100px_0px]"}
                style={{height:Math.floor(172*compactMode)}}
                >
                    <div
                        ref={controlPanelRef}
                        className="col-start-2"
                        style={{width:100,height:Math.floor(150*compactMode)}}
                    >
                    <div className="bg-[rgb(86,86,133)] flex flex-col justify-center items-center text-xs text-white"
                            style={{width:100,height:Math.floor(35*compactMode)}}
                    >
                        <button className={"border-1 border-black rounded-2xl px-1 " + (monitoringOn?"bg-amber-600":"bg-[rgb(106,106,133)")}
                        onClick={()=>setMonitoringOn(prev=>{
                            console.log('checksetmonitoringon',!prev);
                            if(numConnectedUsersRef.current >= 2 && !currentlyPlayingAudio.current && !currentlyRecording.current){ 
                                socket.current.emit("monitoring_change_client_to_server",{roomID,status:!prev});
                                return !prev;
                            }
                            return prev;})}
                        >Alt Monitoring</button>
                    </div>
                    <div className="bg-[rgb(114,120,155)]"
                        style={{width:100,height:Math.floor(115*compactMode)}}
                    >
                        <div style={{width:100,height:Math.floor(58*compactMode)}} className="border-b border-black flex flex-row items-center">
                            <button onClick={()=>{
                                //did this trick so that setAudio always triggers a rerender, but will still have the same truthiness
                                setAudio(prev=>{
                                    if(prev) handleStop(true,false,false);
                                    return prev===false?null:false
                                });
                                if(numConnectedUsersRef.current >= 2){
                                    socket.current.emit("client_to_server_audio_deleted",{roomID,track:1});
                                }
                            }}>
                                <Trash2 className="scale-75"/>
                            </button>
                            <button className={"border-1 border-black text-white text-xs w-8 h-5 ml-1 pr-1 pl-1 rounded-sm " + (track1Muted ? "bg-amber-600" : "")}
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
                        <div style={{width:100,height:Math.floor(58*compactMode)}} className="border-b border-black flex flex-row items-center">
                            <button onClick={()=>{
                                //did this trick so that setAudio2 always triggers a rerender, but will still have the same truthiness
                                setAudio2(prev=>{
                                    if(prev) handleStop(false,false,false);
                                    prev===false?null:false}
                                );
                                if(numConnectedUsersRef.current >= 2){
                                    socket.current.emit("client_to_server_audio_deleted",{roomID,track:2});
                                }
                                }} className="scale-75">
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
                                setSnapToGrid={setSnapToGrid} numConnectedUsersRef={numConnectedUsersRef}
                                waveform2Ref={waveform2Ref} audio2={audio2} delayCompensation2={delayCompensation2}
                                WAVEFORM_WINDOW_LEN={WAVEFORM_WINDOW_LEN} autoscrollEnabledRef={autoscrollEnabledRef}
                                setZoomFactor={setZoomFactor} compactMode={compactMode} loadingAudio={loadingAudio}
                                pxPerSecondRef={pxPerSecondRef} convertTimeToMeasuresRef={convertTimeToMeasuresRef}
                    />
                    {/*<Button variant="default" size={compactMode==1?"lg":"sm"} onClick={()=>setSnapToGrid(prev=>!prev)} 
                        className="border-1 border-gray-300 hover:bg-gray-800"
                        style={{position:"absolute",right:15,top:Math.floor(120*compactMode),transform:"scale(.7)"}}>
                        <Magnet color={snapToGrid ? "lightblue" : "white"} style={{transform:"rotate(315deg)"+(compactMode==1?"scale(1.5)":"scale(1)")}}></Magnet>
                        <Columns4 color={snapToGrid ? "lightblue" : "white"} style={{transform:compactMode==1?"scale(1.5)":"scale(1)"}}></Columns4>
                    </Button>*/}
                </div>
                
                <div className="row-start-3 grid grid-cols-[20px_420px_125px_200px_250px]" 
                    style={{height:Math.floor(32*compactMode),transform:`${compactMode!=1?"translateY(3px)":""}`}}>
                    <ButtonGroup className="rounded border-1 border-gray-300 col-start-2"
                        style={{transform:compactMode!=1?"scale(.7) translate(-55px,-10px)":""}}
                    >
                        <Button variant="default" size={compactMode==1?"lg":"sm"} className="hover:bg-gray-800"
                            onClick={()=>{
                                    handlePlayAudio(false);
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
                            onClick={()=>{
                                if(!currentlyPlayingAudio.current&&!currentlyRecording.current){
                                    recorderRef.current.startRecording(audio2,delayCompensation2);
                                    if(numConnectedUsersRef.current >= 2){
                                        socket.current.emit("start_recording_client_to_server",roomID);
                                    }
                                }
                            }}
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
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger className={"col-start-4 hover:underline text-blue-200 "+(compactMode!=1?"-translate-y-2":"")}>Latency</PopoverTrigger>
                        <PopoverContent className="w-132">
                            <div>
                                <div className="flex flex-col items-center justify-center">
                                    <div className="text-xl font-bold">{firstEnteredRoom && "Quick Setup: " } Latency Calibration</div>
                                </div>
                                {/*<div className="text-sm">For synchronized web audio, it is essential to do a latency test. Three steps:</div>*/}
                                <div className="text-xs">1. If you are using a non-computer mic, place your mic near your speakers.</div>
                                <div className="text-xs">2. Unplug your headphones.</div>
                                <div className="text-xs">3. Turn your volume up. The louder the better.</div>
                                <div className="text-xs">4. Press the button below. It will emit a test click.</div>
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
                                Latency compensation applied.</div>}
                            
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
                                </Slider>
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
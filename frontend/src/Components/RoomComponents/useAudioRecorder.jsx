import { useRef, useEffect, useState } from 'react';

export const useAudioRecorder = (
  {metronomeRef,socket, roomID, setAudio,
  audioChunksRef,setAudioURL,setDelayCompensation, setDelayCompensationAudio, 
  onDelayCompensationComplete, setMouseDragStart, setMouseDragEnd,    
  playheadRef,metronomeOn,waveform1Ref,BPM,scrollWindowRef,currentlyRecording,
  setPlayheadLocation,numConnectedUsersRef,delayCompensation,BPMRef,recorderRef,recordAnimationRef,
  metronomeOnRef,gain2Ref,metronomeGainRef,WAVEFORM_WINDOW_LEN,autoscrollEnabledRef,
  setLoadingAudio,otherPersonRecordingRef,setAudio2,setLatencyTestRes,streamOnPlayProcessorRef,
  autoTestLatency,localStreamRef,initializeRecorder,dataConnRef,audioSourceRef,audioCtxRef,
  isDemo,AudioCtxRef,opusRef,fileSystemRef,timeline,timelineDispatch,
  recordSABRef,stagingSABRef,mixSABRef,
}
) => {
  const delayCompensationRecorderRef = useRef(null);
  const delayCompensationRef = useRef(null);
  const delayChunksRef = useRef(null);
  const sessionIdRef = useRef(null);
  const streamOnPlayIdRef = useRef(null);
  const streamRef = useRef(null);
  const streamOnPlayPacketCountRef = useRef(0);
  const recordPacketCountRef = useRef(0);
  const recordBufferToSendRef = useRef(null);
  const recordingCountRef = useRef(0);

  delayCompensationRef.current = delayCompensation;

  // Initialize media stream and recorders
  useEffect(() => {
    if(!initializeRecorder) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("getUserMedia not supported on your browser!");
      return;
    }
    
    const initializeMedia = async () => {
      try {
        await AudioCtxRef.current.resume();
        let source;
        if(!audioSourceRef){
           const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              }
            });
          streamRef.current = stream;
          
          source = AudioCtxRef.current.createMediaStreamSource(stream);
        }else{
          source = audioSourceRef.current;
        }
        
        await AudioCtxRef.current.audioWorklet.addModule("/AudioProcessor.js");
        const processor = new AudioWorkletNode(AudioCtxRef.current,'AudioProcessor');
        processor.port.postMessage({
          actiontype:"init",
          recordSAB:recordSABRef.current,
          stagingSAB:stagingSABRef.current,
          mixSAB:mixSABRef.current,
        })
        source.connect(processor);
        processor.connect(gain2Ref.current);

        const startPlayback = (isStreaming,looping,timelineStart,timelineEnd,startTime,endTime,stagingTimeline) => {
          const sessionId = crypto.randomUUID()
          sessionIdRef.current = sessionId;
          processor.port.postMessage({
            actiontype:"start",
            sessionId,isRecording:false,isStreaming,
            looping,recordingCount:0,timelineStart,
            timelineEnd,startTime,endTime
          })
          fileSystemRef.current.postMessage({
            type:"init_playback",stagingTimeline,timelineStart,timelineEnd
          });
        }

        const startRecording = (isStreaming,autoTestLatency,timelineStart,timeline,looping,startTime,endTime) => {


          fileSystemRef.current.postMessage({
            type:'init_recording',
            timelineStart,timeline,
            looping,
          })

          const sessionId = crypto.randomUUID();
          sessionIdRef.current = sessionId;

          processor.port.postMessage({
            actiontype:"start",
            sessionId,isRecording:true,isStreaming,
            looping,recordingCount:0,timelineStart,
            startTime,endTime
          });

          
          
          //handleRecording(metronomeRef,autoTestLatency);
          setMouseDragStart({trounded:0,t:0});
          setMouseDragEnd(null);
          recordPacketCountRef.current = 0;
          if(numConnectedUsersRef.current >=2){
            socket.current.emit("comm_event",
              {roomID,
                type:"recording_started",
              });
          }
        }

        await AudioCtxRef.current.audioWorklet.addModule("/StreamOnPlayProcessor.js");
        const streamOnPlayProcessor = new AudioWorkletNode(AudioCtxRef.current,'StreamOnPlayProcessor');
        source.connect(streamOnPlayProcessor);
        streamOnPlayProcessor.connect(AudioCtxRef.current.destination);
        streamOnPlayProcessorRef.current = streamOnPlayProcessor;

        const stopRecording = (keepRecording,timelineEnd) => {
          processor.port.postMessage({actiontype:"stop",keepRecording,sessionId:sessionIdRef.current,timelineEnd});
          if(numConnectedUsersRef.current >= 2 && !otherPersonRecordingRef.current){
            socket.current.emit("comm_event",{
              type:"recording_stopped",
              roomID});
          }
        };

        const stopStreamOnPlay = () => {
          streamOnPlayProcessor.port.postMessage({actiontype:"stop",sessionId:streamOnPlayIdRef.current});
        }

        streamOnPlayProcessor.port.onmessage = event => {
          if(numConnectedUsersRef.current >= 2){
            if(dataConnRef.current && dataConnRef.current.open){
              //send packet to worker to encode
              opusRef.current.postMessage({
                type:"encode",
                packet:event.data.packet,
                isRecording:false,
                packetCount: streamOnPlayPacketCountRef.current++,
                recordingCount: 0,
                last: event.data.last,
              })
            }
          }
        }
        
        processor.port.onmessage = (event) => {
            timelineDispatch({data:event.data,type:"add_region",fileSystemRef,delayCompensation})
        }

        const stopPlayback = (endTime)=>{
          processor.port.postMessage({actiontype:"stop",endTime,sessionId:sessionIdRef.current});
          fileSystemRef.current.postMessage({type:"stop_playback"});
        }

        recorderRef.current = {processor,startPlayback,stopPlayback,startRecording,stopRecording,startStreamOnPlay,stopStreamOnPlay};
        // Setup delay compensation recorder
        const delayCompRecorder = new AudioWorkletNode(AudioCtxRef.current,'AudioProcessor');
        delayCompensationRecorderRef.current = delayCompRecorder;
        source.connect(delayCompRecorder);
        delayCompRecorder.connect(AudioCtxRef.current.destination);

        delayCompRecorder.port.onmessage = (event) => {
          //handles delay comp recording being stopped

            if(event.data.first){
              delayChunksRef.current = [event.data.packet]
            }else{
              delayChunksRef.current.push(event.data.packet)
            }

            if(event.data.last){
              console.log("Delay compensation recorder stopped");
              const recordedBuffers = delayChunksRef.current;
              const length = recordedBuffers.reduce((sum,arr) => sum+arr.length,0)
              const fullBuffer = new Float32Array(length);
              let offset = 0;
              for(const arr of recordedBuffers){
                fullBuffer.set(arr,offset)
                offset += arr.length;
              }


              const barker = metronomeRef.current.barker;
              const correlations = [];
              let greatestCorrelation = -Infinity;
              let greatestIndex = -1;
              

              for(let i=0;i<fullBuffer.length-barker.length;i++){
                let correlation = 0;
                for(let j=0;j<barker.length;j++){
                  correlation += fullBuffer[i+j] * barker[j];
                }
                correlations.push(correlation)
                if(correlation > greatestCorrelation){
                  greatestCorrelation = correlation;
                  greatestIndex = i;
                }
              }

              const dataArray = fullBuffer;

              /*
              let greatestAvg = 0;
              let greatestPeakDet = 0;
              
              for(let i=0;i<dataArray.length-50;i++){
                  let avg = 0
                  for(let j=i;j<i+50;j++){
                      avg += Math.abs(dataArray[j])/50;
                  }
                  if(avg>greatestAvg){
                      greatestAvg = avg;
                      greatestPeakDet = i;
                  }
              }*/

              setDelayCompensation([greatestIndex])
              setLatencyTestRes(greatestIndex);
              if(numConnectedUsersRef.current>=2){
                socket.current.emit("send_latency_client_to_server",{
                roomID,delayCompensation:[greatestIndex]
              })
              }
            }
        };

      } catch (err) {
        console.error(`The following getUserMedia error occurred: ${err}`);
      }
    };

    initializeMedia();

    // Cleanup
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  },[initializeRecorder]);
  
  //[AudioCtxRef.current, roomID, socket, delayCompensation,recorderRef.current]);

  useEffect(()=>{
    if(streamOnPlayProcessorRef.current){
      streamOnPlayProcessorRef.current.port.postMessage({
        actiontype:"metronome",
        metronomeOn,BPM,
      })
    } 
  },[metronomeOn,BPM])

  const startStreamOnPlay = (audio,audio2,delayComp,looping) => {
    const sessionId = crypto.randomUUID();
    streamOnPlayIdRef.current = sessionId;
    streamOnPlayPacketCountRef.current = 0;
    streamOnPlayProcessorRef.current?.port.postMessage({
      actiontype:"start",
      buffer1:audio?audio.getChannelData(0).slice():null,
      buffer2:audio2?audio2.getChannelData(0).slice():null,
      sessionId,
      delayCompensation:delayComp,
      looping,
      clickBuffer:metronomeRef.current.clickBuffer,
      BPM,metronomeOn
    })
    
  }

  const startRecording = () => {
    //this used to have stuff, now it doesn't, but I'm keeping it for now to not break anything, and also in case I want something here later
    //start recording logic is handled by a function in the above effect
  }

  // Recording control functions
const updatePlayhead = (waveformRef,now) => {
    const rect = waveformRef.current.getBoundingClientRect();
    const pixelsPerSecond = rect.width/((60/BPMRef.current)*128)
    const waveformCtx = waveformRef.current.getContext("2d");
    const elapsed = AudioCtxRef.current.currentTime - now;
    if(!currentlyRecording.current){
      if(otherPersonRecordingRef.current){
        otherPersonRecordingRef.current = false;
        //setAudio2(null);
        //if(!keepRecordingRef.current){
          //setLoadingAudio({track:2,time:elapsed})
        //}
      }
      return;
    }
    const x = (elapsed * pixelsPerSecond);
    setPlayheadLocation(elapsed);                
    if(x>=waveformRef.current.width){
      stopRecording(metRef);
      return
    }
    const visibleStart = scrollWindowRef.current.scrollLeft
    const visibleEnd = visibleStart + WAVEFORM_WINDOW_LEN;
    if((x-visibleStart)/(visibleEnd-visibleStart)>(10/11)&&autoscrollEnabledRef.current){
        scrollWindowRef.current.scrollLeft = 750 + visibleStart;
    }
    waveformCtx.clearRect(0,0,rect.width,rect.height)
    waveformCtx.fillStyle = "rgb(0,75,200)"
    waveformCtx.globalAlpha = .20
    waveformCtx.fillRect(0,0,x,rect.height)
    if(currentlyRecording.current){
        requestAnimationFrame(()=>updatePlayhead(waveformRef,now));
    }
}

recordAnimationRef.current = updatePlayhead;

  const handleRecording = async (metRef,autoTestLatency) => {
    if (recorderRef.current && metRef.current) {
        autoscrollEnabledRef.current = true;


        if (AudioCtxRef.current.state === "suspended") {
          await AudioCtxRef.current.resume();
        }

        currentlyRecording.current = true;
        
        const now = AudioCtxRef.current.currentTime;

        //metRef.current.currentBeatInBar = 0;
        //metRef.current.start(now,true);
        if(autoTestLatency){
          startDelayCompensationRecording(metRef);
        } 
        
        
        //recordAnimationRef.current(waveform1Ref,now + (autoTestLatency?(4*60/BPM):0));
        console.log("Recording started");
    }
  }

  const stopRecording = (metRef) => {
    if (recorderRef.current && metRef.current) {
        currentlyRecording.current = false;
        metRef.current.stop();
        console.log("Recording stopped");
    }
  }

  
  const startDelayCompensationRecording = (metRef) => {
    if (delayCompensationRecorderRef.current && metRef.current) {
      const sessionId = crypto.randomUUID();
      const now = AudioCtxRef.current.currentTime;
      metRef.current.startBarker(now);
      delayCompensationRecorderRef.current.port.postMessage({
            actiontype:"start",
            buffer: [],
            delayCompensation:[0],
            sessionId,
          });
      console.log("Delay compensation recording started");
      setTimeout(()=>{
        delayCompensationRecorderRef.current.port.postMessage({
          actiontype:"stop",
          keepRecording:true,
          sessionId
        });
      },500);
    }
  }


  return {
    startRecording,
    stopRecording,
    startDelayCompensationRecording,
    startStreamOnPlay,
    isRecorderReady: !!recorderRef.current
  };
};

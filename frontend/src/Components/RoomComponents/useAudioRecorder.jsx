// useAudioRecorder.js
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
  isDemo,AudioCtxRef,opusRef
}
) => {
  const mediaRecorderRef = useRef(null);
  const delayCompensationRecorderRef = useRef(null);
  const recordedBuffersRef = useRef(null);
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
        
        await AudioCtxRef.current.audioWorklet.addModule("/RecorderProcessor.js");
        const processor = new AudioWorkletNode(AudioCtxRef.current,'RecorderProcessor');
        source.connect(processor);
        processor.connect(gain2Ref.current);
        

        const startRecording = (audio2,delayComp,autoTestLatency) => {
          const sessionId = crypto.randomUUID();
          sessionIdRef.current = sessionId;

          recordedBuffersRef.current = [];
          processor.port.postMessage({
            actiontype:"start",
            buffer:audio2 ? audio2.getChannelData(0).slice():[],
            delayCompensation:delayComp,
            sessionId,
            startTime:AudioCtxRef.current.currentTime + (autoTestLatency ? (4*60/BPMRef.current) : 0),
            recordingCount:recordingCountRef.current++,
          });
          handleRecording(metronomeRef,autoTestLatency);
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



        

        const stopRecording = (keepRecording) => {
          processor.port.postMessage({actiontype:"stop",keepRecording,sessionId:sessionIdRef.current});
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
              const floatArray = event.data.packet; // The incoming Float32Array
    
              // 1. Grab our pre-allocated refs
              const uint8View = uint8ViewRef.current;
              const dataView = dataViewRef.current;

              // 2. Set Flags (1 byte)
              let flags = 0;
              if (event.data.first) flags |= 0x01;
              if (event.data.last) flags |= 0x02;
              flags |= 0x04; //this flag indicates audio is playback mode, not recording

              uint8View[0] = flags;

              // 3. Set 32-bit Packet Count (4 bytes) - No 'new' needed
              // This writes to indices 1, 2, 3, and 4
              dataView.setUint32(1, streamOnPlayPacketCountRef.current, false); 
              streamOnPlayPacketCountRef.current++;

              let byteOffset = 5;
              for (let i = 0; i < floatArray.length; i++) {
                dataView.setFloat32(byteOffset, floatArray[i], true); // little-endian
                byteOffset += 4;
              }

              console.log(recordBufferToSendRef.current);

              dataConnRef.current.send(recordBufferToSendRef.current);

            }
          }
        }
        
        processor.port.onmessage = (event) => {

          if(numConnectedUsersRef.current >= 2){
            if(dataConnRef.current && dataConnRef.current.open){
              //send packet to worker to encode
              console.log("we sendin");
              opusRef.current.postMessage({
                type:"encode",
                packet:event.data.packet,
                isRecording:true,
                packetCount: recordPacketCountRef.current++,
                recordingCount: event.data.recordingCount,
                last: event.data.last,
              })
            }
          }

          if(event.data.first){
            audioChunksRef.current.getChannelData(0).fill(0);
          }

          const index = event.data.packetCount * 960;
          audioChunksRef.current.copyToChannel(event.data.packet,0,index);

          if(event.data.last){
            const audbuf = AudioCtxRef.current.createBuffer(
              1,
              index,
              AudioCtxRef.current.sampleRate
            )
            audbuf.copyToChannel(audioChunksRef.current.getChannelData(0),0,0);
            setAudio(audbuf);
            setPlayheadLocation(0);

          }else if(event.data.packetCount % 10 === 9){
            const audbuf = AudioCtxRef.current.createBuffer(
              1,
              index,
              AudioCtxRef.current.sampleRate
            )
            audbuf.copyToChannel(audioChunksRef.current.getChannelData(0),0,0);
            setAudio(audbuf);
          }
        }

        recorderRef.current = {processor,startRecording,stopRecording,startStreamOnPlay,stopStreamOnPlay};
        // Setup delay compensation recorder
        const delayCompRecorder = new AudioWorkletNode(AudioCtxRef.current,'RecorderProcessor');
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
                let signalEnergy = 0;
                let barkerEnergy = 0;
                for(let j=0;j<barker.length;j++){
                  correlation += fullBuffer[i+j] * barker[j];
                  //signalEnergy += fullBuffer[i+j] * fullBuffer[i+j];
                  //barkerEnergy += barker[j] * barker[j];
                }
                //const denominator = Math.sqrt(signalEnergy * barkerEnergy);
                // Use 1e-10 to prevent "Division by Zero" if the audio is silent
                const normalizedCorr = Math.abs(correlation) / 1.0;//(denominator + 1e-10);
                correlations.push(normalizedCorr)
                if(normalizedCorr > greatestCorrelation){
                  greatestCorrelation = normalizedCorr;
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

        metRef.current.currentBeatInBar = 0;
        metRef.current.start(now,true);
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

  /*
  const startDelayCompensationRecording = (metRef) => {
    if (delayCompensationRecorderRef.current && metRef.current) {
      const sessionId = crypto.randomUUID();
      const prevtempo = metRef.current.tempo;
      const prevMetronomeGain = metronomeGainRef.current.gain.value;
      const now = AudioCtxRef.current.currentTime;
      metRef.current.tempo = 120;
      metronomeGainRef.current.gain.value = 1.0;
      metRef.current.start(now);
      delayCompensationRecorderRef.current.port.postMessage({
            actiontype:"start",
            buffer: [],
            delayCompensation:[0],
            sessionId,
          });
      console.log("Delay compensation recording started");
      setTimeout(() => {
        metronomeRef.current.stop();
        metRef.current.tempo = prevtempo
        metronomeGainRef.current.gain.value = prevMetronomeGain;
      }, 400);
      setTimeout(()=>{
        delayCompensationRecorderRef.current.port.postMessage({
          actiontype:"stop",
          keepRecording:true,
          sessionId
        });
      },1000)
    }
    const barkerDelayComp = () => {

    }
  }*/


  return {
    startRecording,
    stopRecording,
    startDelayCompensationRecording,
    startStreamOnPlay,
    isRecorderReady: !!recorderRef.current
  };
};

import { useEffect,useRef,useState } from "react";
import "./RecorderInterface.css";
import { data } from "react-router-dom";
import { PiNewspaperClippingBold } from "react-icons/pi";

export default function RecorderInterface({
    audio,BPM,mouseDragEnd,zoomFactor,delayCompensation,
    measureTickRef,mouseDragStart,audioCtxRef,
    waveform1Ref,waveform2Ref,playheadRef,setMouseDragStart,
    setMouseDragEnd,socket,roomID,scrollWindowRef,
    playheadLocation,setPlayheadLocation,snapToGrid,
    currentlyPlayingAudio,numConnectedUsersRef,audio2,delayCompensation2,
    WAVEFORM_WINDOW_LEN,autoscrollEnabledRef,setZoomFactor,
    compactMode,loadingAudio,pxPerSecondRef,convertTimeToMeasuresRef,
    fileSystemRef,stagingTimeline,timeSignature,viewportDataRef
}){

    const canvasContainerRef = useRef(null);
    const waveformContainerRef = useRef(null);
    const isDraggingPlaybackRegion = useRef(false);
    const mouseDragStartRef = useRef(mouseDragStart);
    const mouseDragEndRef = useRef(mouseDragEnd);
    const audio2Ref = useRef(null);
    const animation1Ref = useRef(null);
    const animation2Ref = useRef(null);
    const mouseDragStartCloneRef = useRef(mouseDragStart);
    const mouseDragEndCloneRef = useRef(mouseDragEnd);
    const playheadLocationRef = useRef(playheadLocation)
    //Used to set playhead location in the DOM, and also for calculations on the canvas
    const pxPerSecond = WAVEFORM_WINDOW_LEN/(viewportDataRef.current.endTime - viewportDataRef.current.startTime)
    //Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor)/(128*60/BPM);
    pxPerSecondRef.current = pxPerSecond;
    const playheadPx = playheadLocation*pxPerSecond;

    audio2Ref.current = audio2;

    convertTimeToMeasuresRef.current = (time) => {
        const locationinBeats = (((time * pxPerSecond)+1)/ measureTickRef.current.width)*128; //add 1 because, look at the start of the window - the first line isn't there
        return (1+Math.floor(locationinBeats/4)).toString() + "." + (1+Math.floor(locationinBeats%4)).toString();
    }

    mouseDragStartCloneRef.current = mouseDragStart;
    mouseDragEndCloneRef.current = mouseDragEnd;
    playheadLocationRef.current = playheadLocation;

    
    useEffect(()=>{
        const handleScroll = () => {
            autoscrollEnabledRef.current = false;
        }
        const scrollWindow = scrollWindowRef.current;
        scrollWindow.addEventListener("scroll", handleScroll);


        const measureTicks = measureTickRef.current;
        const waveform1 = waveform1Ref.current;
        const waveform2 = waveform2Ref.current;
        if(measureTicks){
            //need to pass it in this way so passive is false, and scrolling doesnt trigger back/next page
            measureTicks.addEventListener('wheel', handleWheel, { passive: false });
            waveform1.addEventListener('wheel',handleWheel,{passive:false});
            waveform2.addEventListener('wheel',handleWheel,{passive:false});
        }
        

        return () => {
            scrollWindow.removeEventListener("scroll", handleScroll);
            measureTicks.removeEventListener('wheel',handleWheel);
        }; 

    },[])
    
    useEffect(()=>{
        if(canvasContainerRef.current){ 
            drawCanvasContainer();
        }
    },[compactMode,zoomFactor]);

    useEffect(()=>{
        if(measureTickRef.current){
            drawMeasureTicks();
        }
    },[compactMode,zoomFactor,mouseDragStart,mouseDragEnd,BPM,compactMode])

    useEffect(()=>{
        fillSelectedRegion(waveform1Ref);
        fillSelectedRegion(waveform2Ref);
        setPlayhead();
        /*
        if(stagingTimeline && stagingTimeline.length > 0){
            drawWaveform();
        }   
        return ()=> {
            if(animation1Ref.current){
                cancelAnimationFrame(animation1Ref.current);
            }
            if(animation2Ref.current){
                cancelAnimationFrame(animation2Ref.current);
            }
        }*/
    },[audio,audio2,delayCompensation,delayCompensation2,mouseDragStart,mouseDragEnd,loadingAudio,zoomFactor,BPM,compactMode,stagingTimeline,playheadLocation]);

    function drawCanvasContainer(){
        const canvas = canvasContainerRef.current;
        const canvasContainerCtx = canvasContainerRef.current.getContext("2d");
        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;
        canvasContainerCtx.clearRect(0,0,WIDTH,HEIGHT);
        canvasContainerCtx.fillStyle = "rgb(200,200,200)"
        canvasContainerCtx.fillRect(0,0,WIDTH,HEIGHT);
        const drawBeats = () => {
            //draws the lower canvas beat lines

            canvasContainerCtx.lineWidth = 1;
            canvasContainerCtx.strokeStyle = "rgb(250,250,250)";
            canvasContainerCtx.globalAlpha = 1
            canvasContainerCtx.font = "12px sans-serif";
            const textWidth = canvasContainerCtx.measureText("888").width;
            const ticksPerQuarter = timeSignature.denominator/4;
            const secondsPerTick = 60/BPM/ticksPerQuarter;
            
            const pxPerMeasure = secondsPerTick * pxPerSecondRef.current * timeSignature.numerator;
            const resolution = Math.ceil(Math.log2(2*textWidth/pxPerMeasure))+1;
            
            const startTime = viewportDataRef.current.startTime;
            const startOnBeat = startTime % secondsPerTick;
            const startTickOffset = startOnBeat ? secondsPerTick - startOnBeat : 0;
            const startTickTime = startTickOffset + startTime;
            const startTickPx = startTickOffset * pxPerSecondRef.current;
            let x = startTickPx;
            let beatCount = Math.round(startTickTime/secondsPerTick);
            canvasContainerCtx.beginPath();
            while(x<WIDTH){
                if(resolution<1){
                    canvasContainerCtx.moveTo(x,0);
                    canvasContainerCtx.lineTo(x,HEIGHT);
                }else{
                    let measureCount = Math.floor(beatCount/timeSignature.numerator);
                    if(measureCount%(2**resolution)===0 && beatCount % timeSignature.numerator === 0){
                        canvasContainerCtx.moveTo(x,0);
                        canvasContainerCtx.lineTo(x,HEIGHT);
                    }
                }
                x += secondsPerTick*pxPerSecondRef.current;
                beatCount += 1;
            }
            
        
            canvasContainerCtx.stroke();
            
        }
        drawBeats()
        //draw the line separating the two tracks
        canvasContainerCtx.beginPath();
        canvasContainerCtx.strokeStyle = "rgb(0,0,0)";
        canvasContainerCtx.lineWidth = 1.5;
        canvasContainerCtx.globalAlpha = .3;
        canvasContainerCtx.moveTo(0,HEIGHT/2);
        canvasContainerCtx.lineTo(WIDTH,HEIGHT/2);
        canvasContainerCtx.stroke();
        canvasContainerCtx.globalAlpha = 1;
    }

    function drawMeasureTicks(){
        const tickref = measureTickRef.current
        const tickCtx = tickref.getContext("2d");
        const WIDTH = tickref.width;
        const HEIGHT = tickref.height;
        tickCtx.clearRect(0,0,WIDTH,HEIGHT);
        tickCtx.fillStyle = "rgb(175,175,175)"
        tickCtx.fillRect(0,0,WIDTH,HEIGHT);
        /*if(mouseDragEnd&&snapToGrid){
            tickCtx.fillStyle = "rgb(225,125,0,.25)"
            tickCtx.fillRect(mouseDragStart.trounded*pxPerSecond,0,(mouseDragEnd.trounded-mouseDragStart.trounded)*pxPerSecond,HEIGHT)
        }
        if(mouseDragEnd&&!snapToGrid){
            tickCtx.fillStyle = "rgb(225,125,0,.25)"
            tickCtx.fillRect(mouseDragStart.t*pxPerSecond,0,(mouseDragEnd.t-mouseDragStart.t)*pxPerSecond,HEIGHT)
        }*/
        tickCtx.lineWidth = 5;
        tickCtx.strokeStyle = "rgb(250,250,250)"
        tickCtx.lineWidth = 1;
        tickCtx.font = "12px sans-serif";
        tickCtx.fillStyle = "#1a1a1a";
        const textWidth = tickCtx.measureText("888").width; //888 is the widest number (probably?) so measure that
        
        const ticksPerQuarter = timeSignature.denominator/4;
        const secondsPerTick = 60/BPM/ticksPerQuarter;
        const pxPerMeasure = secondsPerTick * pxPerSecondRef.current * timeSignature.numerator;
        
        const resolution = Math.ceil(Math.log2(2*textWidth/pxPerMeasure))+1;

        const startTime = viewportDataRef.current.startTime;
        const startOnBeat = startTime % secondsPerTick;
        const startTickOffset = startOnBeat ? secondsPerTick - startOnBeat : 0;
        const startTickTime = startTickOffset + startTime;
        const startTickPx = startTickOffset * pxPerSecondRef.current;
        let beatCount = Math.round(startTickTime/secondsPerTick);
        let x = startTickPx;
        tickCtx.beginPath();
        while(x<WIDTH){
            let beatModulo = beatCount % timeSignature.numerator;
            tickCtx.moveTo(x,HEIGHT);
            if(beatModulo===0){
                let measureCount = 1+Math.floor(beatCount / timeSignature.numerator);
                let measureModulo = (measureCount-1)%(2**resolution);
                if(measureModulo===0){
                    tickCtx.lineTo(x,HEIGHT/2);
                    tickCtx.fillText(measureCount,x+2,4*HEIGHT/6);
                }else if(resolution>=1){
                    tickCtx.lineTo(x,5*HEIGHT/6);               
                }
                
            }else if(resolution<1){
                tickCtx.lineTo(x,5*HEIGHT/6);
            }
            x += secondsPerTick*pxPerSecondRef.current;
            beatCount += 1;
        }
        tickCtx.stroke();
    }

    function drawWaveform(){
        if(!fileSystemRef.current) return;
        console.log('message sent to worker');
        fileSystemRef.current.postMessage({type:'get_waveform_array_to_render',timeline:stagingTimeline});
    }

    if(fileSystemRef.current) {fileSystemRef.current.onmessage = ({data}) => {
        const refs = [waveform1Ref,waveform2Ref]
        for(let i=0;i<2;i++){
            const canvRef = refs[i];
            const dataArray = new Float32Array(data.bigArr);
            const canvasCtx = canvRef.current.getContext('2d');
            if(i===1){
                //canvasCtx.scale(1.5,1);
            }
            const WIDTH = canvRef.current.width;
            const HEIGHT = canvRef.current.height;
            canvasCtx.lineWidth =  1;
            canvasCtx.strokeStyle = "rgb(0,0,0)";
            canvasCtx.globalAlpha = 1.0
            
            canvasCtx.lineWidth = 1; // slightly thicker than 1px
            canvasCtx.strokeStyle = "#1c1e22";
            canvasCtx.lineCap = "round";
            canvasCtx.lineJoin = "round";

            const bufferLength = dataArray.length;
            
            //const sliceWidth = (WIDTH/128.0)/(audioCtxRef.current.sampleRate*(60/BPM));
            const scaleFactor = (bufferLength)/(audioCtxRef.current.sampleRate*128*(60/BPM));
            const samplesPerPixel = Math.ceil((bufferLength) / (WIDTH*scaleFactor));
            canvasCtx.beginPath();
            let lastx;
            //algorithm: each pixel gets min/max of a range of samples
            /*for (let x = 0; x < WIDTH; x++) {
                const start = x * samplesPerPixel
                const end = Math.min(start + samplesPerPixel, bufferLength);
                let min = 1.0, max = -1.0;
                for (let i = start; i < end; i++) {
                    const val = dataArray[i];
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
                const y1 = ((1 + min) * HEIGHT) / 2;
                const y2 = ((1 + max) * HEIGHT) / 2;
                canvasCtx.moveTo(x, y1);
                canvasCtx.lineTo(x, y2);
                lastx = x;
                
                
                if(end==bufferLength){
                    break
                }
            }*/
            for (let x = 0; x < WIDTH; x++) {
        const start = x * samplesPerPixel;
        const end = Math.min(start + samplesPerPixel, bufferLength);
        let min = 1.0, max = -1.0;

        for (let k = start; k < end; k++) { // Changed inner loop var to 'k' to avoid shadowing 'i'
            const val = dataArray[k];
            if (val < min) min = val;
            if (val > max) max = val;
        }

        let y1, y2;

        if (i === 1) {
            // --- LOGARITHMIC (dB) SCALE CALCULATION ---
            /*const dbFloor = -60; // Anything below -60dB will be at the center line
            
            // Helper to convert linear to normalized 0-1 log scale
            const toLogY = (val) => {
                const absVal = Math.abs(val);
                if (absVal < 0.0001) return 0; // Avoid log(0)
                
                // Calculate dB: 20 * log10(amplitude)
                const db = 20 * Math.log10(absVal);
                
                // Map dB range [-60, 0] to normalized [0, 1]
                // (db - floor) / (max - floor) -> (db + 60) / 60
                const normalized = Math.max(0, (db - dbFloor) / -dbFloor);
                return normalized * Math.sign(val); 
            };

            const logMin = toLogY(min);
            const logMax = toLogY(max);

            // Map normalized log values to canvas HEIGHT
            y1 = ((1 + logMin) * HEIGHT) / 2;
            y2 = ((1 + logMax) * HEIGHT) / 2;

            canvasCtx.moveTo(x, y1);
            canvasCtx.lineTo(x, y2);
            lastx = x;
            if(end===bufferLength){
                break;
            }*/
            const sMin = Math.sqrt(Math.abs(min)) * Math.sign(min);
            const sMax = Math.sqrt(Math.abs(max)) * Math.sign(max);
            
            y1 = ((1 + sMin) * HEIGHT) / 2;
            y2 = ((1 + sMax) * HEIGHT) / 2;
            
            canvasCtx.moveTo(x, y1);
            canvasCtx.lineTo(x, y2);
            lastx = x;
            if(end===bufferLength) break;
        } else {
            // --- STANDARD LINEAR SCALE ---
            y1 = ((1 + min) * HEIGHT) / 2;
            y2 = ((1 + max) * HEIGHT) / 2;
            canvasCtx.moveTo(x, y1);
            canvasCtx.lineTo(x, y2);
            lastx = x;
            if(end===bufferLength){
                break;
            }
        }
        canvasCtx.moveTo(0,HEIGHT/2);
        canvasCtx.lineTo(lastx,HEIGHT/2);
        canvasCtx.stroke();
        canvasCtx.fillStyle = "rgb(0,125,225)" //"rgb(0,200,160)"
        canvasCtx.globalAlpha = .12
        //canvasCtx.fillRect(0,0,lastx,HEIGHT)
    
    }
            
        }
    }


    }
    function fillSelectedRegion(waveformRef){
        const canvasCtx = waveformRef.current.getContext("2d");
        const WIDTH = waveformRef.current.width;
        const HEIGHT = waveformRef.current.height;
        canvasCtx.clearRect(0,0,WIDTH,HEIGHT);   
        canvasCtx.globalAlpha = .2
        const viewportStartTime = viewportDataRef.current.startTime;
        const viewportEndTime = viewportDataRef.current.endTime;
        const totalTime = viewportEndTime - viewportStartTime;
        const rectStart = Math.max(viewportStartTime,mouseDragStartCloneRef.current.trounded);
        if(!mouseDragEndCloneRef.current) return;
        const rectEnd = Math.min(viewportEndTime,mouseDragEndCloneRef.current.trounded);
        if(rectEnd < viewportStartTime || rectStart > viewportEndTime) return;
        const rectStartPx = WIDTH * (rectStart-viewportStartTime)/totalTime;
        const rectEndPx = WIDTH * (rectEnd - viewportStartTime)/totalTime;
        canvasCtx.fillStyle = "rgb(75,75,75,.5)"
        canvasCtx.fillRect(rectStartPx,0,rectEndPx-rectStartPx,HEIGHT);
    }

    function setPlayhead(){
        const startTime = viewportDataRef.current.startTime;
        const endTime = viewportDataRef.current.endTime;
        const totalTime = endTime - startTime;
        const playheadLocation = playheadLocationRef.current;
        if(playheadLocation < startTime || playheadLocation > endTime){
            playheadRef.current.style.display = "none";
            return;
        }
        const playheadViewportTime = (playheadLocation - startTime)/totalTime;
        const playheadPx = playheadViewportTime * WAVEFORM_WINDOW_LEN;
        playheadRef.current.style.display = "block";
        playheadRef.current.style.transform = `translateX(${playheadPx}px)`
    }

    function fillLoadingAudio(waveformRef,textPos,track){
            const canvasCtx = waveformRef.current.getContext("2d");
            const WIDTH = waveformRef.current.width;
            const HEIGHT = waveformRef.current.height;

            canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

            // Shaded loading region
            canvasCtx.globalAlpha = 0.12;
            canvasCtx.fillStyle = "rgb(0,125,225)";
            canvasCtx.fillRect(0, 0, loadingAudio.time * pxPerSecond, HEIGHT);

            // Sine wave styling
            canvasCtx.globalAlpha = 1;
            canvasCtx.lineWidth = 1;
            canvasCtx.strokeStyle = "rgb(250,250,250)";

            canvasCtx.save();

            canvasCtx.beginPath();

            canvasCtx.moveTo(0,0);
            canvasCtx.lineTo(0,HEIGHT);
            canvasCtx.lineTo(loadingAudio.time * pxPerSecond,HEIGHT);
            canvasCtx.lineTo(loadingAudio.time * pxPerSecond,0);

            canvasCtx.clip();

            canvasCtx.font = "14px sans-serif"

            const textToFill = track==2?"Loading audio...":"Sending audio...";

            for(let i=-68; i < loadingAudio.time * pxPerSecond + 68; i+=200){
                canvasCtx.fillStyle = "rgb(0,0,0)"
                canvasCtx.fillText(textToFill,textPos + i,HEIGHT/2);
            }
            canvasCtx.stroke();
            canvasCtx.restore();
            if(track==1){
                animation1Ref.current = requestAnimationFrame(()=>fillLoadingAudio(waveformRef,(textPos+1)%200,track));
            }else{
                animation2Ref.current = requestAnimationFrame(()=>fillLoadingAudio(waveformRef,(textPos+1)%200,track));
            }
            
    }

    const handleCanvasMouseDown = (e) => {
        const calculateDragPos = (x,type) => {
            const startTime = viewportDataRef.current.startTime;
            const endTime = viewportDataRef.current.endTime;
            const totalViewportTime = endTime - startTime;
            const t = startTime + totalViewportTime * x/WAVEFORM_WINDOW_LEN;
            const ticksPerQuarter = timeSignature.denominator/4;
            const secondsPerTick = 60/BPM/ticksPerQuarter;
            let pos;
            if(type==="start"){
                pos = startTime + secondsPerTick - (startTime % secondsPerTick);
            }else{
                pos = endTime - (endTime % secondsPerTick);
            }
            let trounded;
            if(type==="start" && t<pos){
                trounded = pos - secondsPerTick;
            }else if(type==="end"&& t>pos){
                trounded = pos + secondsPerTick;
            }else if(type==="start"){
                while(pos+secondsPerTick < t){
                    pos += secondsPerTick;
                }
                trounded = pos;
            }else{
                while(pos-secondsPerTick > t){
                    pos -= secondsPerTick;
                }
                trounded = pos;
            }
            return {t,trounded};
        }

        if(currentlyPlayingAudio.current) return;
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const x = (e.clientX-rect.left)
        
        
        
        //const rounded = rect.width*Math.floor(x*128/rect.width)/128;

        const coords = calculateDragPos(x,"start");
        setMouseDragStart(coords);
        setMouseDragEnd(null);
        mouseDragStartRef.current = coords;
        mouseDragEndRef.current = null;
        isDraggingPlaybackRegion.current = true;

        const handleCanvasMouseMove = (e) => {
            if(!isDraggingPlaybackRegion.current) return;
                const rect = canvasContainerRef.current.getBoundingClientRect();
                const x = e.clientX-rect.left
                const mousedragstart = mouseDragStartRef.current;
                const startTime = viewportDataRef.current.startTime;
                const endTime = viewportDataRef.current.endTime;
                const ticksPerQuarter = timeSignature.denominator/4;
                const secondsPerTick = 60/BPM/ticksPerQuarter;
                const totalViewportTime = endTime - startTime;
                //if mouse has been dragged 5 pixels or less, doesn't count as a playback region
                if(x<0){
                    const mousedragend = null//{t:0,trounded:0};
                    setMouseDragEnd(mousedragend);
                    mouseDragEndRef.current = mousedragend;
                }else if(x>rect.width){
                    const mousedragend = {t:endTime,trounded:endTime + secondsPerTick-(endTime%secondsPerTick)};
                    setMouseDragEnd(mousedragend);
                    mouseDragEndRef.current = mousedragend;
                }else if(Math.abs(mousedragstart.t*pxPerSecond-x)>5){
                        const mousedragend = calculateDragPos(x,"end");
                        setMouseDragEnd(mousedragend);
                        mouseDragEndRef.current = mousedragend;
                }
        }
        const handleCanvasMouseUp = (e) => {
            
            isDraggingPlaybackRegion.current = false;
            const rect = canvasContainerRef.current.getBoundingClientRect();
            const x = Math.max(0,Math.min(rect.width,e.clientX-rect.left))
            const mousedragstart = mouseDragStartRef.current;
            const mousedragend = mouseDragEndRef.current;
            const startTime = viewportDataRef.current.startTime;
            const endTime = viewportDataRef.current.endTime;
            if(Math.abs((mousedragstart.t-startTime)*pxPerSecondRef.current-x)<=5){
                setPlayheadLocation(mousedragstart.t)
                setMouseDragEnd(null);
                if(numConnectedUsersRef.current >= 2){
                    socket.current.emit("send_play_window_to_server",{
                        mouseDragStart:mousedragstart,mouseDragEnd:null,roomID,snapToGrid
                    })
                    socket.current.emit("comm_event",{
                        locationByMeasure:convertTimeToMeasuresRef.current(mousedragstart.t),
                        type:"playhead_moved_by_partner",
                        roomID});
                }
            }else{
                //check if region has been dragged forwards or backwards. Always put start at the left
                const pos = calculateDragPos(x,"end");
                if(x/pxPerSecondRef.current>=mousedragstart.t-startTime){
                    if(snapToGrid){
                        setPlayheadLocation(mousedragstart.trounded)
                    }else{
                        setPlayheadLocation(mousedragstart.t)
                    }
                    setMouseDragEnd(pos);
                }else{
                    const {t,trounded} = calculateDragPos(x,"start");

                    if(snapToGrid){
                        setPlayheadLocation(trounded)
                    }else{
                        setPlayheadLocation(t)
                    }
                    setMouseDragStart({trounded,t})
                    setMouseDragEnd(mousedragstart)
                }
                if(numConnectedUsersRef.current >= 2){
                    socket.current.emit("send_play_window_to_server",{
                        mouseDragStart:mousedragstart,mouseDragEnd:pos,roomID,snapToGrid
                    })
                    socket.current.emit("comm_event",{
                        roomID,
                        type:"region_selected_by_partner",
                        mouseDragStart:convertTimeToMeasuresRef.current(mousedragstart.trounded),
                        mouseDragEnd:convertTimeToMeasuresRef.current(pos.trounded),
                    })
                }
            }
            window.removeEventListener("mousemove",handleCanvasMouseMove)
            window.removeEventListener("mouseup",handleCanvasMouseUp)    
        };
        window.addEventListener('mousemove',handleCanvasMouseMove)
        window.addEventListener('mouseup',handleCanvasMouseUp)
    };

    const handleWheel = (e) => {
        
        e.preventDefault();
        const startTime = viewportDataRef.current.startTime;
        const endTime = viewportDataRef.current.endTime;
        const newStart = startTime+(e.deltaX/25);
        const newEnd = endTime + (e.deltaX/25);
        if(newStart<0){
            viewportDataRef.current.startTime = 0;
            viewportDataRef.current.endTime = endTime - startTime;
        }else if(newEnd>15*60){
            viewportDataRef.current.endTime = 15 * 60;
            viewportDataRef.current.startTime = startTime + (15*60 - endTime);
        }else{
            viewportDataRef.current.startTime = newStart;
            viewportDataRef.current.endTime = newEnd;
        };
        drawMeasureTicks();
        drawCanvasContainer();
        fillSelectedRegion(waveform1Ref);
        fillSelectedRegion(waveform2Ref);
        setPlayhead();
    }


    const handleMovePlayhead = (e) => {
        const rect = scrollWindowRef.current.getBoundingClientRect()
        if(e.clientY-rect.y < 30) return;
        const handleMouseMove = (e) => {
            const rect = waveform1Ref.current.getBoundingClientRect();
            const x = e.clientX-rect.left
            
            if(mouseDragEnd){
                if((!snapToGrid && e.clientX-rect.x>mouseDragEnd.t*pxPerSecond)||(snapToGrid&&e.clientX-rect.x>mouseDragEnd.trounded*pxPerSecond)){
                    return             
                }
                
            }
            if(x<0){
                setPlayheadLocation(0);
            }
            else if(x>rect.width){
                setPlayheadLocation(rect.width/pxPerSecond)
            }else{
                setPlayheadLocation(x/pxPerSecond);
            }
            const xrounded = rect.width*Math.floor(x*128/rect.width)/128
            setMouseDragStart({trounded:xrounded/pxPerSecond,t:x/pxPerSecond})
        }
        const handleMouseUp = (e) => {
            //since storing the function in the event listener with playheadLocation stored will result in a stale value
            //we have to do this nonsense
            setPlayheadLocation(prev=>{
                if(mouseDragEnd){
                    if((snapToGrid&&(mouseDragEnd.trounded-prev)*pxPerSecond<rect.width/128/2)||
                    (!snapToGrid&&(mouseDragEnd.t-prev)*pxPerSecond<rect.width/128/2)){
                        setMouseDragEnd(null)
                }}
                return prev
            })
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

    }    

    return <div className="grid overflow-x-auto relative border-black border-0 shadow-sm shadow-blak grid-cols-2 scrollwindow"
                style={{width:WAVEFORM_WINDOW_LEN,height:Math.floor(150*compactMode)}} ref={scrollWindowRef}
                >
                
                <canvas className="row-start-1 col-start-2"
                    style={{width:900,height:Math.floor(35*compactMode)}}
                    width={900}
                    height={Math.floor(35*compactMode)}
                    ref={measureTickRef}
                    
                >
                    
                </canvas>
                <canvas
                    ref={canvasContainerRef}
                    width={900}
                    height={Math.floor(115*compactMode)}
                    style={{width:`900px`,height:Math.floor(115*compactMode),imageRendering:"pixelated"}}
                    className="row-start-2 col-start-2"
                    onMouseDown={handleCanvasMouseDown}
                    >
                    
                </canvas>
                <div className="row-start-2 col-start-3"
                    ref={waveformContainerRef}>
                    {/*<div className="absolute bg-blue-500/15 w-35 h-14 border-r-2 border-t-2 border-b-2 rounded-r-md border-gray-300"
                        ref={testRef}
                    >

                    </div>*/}
                    {/*<div className="bg-black w-24 h-8"
                        onClick={(e)=>console.log('black clicked',e.clientX)}
                    >
                    </div>
                    <div className="bg-red-500 w-24 h-8"
                        style={{transform:"scaleX(.75)"}}
                        onClick={(e)=>{
                            console.log('red clicked')
                            console.log(e.clientX);
                        }}
                    >
                    </div>*/}
                    <canvas 
                    ref={waveform1Ref}
                    width={900}
                    height={Math.floor(58*compactMode)}
                    style={{width:900,imageRendering:"pixelated",height:Math.floor(58*compactMode)}} 
                    className={`row-start-2 col-start-3`}
                    onMouseDown={handleCanvasMouseDown}
                    >
                    </canvas>
                    
                    <canvas
                    ref={waveform2Ref}
                    height={Math.floor(57*compactMode)}
                    width={900}
                    style={{width:900,imageRendering:"pixelated",height:Math.floor(57*compactMode)}}
                    onMouseDown={handleCanvasMouseDown}
                    >

                    </canvas>
                    
                </div>
                
                {<div ref={playheadRef} style={{position:"absolute",top:0,bottom:0,left:-1,
                    width:"4px"}}
                    onMouseDown={handleMovePlayhead}
                    className="flex flex-col items-center"
                    onDragStart={(e) => e.preventDefault()}
                    >
                    <div style={{
                            width: "8px",
                            height: Math.floor(8*compactMode),
                            borderRadius: "50%",
                            background: "red",
                            marginTop: Math.floor(26*compactMode),
                            transform:"translateX(-3px)",
                            }}
                            >
                    
                    </div>
                    <div
                    style={{
                        position:"absolute",top:Math.floor(25*compactMode),bottom:0,
                        width:"2px",background:"red",
                    }}
                    ></div>
                </div>}
            </div> 
}
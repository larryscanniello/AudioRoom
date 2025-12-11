import { useEffect,useRef,useState } from "react";
import "./RecorderInterface.css";

export default function RecorderInterface({
    audio,BPM,mouseDragEnd,zoomFactor,delayCompensation,
    measureTickRef,mouseDragStart,audioCtxRef,
    waveform1Ref,waveform2Ref,playheadRef,setMouseDragStart,
    setMouseDragEnd,socket,roomID,scrollWindowRef,
    playheadLocation,setPlayheadLocation,snapToGrid,
    currentlyPlayingAudio,numConnectedUsersRef,audio2,delayCompensation2,
    WAVEFORM_WINDOW_LEN,autoscrollEnabledRef,setZoomFactor,
    compactMode,loadingAudio,pxPerSecondRef,convertTimeToMeasuresRef
}){

    const canvasContainerRef = useRef(null);
    const waveformContainerRef = useRef(null);
    const isDraggingPlaybackRegion = useRef(false);
    const mouseDragStartRef = useRef(mouseDragStart);
    const mouseDragEndRef = useRef(mouseDragEnd);
    const audio2Ref = useRef(null);
    const animation1Ref = useRef(null);
    const animation2Ref = useRef(null);

    //Used to set playhead location in the DOM, and also for calculations on the canvas
    const pxPerSecond = Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor)/(128*60/BPM);
    pxPerSecondRef.current = pxPerSecond;
    const playheadPx = playheadLocation*pxPerSecond;

    audio2Ref.current = audio2;

    convertTimeToMeasuresRef.current = (time) => {
                const locationinBeats = (((time * pxPerSecond)+1)/ measureTickRef.current.width)*128; //add 1 because, look at the start of the window - the first line isn't there
                return (1+Math.floor(locationinBeats/4)).toString() + "." + (1+Math.floor(locationinBeats%4)).toString();
    }

    useEffect(()=>{
        const handleScroll = () => {
            autoscrollEnabledRef.current = false;
        }
        const scrollWindow = scrollWindowRef.current;
        scrollWindow.addEventListener("scroll", handleScroll);
        return () => scrollWindow.removeEventListener("scroll", handleScroll);
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
        if(loadingAudio && loadingAudio.track==1){
            fillLoadingAudio(waveform1Ref,0,1);
        }else if(audio){
            drawWaveform(waveform1Ref,audio,delayCompensation[0],1);
        }   
        fillSelectedRegion(waveform2Ref);
        if(audio2){
            drawWaveform(waveform2Ref,audio2,delayCompensation2[0],2);
        }else if(loadingAudio && loadingAudio.track==2){
            fillLoadingAudio(waveform2Ref,0,2);
        }
        return ()=> {
            if(animation1Ref.current){
                cancelAnimationFrame(animation1Ref.current);
            }
            if(animation2Ref.current){
                cancelAnimationFrame(animation2Ref.current);
            }
        }
    },[audio,audio2,delayCompensation,delayCompensation2,mouseDragStart,mouseDragEnd,loadingAudio,zoomFactor,BPM,compactMode]);

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
            canvasContainerCtx.beginPath();
            canvasContainerCtx.globalAlpha = 1
            const sliceWidth =  WIDTH / 128;  // Space between each of the 128 lines
            let audioLength, bufferLength;
            if(audio){
                const dataArray = audio.getChannelData(0);
                bufferLength = dataArray.length;
                audioLength = audioCtxRef.current.sampleRate*128*(60/BPM)
            }
            for(let i = 0; i <= 128; i++) {
                if(audio){
                    if(i/128<bufferLength/audioLength){
                        //temporarily defunct, omits beat lines where waveform is
                        //continue
                    }
                }
                if(zoomFactor<8){
                    //if zoomed in far enough, only show beat line every measure
                    if(i%4>=1){
                        continue
                    }
                }
                const x = Math.round(i * sliceWidth);   
                canvasContainerCtx.moveTo(x, 0);
                canvasContainerCtx.lineTo(x, HEIGHT);
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
        if(mouseDragEnd&&snapToGrid){
            tickCtx.fillStyle = "rgb(225,125,0,.25)"
            tickCtx.fillRect(mouseDragStart.trounded*pxPerSecond,0,(mouseDragEnd.trounded-mouseDragStart.trounded)*pxPerSecond,HEIGHT)
        }
        if(mouseDragEnd&&!snapToGrid){
            tickCtx.fillStyle = "rgb(225,125,0,.25)"
            tickCtx.fillRect(mouseDragStart.t*pxPerSecond,0,(mouseDragEnd.t-mouseDragStart.t)*pxPerSecond,HEIGHT)
        }
        tickCtx.lineWidth = 5;
        const sliceWidth = WIDTH/128;
        tickCtx.strokeStyle = "rgb(250,250,250)"
        tickCtx.lineWidth = 1;
        tickCtx.font = "12px sans-serif";
        tickCtx.fillStyle = "#1a1a1a";
        for(let i=1;i<=128;i++){
            tickCtx.moveTo(i*sliceWidth,HEIGHT);
            if(i%4==0){
                tickCtx.lineTo(i*sliceWidth,HEIGHT/2)
                tickCtx.fillText((i/4), (i-4)*(sliceWidth)+(2*sliceWidth/12), 4*HEIGHT/6); 

            }else{
                tickCtx.lineTo(i*sliceWidth,5*HEIGHT/6)
            }
        }
        tickCtx.stroke();
    }

    function drawWaveform(canvRef,drawWaveformAudio,delayComp,tracknum){
        const canvasCtx = canvRef.current.getContext('2d');
        const WIDTH = canvRef.current.width;
        const HEIGHT = canvRef.current.height;
        canvasCtx.lineWidth =  1;
        canvasCtx.strokeStyle = "rgb(0,0,0)";
        canvasCtx.globalAlpha = 1.0
        
        canvasCtx.lineWidth = 1.5; // slightly thicker than 1px
        canvasCtx.strokeStyle = "#1c1e22";
        canvasCtx.lineCap = "round";
        canvasCtx.lineJoin = "round";

        const dataArray = drawWaveformAudio.getChannelData(0);
        const bufferLength = dataArray.length;
        
        //const sliceWidth = (WIDTH/128.0)/(audioCtxRef.current.sampleRate*(60/BPM));
        const scaleFactor = (bufferLength)/(audioCtxRef.current.sampleRate*128*(60/BPM));
        const samplesPerPixel = Math.ceil((bufferLength) / (WIDTH*scaleFactor));
        canvasCtx.beginPath();
        let lastx;
        //algorithm: each pixel gets min/max of a range of samples
        for (let x = 0; x < WIDTH; x++) {
            const start = x * samplesPerPixel+delayComp
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
        }
        canvasCtx.moveTo(0,HEIGHT/2);
        canvasCtx.lineTo(lastx,HEIGHT/2);
        canvasCtx.stroke();
        canvasCtx.fillStyle = tracknum===2 ? "rgb(0,125,225)" : "rgb(0,200,160)"
        canvasCtx.globalAlpha = .12
        canvasCtx.fillRect(0,0,lastx,HEIGHT)
    }

    function fillSelectedRegion(waveformRef){
        const canvasCtx = waveformRef.current.getContext("2d");
        const WIDTH = waveformRef.current.width;
        const HEIGHT = waveformRef.current.height;
        canvasCtx.clearRect(0,0,WIDTH,HEIGHT);   
        canvasCtx.globalAlpha = .2
        if(mouseDragEnd&&snapToGrid){
            canvasCtx.fillStyle = "rgb(75,75,75,.5)"
            canvasCtx.fillRect(mouseDragStart.trounded*pxPerSecond,0,(mouseDragEnd.trounded-mouseDragStart.trounded)*pxPerSecond,HEIGHT)
        }
        if(mouseDragEnd&&!snapToGrid){
            canvasCtx.fillStyle = "rgb(75,75,75,.5)"
            canvasCtx.fillRect(mouseDragStart.t*pxPerSecond,0,(mouseDragEnd.t-mouseDragStart.t)*pxPerSecond,HEIGHT)
        }
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
        if(currentlyPlayingAudio.current) return;
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const x = (e.clientX-rect.left)
        const rounded = rect.width*Math.floor(x*128/rect.width)/128;
        const coords = {trounded:rounded/pxPerSecond, t:x/pxPerSecond}
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
                //if mouse has been dragged 5 pixels or less, doesn't count as a playback region
                if(x<0){
                    const mousedragend = {t:0,trounded:0};
                    setMouseDragEnd(mousedragend);
                    mouseDragEndRef.current = mousedragend;
                }else if(x>rect.width){
                    const mousedragend = {t:rect.width,trounded:rect.width};
                    setMouseDragEnd(mousedragend);
                    mouseDragEndRef.current = mousedragend;
                }else if(Math.abs(mousedragstart.t*pxPerSecond-x)>5){
                        const mousedragend = {t:x/pxPerSecond,trounded:rect.width*Math.ceil(x*128/rect.width)/128/pxPerSecond}
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
            if(Math.abs(mousedragstart.t*pxPerSecond-x)<=5){
                setPlayheadLocation(mousedragstart.t)
                setMouseDragEnd(null);
                if(numConnectedUsersRef.current >= 2){
                    socket.current.emit("send_play_window_to_server",{
                        mouseDragStart:mousedragstart,mouseDragEnd:null,roomID,snapToGrid
                    })
                    socket.current.emit("comm_playhead_moved_click_to_other_client_to_server",{locationByMeasure:convertTimeToMeasuresRef.current(mousedragstart.t),roomID});
                }
            }else{
                const endrounded = rect.width*Math.ceil(x*128/rect.width)/128
                const pos = {trounded:endrounded/pxPerSecond, t:x/pxPerSecond}
                //check if region has been dragged forwards or backwards. Always put start at the left

                if(x/pxPerSecond>=mousedragstart.t){
                    if(snapToGrid){
                        setPlayheadLocation(mousedragstart.trounded)
                    }else{
                        setPlayheadLocation(mousedragstart.t)
                    }
                    setMouseDragEnd(pos);
                }else{
                    const xrounded = rect.width*Math.floor(x*128/rect.width)/128
                    if(snapToGrid){
                        setPlayheadLocation(xrounded/pxPerSecond)
                    }else{
                        setPlayheadLocation(x/pxPerSecond)
                    }
                    setMouseDragStart({trounded:xrounded/pxPerSecond,t:x/pxPerSecond})
                    setMouseDragEnd(mousedragstart)
                }
                if(numConnectedUsersRef.current >= 2){
                    socket.current.emit("send_play_window_to_server",{
                        mouseDragStart:mousedragstart,mouseDragEnd:pos,roomID,snapToGrid
                    })
                    socket.current.emit("comm_region_selected_client_to_server",{
                        roomID,
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
                    style={{width:Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor),height:Math.floor(35*compactMode)}}
                    width={Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor)}
                    height={Math.floor(35*compactMode)}
                    ref={measureTickRef}
                    onMouseDown={handleCanvasMouseDown}
                >
                    
                </canvas>
                <canvas
                    ref={canvasContainerRef}
                    width={Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor)}
                    height={Math.floor(115*compactMode)}
                    style={{width:`${Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor)}px`,height:Math.floor(115*compactMode),imageRendering:"pixelated"}}
                    className="row-start-2 col-start-2"
                    >
                    
                </canvas>
                <div className="row-start-2 col-start-3"
                    ref={waveformContainerRef}>
                    <canvas 
                    ref={waveform1Ref}
                    width={Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor)}
                    height={Math.floor(58*compactMode)}
                    style={{width:Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor),imageRendering:"pixelated",height:Math.floor(58*compactMode)}} 
                    className={`row-start-2 col-start-3`}
                    onMouseDown={handleCanvasMouseDown}
                    >
                    </canvas>
                    <canvas
                    ref={waveform2Ref}
                    height={Math.floor(57*compactMode)}
                    width={Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor)}
                    style={{width:Math.floor(WAVEFORM_WINDOW_LEN*zoomFactor),imageRendering:"pixelated",height:Math.floor(57*compactMode)}}
                    onMouseDown={handleCanvasMouseDown}
                    >

                    </canvas>
                </div>
                
                {<div ref={playheadRef} style={{position:"absolute",top:0,bottom:0,left:-1,
                    width:"4px", transform:`translateX(${playheadPx}px)`}}
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
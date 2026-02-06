
export default function UpperLeftBox({params}){
    
    const {LEFT_CONTROLS_WIDTH,compactMode,monitoringOn,setMonitoringOn,
                        numConnectedUsersRef,currentlyPlayingAudio,currentlyRecording,socket,roomID} = params;

    return <div className="bg-[rgb(86,86,133)] flex flex-col justify-center items-center text-xs text-white"
                            style={{width:`${LEFT_CONTROLS_WIDTH}px`,height:Math.floor(35*compactMode)}}
                    >
                        <button className={"border-1 border-black rounded-2xl px-1 " + (monitoringOn?"bg-amber-600":"bg-[rgb(106,106,133)")}
                        onClick={()=>setMonitoringOn(prev=>{
                            if(numConnectedUsersRef.current >= 2 && !currentlyPlayingAudio.current && !currentlyRecording.current){ 
                                socket.current.emit("monitoring_change_client_to_server",{roomID,status:!prev});
                                return !prev;
                            }
                            return prev;})}
                        >Partner Monitor</button>
            </div>

}
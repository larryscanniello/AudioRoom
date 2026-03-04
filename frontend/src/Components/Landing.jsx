import { Circle,Pointer,Play,Wifi } from "lucide-react"
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

//bg-[rgb(30,175,220)]/40

export default function Landing() {
  const [showUnderConstruction,setShowUnderConstruction] = useState(false);
  const [goToRoomValue,setGoToRoomValue] = useState("");
  const navigate = useNavigate();

  return <div className="min-h-screen grid grid-cols-[1fr_auto_1fr]">
        <div/>
        <div className="bg-[rgba(89,79,79,0.5)] px-10 py-8">
        <div className="flex items-center justify-center flex-col gap-4">
          <h6 className="text-9xl bungee-outline-regular text-[rgba(37,206,232,0.9)]">WaveReel</h6>
          <h6 className="text-9xl bungee-outline-regular text-[rgba(37,206,232,0.9)]">Sessions</h6>
          <h4 className="text-2xl text-[rgba(110,152,159,0.9)]">Video chat + shared web DAW</h4>
        </div>
        
        <div className="w-full flex flex-col items-center text-[rgba(110,152,159,0.9)] mt-8">
            <ul className="text-xl flex flex-col gap-3"> 
              <li className="flex items-start"><Wifi color={"rgba(209, 160, 233, 0.8)"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/><div>Join a room and connect with a partner</div></li>
              <li className="flex items-start"><Circle color={"rgba(255,0,0,0.9)"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/><div>Record with any mic - you and your partner take turns</div></li>
              <li className="flex items-start"><Pointer color={"rgba(62, 85, 206, 0.8)"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/>Arrange on the staging track, bounce and layer on the mix track</li>
              <li className="flex items-start"><Play color={"rgba(0,255,0,0.9)"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/>Synchronized playback lets both hear the same thing at the same time</li>
            </ul>
        </div>
        <div className="w-full flex flex-col items-center mt-8">
          <div className="flex flex-col items-center gap-4">
              <button className="text-2xl text-[rgba(255,255,255,0.7)]"
              >                Join an existing room:</button>
              {<form onSubmit={(e)=>{e.preventDefault();navigate('/room/'+goToRoomValue)}} className="mb-0">
                  <input
                  className='border w-64 h-8 border-gray-700 px-1 rounded-md bg-gray-100'
                  value={goToRoomValue}
                  onChange={(e) => {
                    setGoToRoomValue(e.target.value);
                  }}
                  placeholder="Enter Room ID"
                  />
                  <button type="submit" className="ml-3 pl-2 pr-2 bg-blue-200 rounded-md border-1 border-black hover:bg-blue-400">
                    Go
                  </button>
              </form>}
          </div>
        </div>
        <div className="w-full flex flex-col items-center mt-8">
            <div className="flex flex-col items-center gap-4">
              <div className="text-2xl text-[rgba(255,255,255,0.7)]">
                  Make a new room:
              </div>
              <a className="pt-2 pb-2 pl-8 pr-8 rounded-3xl bg-[rgba(144,88,88,0.7)] hover:bg-[rgba(144,88,88,0.9)] flex flex-row"
              href={import.meta.env.VITE_BACKEND_URL+"/auth/google"}>
                <div className="text-[rgba(255,255,255,0.7)]">Log in with</div> 
                <FcGoogle style={{transform:"scale(1.2)",marginTop:"2.5px",marginLeft:"8px"}}/>
            </a>
            </div>
        </div>
        </div>
        <div/>
  </div>
}
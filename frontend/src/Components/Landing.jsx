import AudioBoard from "./RoomComponents/AudioBoard.jsx"
import { Circle,Pointer,Play,Wifi } from "lucide-react"
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

//bg-[rgb(30,175,220)]/40

export default function Landing() {
  const [showUnderConstruction,setShowUnderConstruction] = useState(false);
  const [goToRoomValue,setGoToRoomValue] = useState("");
  const navigate = useNavigate();

  return <div>
        <div className="flex items-center justify-center flex-col">
          <h6 className="mt-8 text-6xl">AudioBoard</h6>
          <h4 className="mt-4 text-2xl">A whiteboard for real-time music collaboration</h4>
        </div>
        <div className="p-4"> 
          <AudioBoard isDemo={true}/>
        </div>
        
        <div className="w-full flex flex-col items-center">
            <ul className="pt-4 text-xl flex flex-col "> 
              <li className="p flex"><Wifi color={"purple"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/><div>Join a room and connect with a music teacher, jam partner, or other collaborator</div></li>
              <li className="p flex"><Circle color={"red"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/><div>Record into the first track; your partner records into the second track</div></li>
              <li className="p flex"><Pointer color={"blue"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/>Drag the mouse to select a playback region</li>
              <li className="p flex"><Play color={"green"} size={25} 
              className="w-8 h-8 p-2 mr-2 rounded border-gray-400"/>Synchronized playback lets both hear the same thing at the same time</li>
            </ul>
        </div>
        <div className="w-full flex flex-col items-center pt-4">
          <div className="flex flex-col items-center">
              <button className="text-2xl"
              >                Join an existing room:</button>
              {<form onSubmit={(e)=>{e.preventDefault();navigate('/room/'+goToRoomValue)}} className="">
                  <input
                  className='border w-64 border-gray-700 mb-5 pt-1 pb-1 pl-1 rounded-md bg-gray-100'
                  value={goToRoomValue}
                  onChange={(e) => {
                    setGoToRoomValue(e.target.value);
                  }}
                  placeholder="Enter Room ID"
                  />
                  <button type="submit" className="ml-3 pt-1 pb-1 pl-2 pr-2 bg-blue-200 rounded-md border-1 border-black hover:bg-blue-400">
                    Go
                  </button>
              </form>}
          </div>
        </div>
        <div className="w-full flex flex-col items-center pt-4">
            <div className="flex flex-col items-center">
              <div className="text-2xl">
                  Make a new room:
              </div>
              <a className="pt-2 pb-2 pl-8 pr-8 rounded-3xl bg-indigo-300 hover:bg-indigo-400 flex flex-row"
              href={import.meta.env.VITE_BACKEND_URL+"/auth/google"}>
                <div>Log in with</div> 
                <FcGoogle style={{transform:"scale(1.2)",marginTop:"2.5px",marginLeft:"8px"}}/>
            </a>
            </div>
        </div>
        
  </div>
  

}
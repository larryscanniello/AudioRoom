import { useContext,useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthProvider";

export default function Home(){
    const [goToRoomValue,setGoToRoomValue] = useState('');
    const [showExistingRoom,setShowExistingRoom] = useState(false);

    const auth = useContext(AuthContext);
      if (!auth) {
        throw new Error("Home must be used inside AuthProvider");
      }
    const [isAuthorized, setIsAuthorized] = auth;
    const navigate = useNavigate();
    
    const handleNewRoom = async () => {
        let roomID;
        await fetch(import.meta.env.VITE_BACKEND_URL+"/newroom",{
            credentials: "include",
            method: "POST",
        })
        .then(res=>res.json())
        .then(resjson => {
            roomID = resjson.id
        })
        navigate('/room/'+roomID)
    }

    const goToRoom = async () => {
        navigate('/room/'+goToRoomValue)
    }

    let i=0;
    if(isAuthorized){
        const username = isAuthorized.user.username
        while(username[i]!=" "){
            i+=1
        }
    }

    return <div>{isAuthorized ? <div className="flex flex-col items-center pt-20">
        
        <div className="w-100 bg-gray-100 rounded-2xl flex flex-col items-center">
            <div className="mt-5 text-2xl">Welcome to AudioBoard, {isAuthorized.user.username.slice(0,i)}!</div>
            <button onClick={handleNewRoom} className="bg-blue-300 mt-5 hover:bg-indigo-400 pl-8 pr-8 pt-2 pb-2 rounded-2xl text-2xl">
                New room</button>
            <button className="bg-blue-300 mt-5 mb-5 hover:bg-indigo-400 pl-8 pr-8 pt-2 pb-2 rounded-2xl text-2xl"
                onClick={()=>setShowExistingRoom(true)}
            >
                Existing room</button>
            {showExistingRoom && <form onSubmit={goToRoom}>
                <input
                className='border w-64 border-gray-700 mb-5 pt-1 pb-1 pl-1 rounded-md bg-gray-100'
                value={goToRoomValue}
                onChange={e => setGoToRoomValue(e.target.value)}
                placeholder="Enter Room ID"
                />
            </form> }
        </div>
        </div>: <div>Not authorized</div>}</div>
}

type ToggleMicButtonProps = {
    gainNodesRef: React.RefObject<{local: GainNode | null, remote: GainNode | null}>;
    micsMuted: {local: boolean, remote: boolean};
    setMicsMuted: React.Dispatch<React.SetStateAction<{local: boolean, remote: boolean}>>;
}

export default function ToggleMicButton({gainNodesRef,micsMuted,setMicsMuted}: ToggleMicButtonProps) {
    const toggleMic = () => {
          setMicsMuted(prev=>{
            console.log("toggling mic, current state: ", prev);
            if(gainNodesRef.current.local){
              gainNodesRef.current.local.gain.value = !prev.local ? 0.0 : 1.0;
            }
            return {...prev, local: !prev.local};
          }
          )}

    return <button
            onClick={toggleMic}
            className={`p-2 rounded-full shadow-md transition-colors hover:border-1 border-red-400 ${
                      false ? "bg-red-400 hover:bg-red-500" : "bg-gray-700 hover:bg-gray-600"
                    } text-white`}
                  >
                    {micsMuted.local ? "Unmute Mic" : "Mute Mic"}
            </button>
}
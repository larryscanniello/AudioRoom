
type ToggleMicButtonProps = {
    gainNodesRef: React.RefObject<{local: GainNode | null, remote: GainNode | null}>;
    micsMuted: {local: boolean, remote: boolean};
    setMicsMuted: React.Dispatch<React.SetStateAction<{local: boolean, remote: boolean}>>;
}

export default function TogglePartnerMicButton({gainNodesRef, micsMuted, setMicsMuted}: ToggleMicButtonProps) {

    return <button
                onClick={() => {
                  setMicsMuted(prev=>{
                    if (gainNodesRef.current.remote) {
                      gainNodesRef.current.remote.gain.value = !prev.remote ? 1.0 : 0.0;
                    } 
                    return {...prev, remote: !prev.remote};
                  })
                  
                  
                }}
                className={`p-2 rounded-full transition-colors text-white hover:border-1 border-red-400 ${
                  false ? "bg-red-400 hover:bg-red-500" : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {micsMuted.remote ? "Unmute Partner" : "Mute Partner"}
            </button>

}
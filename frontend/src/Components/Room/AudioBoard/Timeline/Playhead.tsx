import { useRef } from "react";

export default function Playhead(){

    const playheadRef = useRef<HTMLDivElement>(null);

    
        

    return <div ref={playheadRef} style={{position:"absolute",top:0,bottom:0,left:-1,pointerEvents:"none",width:"4px"}}
                    onMouseDown={handleMovePlayhead}
                    className="flex flex-col items-center"
                    onDragStart={(e) => e.preventDefault()}
                    data-container-width={WAVEFORM_WINDOW_LEN}
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
                    }}>

                    </div>
            </div>
}
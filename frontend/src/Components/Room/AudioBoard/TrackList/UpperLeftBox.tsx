import { CONSTANTS } from "@/Constants/constants.ts";
import type { AudioController } from "@/Core/Audio/AudioController";
import { ArrowDownToLine, CassetteTape, KeyboardMusic, Redo, Undo } from "lucide-react";

type UpperLeftBoxProps = {
    compactMode: number;
    audioControllerRef: React.RefObject<AudioController|null>;

}   

export default function UpperLeftBox({compactMode, audioControllerRef}: UpperLeftBoxProps){

    const handleBounce = () => {
            if(!audioControllerRef.current){
                console.error("AudioController is null in UpperLeftBox handleBounce");
                return;
            }
            audioControllerRef.current.bounce();
    }

    const handleUndo = () => {
        if(!audioControllerRef.current){
            console.error("AudioController is null in UpperLeftBox handleUndo");
            return;
        }
        audioControllerRef.current.undo();
    }

    const handleRedo = () => {
        if(!audioControllerRef.current){
            console.error("AudioController is null in UpperLeftBox handleRedo");
            return;
        }
        audioControllerRef.current.redo();
    }

    const thingsToUndo = audioControllerRef.current ? audioControllerRef.current.query('timeline').undoStack.length : 0;
    const thingsToRedo = audioControllerRef.current ? audioControllerRef.current.query('timeline').redoStack.length : 0;

    return <div className="bg-[rgb(86,86,133)] flex flex-col justify-center items-center text-xs text-black"
                style={{width:`${CONSTANTS.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(35*compactMode)}}
            >
                <div>
                <button className="pr-2" onClick={handleUndo}>
                    <Undo className={`scale-75 ${thingsToUndo === 0 ? 'opacity-25' : ''}`}/>
                </button>
                <button className="pr-2" onClick={handleRedo}>
                    <Redo className={`scale-75 ${thingsToRedo === 0 ? 'opacity-25' : ''}`}/>
                </button>
                <button className="pr-3.5">
                    <KeyboardMusic className="scale-75"/>
                </button>
                <button className="relative w-8 h-5"
                onClick={handleBounce}
                >
                        <ArrowDownToLine className="absolute scale-50 -top-2.5 -left-1"/>
                        <CassetteTape className="absolute scale-75 top-0 -left-1"/>
                </button>      
                </div>
            </div>

}
import { Button} from "@/Components/ui/button";
import type { AudioController } from "@/Core/Audio/AudioController";
import { Magnet, Columns4 } from "lucide-react";

type SnapToGridProps = {
    compactMode: number;
    audioControllerRef: React.RefObject<AudioController | null>;
}

export default function SnapToGrid({compactMode,audioControllerRef}:SnapToGridProps){ 

    
    const toggleSnapToGrid = () => {
        if(!audioControllerRef.current){
            console.warn("AudioController reference is null. Cannot set snap to grid.");
            return;
        };
        audioControllerRef.current.toggleSnapToGrid();
    }

    const snapToGrid = audioControllerRef.current ? audioControllerRef.current.query('snapToGrid'): true;

    return <Button variant="default" size={compactMode==1?"lg":"sm"} 
                onClick={toggleSnapToGrid} 
                className="border-1 border-gray-300 hover:bg-gray-800 z-50"
                style={{position:"absolute",right:15,top:Math.floor(120*compactMode),transform:"scale(.7)"}}>
                <Magnet color={snapToGrid ? "lightblue" : "white"} style={{transform:"rotate(315deg) translateY(1px) "+(compactMode==1?"scale(1.5)":"scale(1)")}}
                    
                />

                <Columns4 color={snapToGrid ? "lightblue" : "white"} style={{transform:compactMode==1?"scale(1.5)":"scale(1)"}}/>
            </Button>
}
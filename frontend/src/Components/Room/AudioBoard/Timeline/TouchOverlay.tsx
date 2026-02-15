import { useRef, useEffect } from "react";
import { DOMElements } from "@/Constants/DOMElements";

type TouchOverlayProps = {
    timelinePxLen: number;
    compactMode: number;
    uiControllerRef: React.RefObject<any>;
    trackHeights: {
        stagingHeight: number;
        mixHeight: number;
    };
};

export default function TouchOverlay({ timelinePxLen, compactMode, uiControllerRef, trackHeights }: TouchOverlayProps) {
    const overlayRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (overlayRef.current && uiControllerRef.current) {
            overlayRef.current.addEventListener("wheel", uiControllerRef.current.scroll.bind(uiControllerRef.current), { passive: false });
        }else{
            console.error("Failed to add wheel event listener to TouchOverlay because reference was not found");
        }
        return () => {
            if (overlayRef.current && uiControllerRef.current) {
                overlayRef.current.removeEventListener("wheel", uiControllerRef.current.scroll.bind(uiControllerRef.current));
            }else{
                console.error("Failed to remove wheel event listener from TouchOverlay because reference was not found");
            }
        }
    }, []);



    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if(uiControllerRef.current){
            uiControllerRef.current.timelineMouseDown(e);
        }else{
            console.error("UI Controller reference was not available when handling mouse down in TouchOverlay");
        }
    };

    if(uiControllerRef.current && overlayRef && overlayRef.current){
        uiControllerRef.current.registerRef(DOMElements.TOUCH_OVERLAY, overlayRef);
    }

    return (
        <canvas
            ref={overlayRef}
            width={timelinePxLen}
            height={Math.floor(150 * compactMode)}
            style={{
                width: `${timelinePxLen}px`,
                height: `${Math.floor(150 * compactMode)}px`,
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "auto",
                zIndex: 10,
            }}
            data-stagingheight={trackHeights.stagingHeight}
            data-mixheight={trackHeights.mixHeight}
            onMouseDown={handleMouseDown}
        />
    );
}



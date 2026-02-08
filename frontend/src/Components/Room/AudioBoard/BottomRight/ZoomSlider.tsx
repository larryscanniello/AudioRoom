import { UIController } from "@/Classes/UI/UIController";
import { Slider } from "@/Components/ui/slider";
import { CONSTANTS } from "@/Constants/constants";
import { FaMagnifyingGlass } from "react-icons/fa6";

type ZoomSliderProps = {
    uiControllerRef: React.RefObject<UIController|null>;
    compactMode: number;
    timelinePxLen: number;
}

export default function ZoomSlider({uiControllerRef, compactMode, timelinePxLen}: ZoomSliderProps){

    const onZoomChange = (newZoomFactor:number[]) => {
        if(uiControllerRef.current){
            uiControllerRef.current.setZoom(newZoomFactor[0]);
        }else{
            console.error("UIController reference was not available when trying to set zoom, zoom change failed");
        }
    }

    let samplesPerPx;
    if(uiControllerRef.current){
        samplesPerPx = uiControllerRef.current.query("viewport").samplesPerPx;
    }else{
        throw new Error("UIController reference was not available when trying to get viewport, cannot determine slider value");
    }

    /*
        Slider vals are integers between 0 and 1000. 
        Samples per px are values between 10 and a max that depends on window size
        We map between values exponentially. If n is a slider val,
        then the samplesPerPx is 10 * b ** n, 
        where b is chosen such that when n is 1000,
        samplesPerPx is the max value.
    */

    const maxSamplesPerPx = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE / timelinePxLen;
    const b =  (maxSamplesPerPx / 10) ** (1 / 1000);
    const sliderVal = Math.log10(samplesPerPx/10)/Math.log10(b);
    
    return <div className={"flex flex-row items-center col-start-3 " + (compactMode!=1?"-translate-y-2":"")}>
            <FaMagnifyingGlass style={{transform:"scale(1.1)",marginRight:1}} className="text-blue-200"/>
            <Slider style={{width:100}}
            defaultValue={[200]} max={1000} min={0} step={1} 
                className="pl-2 group" 
                value={[sliderVal]}
                onValueChange={onZoomChange}
                >
            </Slider>
        </div>
}
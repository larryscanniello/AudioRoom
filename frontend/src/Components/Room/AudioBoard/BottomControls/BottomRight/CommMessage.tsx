import { UIController } from "@/Core/UI/UIController";

type CommMessageProps = {
    uiControllerRef: React.RefObject<UIController|null>;
    compactMode: number;
}

export default function CommMessage({uiControllerRef, compactMode}: CommMessageProps){

    const commMessage = uiControllerRef.current ? uiControllerRef.current.query("commMessage") : {text: "", color: "white"};

    return <div className={"flex flex-col items-center justify-center " + (compactMode<1?"-translate-y-1.5":"")}>
                <div className={"col-start-5 text-white fade-in-element text-sm"}>
                    {commMessage.text}
                </div>
            </div>
}
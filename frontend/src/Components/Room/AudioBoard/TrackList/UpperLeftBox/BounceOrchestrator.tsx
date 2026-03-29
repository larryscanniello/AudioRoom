import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { AudioController } from "@/Core/Audio/AudioController";
import BouncePrompt from "./BouncePrompt";
import RestageOrchestrator from "./RestageOrchestrator";
import type { RestageHandle } from "./RestageOrchestrator";

export type BounceOrchestratorHandle = {
    onBounceClick: () => void;
    onRestageRequest: (index: number) => void;
};

type BounceOrchestratorProps = {
    audioControllerRef: React.RefObject<AudioController | null>;
};

const BounceOrchestrator = forwardRef<BounceOrchestratorHandle, BounceOrchestratorProps>(
    function BounceOrchestrator({ audioControllerRef }, ref) {
        const [showBouncePrompt, setShowBouncePrompt] = useState(false);
        const [bounceName, setBounceName] = useState("");
        const [pendingStagingName, setPendingStagingName] = useState<string | null>(null);
        const restageRef = useRef<RestageHandle | null>(null);

        const bounceCount = audioControllerRef.current?.query("bounce") ?? 0;
        const stagingLen = audioControllerRef.current?.query("timeline").staging[0]?.length ?? 0;

        useEffect(() => { setShowBouncePrompt(false); }, [bounceCount]);
        useEffect(() => { if (stagingLen === 0) setPendingStagingName(null); }, [stagingLen]);

        const openBouncePrompt = () => {
            if (pendingStagingName) {
                audioControllerRef.current?.bounce(pendingStagingName);
                setPendingStagingName(null);
                return;
            }
            setBounceName(`Bounce ${bounceCount + 1}`);
            setShowBouncePrompt(true);
        };

        const handleConfirmBounce = () => {
            const name = bounceName.trim() || `Bounce ${bounceCount + 1}`;
            audioControllerRef.current?.bounce(name);
            setShowBouncePrompt(false);
        };

        useImperativeHandle(ref, () => ({
            onBounceClick: openBouncePrompt,
            onRestageRequest: (index: number) => restageRef.current?.requestReStage(index, pendingStagingName),
        }));

        return (
            <>
                <RestageOrchestrator
                    ref={restageRef}
                    audioControllerRef={audioControllerRef}
                    onRestageComplete={name => setPendingStagingName(name)}
                />
                {showBouncePrompt && (
                    <BouncePrompt
                        bounceName={bounceName}
                        onNameChange={setBounceName}
                        onConfirm={handleConfirmBounce}
                        onCancel={() => setShowBouncePrompt(false)}
                    />
                )}
            </>
        );
    }
);

export default BounceOrchestrator;
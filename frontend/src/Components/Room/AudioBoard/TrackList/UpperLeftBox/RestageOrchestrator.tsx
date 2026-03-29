import { forwardRef, useImperativeHandle, useState } from "react";
import type { AudioController } from "@/Core/Audio/AudioController";
import BouncePrompt from "./BouncePrompt";
import RestageConflictPrompt from "./RestageConflictPrompt";

export type RestageHandle = { requestReStage: (index: number, currentStagingName?: string | null) => void };

type RestageOrchestratorProps = {
    audioControllerRef: React.RefObject<AudioController | null>;
    onRestageComplete?: (originalName: string | null) => void;
};

const RestageOrchestrator = forwardRef<RestageHandle, RestageOrchestratorProps>(
    function RestageOrchestrator({ audioControllerRef, onRestageComplete }, ref) {
        const [pendingIndex, setPendingIndex] = useState<number | null>(null);
        const [originalName, setOriginalName] = useState<string | null>(null);
        const [conflictStagingName, setConflictStagingName] = useState<string | null>(null);
        const [showConflict, setShowConflict] = useState(false);
        const [showBouncePrompt, setShowBouncePrompt] = useState(false);
        const [bounceName, setBounceName] = useState("");

        const clearAll = () => {
            setPendingIndex(null);
            setOriginalName(null);
            setConflictStagingName(null);
            setShowConflict(false);
            setShowBouncePrompt(false);
            setBounceName("");
        };

        useImperativeHandle(ref, () => ({
            requestReStage(index: number, currentStagingName?: string | null) {
                const ac = audioControllerRef.current;
                if (!ac) return;
                const timeline = ac.query("timeline");
                const name = timeline.bounceNames?.[index] ?? null;
                const stagingHasContent = timeline.staging[0]?.length > 0;
                if (!stagingHasContent) {
                    ac.reStage(index);
                    onRestageComplete?.(name);
                } else {
                    setPendingIndex(index);
                    setOriginalName(name);
                    setConflictStagingName(currentStagingName ?? null);
                    setShowConflict(true);
                }
            },
        }));

        const handleDeleteStaging = () => {
            const ac = audioControllerRef.current;
            if (!ac || pendingIndex === null) return;
            ac.deleteStagingRegions();
            ac.reStage(pendingIndex);
            onRestageComplete?.(originalName);
            clearAll();
        };

        const handleBounceFirst = () => {
            const ac = audioControllerRef.current;
            if (!ac || pendingIndex === null) return;
            if (conflictStagingName) {
                // Staging already has a known name — skip the prompt
                ac.bounce(conflictStagingName);
                ac.reStage(pendingIndex);
                onRestageComplete?.(originalName);
                clearAll();
                return;
            }
            const bounceCount = ac.query("bounce") ?? 0;
            setBounceName(`Bounce ${bounceCount + 1}`);
            setShowConflict(false);
            setShowBouncePrompt(true);
        };

        const handleConfirmBounce = () => {
            const ac = audioControllerRef.current;
            if (!ac || pendingIndex === null) return;
            const name = bounceName.trim() || `Bounce ${(ac.query("bounce") ?? 0) + 1}`;
            ac.bounce(name);
            ac.reStage(pendingIndex);
            onRestageComplete?.(originalName);
            clearAll();
        };

        if (showConflict) {
            return (
                <RestageConflictPrompt
                    onDeleteStaging={handleDeleteStaging}
                    onBounceFirst={handleBounceFirst}
                    onCancel={clearAll}
                />
            );
        }

        if (showBouncePrompt) {
            return (
                <BouncePrompt
                    bounceName={bounceName}
                    onNameChange={setBounceName}
                    onConfirm={handleConfirmBounce}
                    onCancel={clearAll}
                />
            );
        }

        return null;
    }
);

export default RestageOrchestrator;
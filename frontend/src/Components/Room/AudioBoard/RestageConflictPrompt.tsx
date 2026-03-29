type RestageConflictPromptProps = {
    onDeleteStaging: () => void;
    onBounceFirst: () => void;
    onCancel: () => void;
};

export default function RestageConflictPrompt({ onDeleteStaging, onBounceFirst, onCancel }: RestageConflictPromptProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 rounded-2xl">
            <div className="bg-popover border border-black rounded p-4 flex flex-col gap-3 w-64">
                <p className="text-xs font-medium">Staging has content.</p>
                <div className="flex gap-2 justify-end">
                    <button className="text-xs px-2 py-1" onClick={onCancel}>Cancel</button>
                    <button className="text-xs px-2 py-1 bg-white text-black rounded" onClick={onDeleteStaging}>Delete staging</button>
                    <button className="text-xs px-2 py-1 bg-white text-black rounded" onClick={onBounceFirst}>Bounce first</button>
                </div>
            </div>
        </div>
    );
}

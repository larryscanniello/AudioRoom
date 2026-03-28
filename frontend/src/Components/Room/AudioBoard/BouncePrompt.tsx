type BouncePromptProps = {
    bounceName: string;
    onNameChange: (name: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function BouncePrompt({ bounceName, onNameChange, onConfirm, onCancel }: BouncePromptProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 rounded-2xl">
            <div className="bg-popover border border-black rounded p-4 flex flex-col gap-3 w-64">
                <p className="text-xs font-medium">Name this bounce</p>
                <input
                    autoFocus
                    maxLength={64}
                    className="text-xs bg-transparent border border-black rounded px-2 py-1 outline-none"
                    value={bounceName}
                    onChange={e => onNameChange(e.target.value.replace(/[^a-zA-Z0-9 \-_.,!?'()#&]/g, ""))}
                    onKeyDown={e => {
                        if (e.key === "Enter") onConfirm();
                        if (e.key === "Escape") onCancel();
                    }}
                />
                <div className="flex gap-2 justify-end">
                    <button className="text-xs px-2 py-1" onClick={onCancel}>Cancel</button>
                    <button className="text-xs px-2 py-1 bg-white text-black rounded" onClick={onConfirm}>Bounce</button>
                </div>
            </div>
        </div>
    );
}
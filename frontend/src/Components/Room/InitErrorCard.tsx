type InitErrorCardProps = {
    message: string;
}

export default function InitErrorCard({ message }: InitErrorCardProps) {
    return (
        <div className="absolute flex items-center justify-center mt-12">
            <div className="bg-gray-950 border border-red-300/50 rounded-2xl p-8 w-100 text-center">
                <div className="text-red-400 text-3xl mb-3">⚠</div>
                <div className="text-white font-semibold text-lg mb-2">Cannot Join Room</div>
                <div className="text-gray-300 text-sm leading-relaxed">{message}</div>
            </div>
        </div>
    );
}

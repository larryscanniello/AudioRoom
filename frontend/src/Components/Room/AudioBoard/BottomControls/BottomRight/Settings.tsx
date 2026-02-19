import { Popover, PopoverContent, PopoverTrigger } from "@/Components/ui/popover.tsx";


export default function Settings({ compactMode }: { compactMode: number }){
    return <Popover>
                <PopoverTrigger className={"col-start-4 hover:underline text-blue-200 "+(compactMode!=1?"-translate-y-2":"")}>Settings</PopoverTrigger>
                <PopoverContent>
                    <label style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
                        <input 
                            type="checkbox" 
                            checked={true} 
                            onChange={() => {}} 
                        />
                        Auto-test recording latency
                        </label>
                </PopoverContent>
            </Popover>
}
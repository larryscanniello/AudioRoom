import { Slider } from "@radix-ui/react-slider";

type RemoteVolumeSliderProps = {
    remoteVolume: number;
    setRemoteVolume: React.Dispatch<React.SetStateAction<number>>;
    gainNodesRef: React.RefObject<{local: GainNode | null, remote: GainNode | null}>;
    micsMuted: {local: boolean, remote: boolean};
}

export default function RemoteVolumeSlider({remoteVolume, setRemoteVolume, gainNodesRef, micsMuted}: RemoteVolumeSliderProps){
return <div className="flex flex-col gap-1 w-32">
                  <span className="text-[10px] text-gray-400 uppercase font-bold px-1">Partner Vol</span>
                  <Slider
                    defaultValue={[100]}
                    max={100}
                    step={1}
                    value={[micsMuted.remote ? 0 : remoteVolume]}
                    onValueChange={(vals) => {
                      const vol = vals[0];
                      setRemoteVolume(vol);
                      if (gainNodesRef.current.remote && !micsMuted.remote) {
                        gainNodesRef.current.remote.gain.value = vol / 100;
                      }
                    }}
                    disabled={micsMuted.remote}
                  />
        </div>

}
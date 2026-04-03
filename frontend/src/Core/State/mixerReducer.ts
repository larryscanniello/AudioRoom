import type { MixerState } from "@/Types/AudioState";

type MixerAction =
    | { type: 'change_channel_volume'; channelId: string; volume: number }

export default function mixerReducer(state: MixerState, action: MixerAction): MixerState {
    switch (action.type) {
        case 'change_channel_volume':
            return {
                ...state,
                channels: state.channels.map(ch =>
                    ch.id === action.channelId ? { ...ch, volume: action.volume } : ch
                ),
            };
    }
}
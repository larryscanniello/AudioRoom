import type { MixerState, EffectSlotConfig } from "@/Types/AudioState";

type MixerAction =
    | { type: 'change_channel_volume'; channelId: string; volume: number }
    | { type: 'set_effect_chain'; channelId: string; effects: (EffectSlotConfig | null)[] }
    | { type: 'update_aux_send'; channelId: string; sendIndex: number; auxId: string; level: number }
    | { type: 'update_effect_param'; channelId: string; slotIndex: number; param: string; value: number }

export default function mixerReducer(state: MixerState, action: MixerAction): MixerState {
    switch (action.type) {
        case 'change_channel_volume':
            return {
                ...state,
                channels: state.channels.map(ch =>
                    ch.id === action.channelId ? { ...ch, volume: action.volume } : ch
                ),
            };
        case 'set_effect_chain':
            return {
                ...state,
                channels: state.channels.map(ch =>
                    ch.id === action.channelId ? { ...ch, effects: action.effects } : ch
                ),
            };
        case 'update_effect_param': {
            const { channelId, slotIndex, param, value } = action;
            return {
                ...state,
                channels: state.channels.map(ch => {
                    if (ch.id !== channelId) return ch;
                    const effects = [...ch.effects];
                    const existing = effects[slotIndex];
                    if (!existing) return ch;
                    effects[slotIndex] = { ...existing, params: { ...(existing.params ?? {}), [param]: value } };
                    return { ...ch, effects };
                }),
            };
        }
        case 'update_aux_send': {
            const { channelId, sendIndex, auxId, level } = action;
            return {
                ...state,
                channels: state.channels.map(ch => {
                    if (ch.id !== channelId) return ch;
                    const sends = [...ch.sends];
                    sends[sendIndex] = { auxId, level };
                    return { ...ch, sends };
                }),
            };
        }
    }
}
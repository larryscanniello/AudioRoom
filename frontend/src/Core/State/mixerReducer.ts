import type { MixerState, EffectSlotConfig } from "@/Types/AudioState";

type MixerAction =
    | { type: 'change_channel_volume'; channelId: string; volume: number }
    | { type: 'set_effect_chain'; channelId: string; effects: (EffectSlotConfig | null)[] }
    | { type: 'update_aux_send'; channelId: string; sendIndex: number; auxId: string; level: number }
    | { type: 'update_effect_param'; channelId: string; slotIndex: number; param: string; value: number }
    | { type: 'bounce_effects'; newTrackId: string }
    | { type: 'restage_effects'; trackId: string }
    | { type: 'delete_bounce_channels'; deletedIndices: number[] }

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
        case 'bounce_effects': {
            const staging = state.channels.find(ch => ch.id === 'staging');
            if (!staging) return state;
            const stagingEffects = staging.effects;
            const stagingSends = staging.sends;
            return {
                ...state,
                channels: state.channels.map(ch => {
                    if (ch.id === 'staging') return { ...ch, effects: [], sends: [{ auxId: 'aux-0', level: 0 }, { auxId: 'aux-1', level: 0 }] };
                    if (ch.id === action.newTrackId) return { ...ch, effects: stagingEffects, sends: stagingSends };
                    return ch;
                }),
            };
        }
        case 'restage_effects': {
            const track = state.channels.find(ch => ch.id === action.trackId);
            if (!track) return state;
            const trackEffects = track.effects;
            const trackSends = track.sends;
            return {
                ...state,
                channels: state.channels.map(ch => {
                    if (ch.id === 'staging') return { ...ch, effects: trackEffects, sends: trackSends };
                    if (ch.id === action.trackId) return { ...ch, effects: [], sends: [{ auxId: 'aux-0', level: 0 }, { auxId: 'aux-1', level: 0 }] };
                    return ch;
                }),
            };
        }
        case 'delete_bounce_channels': {
            const deletedSet = new Set(action.deletedIndices);
            const surviving = state.channels
                .filter(ch => ch.id.startsWith('track-'))
                .filter(ch => {
                    const idx = parseInt(ch.id.split('-')[1], 10);
                    return !deletedSet.has(idx);
                })
                .map((ch, newIdx) => ({ ...ch, id: `track-${newIdx}`, trackIndex: newIdx }));
            const nonTrack = state.channels.filter(ch => !ch.id.startsWith('track-'));
            return { ...state, channels: [...nonTrack, ...surviving] };
        }
    }
}
export type NativeEffectType = 'lowpass' | 'highpass';

export type ParamMeta = {
    label: string;
    min: number;
    max: number;
    default: number;
} & (
    | { control: 'drag'; sensitivity: number; format?: (v: number) => string }
    | { control: 'slider'; step: number }
);

export type NativeEffectDescriptor = {
    displayName: string;
    params: Record<string, ParamMeta>;
};

export const NATIVE_EFFECT_CATALOG: Record<NativeEffectType, NativeEffectDescriptor> = {
    lowpass: {
        displayName: 'LP Filter',
        params: {
            cutoffHz: {
                label: 'Cutoff', control: 'drag', min: 20, max: 20000,
                default: 2000, sensitivity: 160,
                format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`,
            },
            resonance: {
                label: 'Q', control: 'drag', min: 0.1, max: 20,
                default: 0.7, sensitivity: 100,
                format: v => v.toFixed(1),
            },
        },
    },
    highpass: {
        displayName: 'HP Filter',
        params: {
            cutoffHz: {
                label: 'Cutoff', control: 'drag', min: 20, max: 20000,
                default: 200, sensitivity: 160,
                format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`,
            },
            resonance: {
                label: 'Q', control: 'drag', min: 0.1, max: 20,
                default: 0.7, sensitivity: 100,
                format: v => v.toFixed(1),
            },
        },
    },
};

export const DEFAULT_EFFECT_PARAMS: Record<NativeEffectType, Record<string, number>> =
    Object.fromEntries(
        Object.entries(NATIVE_EFFECT_CATALOG).map(([type, desc]) => [
            type,
            Object.fromEntries(Object.entries(desc.params).map(([k, p]) => [k, p.default])),
        ])
    ) as Record<NativeEffectType, Record<string, number>>;
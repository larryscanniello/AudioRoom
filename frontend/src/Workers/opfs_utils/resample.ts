export const TAPS_PER_PHASE = 32;
const KAISER_BETA = 10.0;

function gcd(a: number, b: number): number {
	while (b > 0) { [a, b] = [b, a % b]; }
	return a;
}

// Modified zeroth-order Bessel function (for Kaiser window)
function kaiserI0(x: number): number {
	let sum = 1;
	let term = 1;
	for (let k = 1; k <= 25; k++) {
		term *= (x / (2 * k)) ** 2;
		sum += term;
		if (term < 1e-12) break;
	}
	return sum;
}

interface PolyphaseFilter {
	phases: Float32Array[];
	L: number;
	M: number;
}

const filterCache = new Map<string, PolyphaseFilter>();

function buildFilter(L: number, M: number): PolyphaseFilter {
	const N = TAPS_PER_PHASE * L;
	const fc = 0.5 / Math.max(L, M);
	const center = (N - 1) / 2;
	const i0Beta = kaiserI0(KAISER_BETA);
	const proto = new Float32Array(N);

	for (let n = 0; n < N; n++) {
		const t = n - center;
		const sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
		const r = t / center;
		const kaiser = kaiserI0(KAISER_BETA * Math.sqrt(Math.max(0, 1 - r * r))) / i0Beta;
		proto[n] = sinc * kaiser * L;
	}

	const phases: Float32Array[] = [];
	for (let l = 0; l < L; l++) {
		const phase = new Float32Array(TAPS_PER_PHASE);
		for (let m = 0; m < TAPS_PER_PHASE; m++) {
			phase[m] = proto[l + m * L];
		}
		phases.push(phase);
	}

	return { phases, L, M };
}

function getFilter(inputSampleRate: number, outputSampleRate: number): PolyphaseFilter {
	const key = `${inputSampleRate}:${outputSampleRate}`;
	let filter = filterCache.get(key);
	if (!filter) {
		const d = gcd(inputSampleRate, outputSampleRate);
		filter = buildFilter(outputSampleRate / d, inputSampleRate / d);
		filterCache.set(key, filter);
	}
	return filter;
}

export function resample(
	input: Float32Array,
	inputSampleRate: number,
	outputSampleRate: number
): Float32Array {
	if (inputSampleRate === outputSampleRate) return new Float32Array(input);

	const { phases, L, M } = getFilter(inputSampleRate, outputSampleRate);
	const outputLength = Math.round(input.length * L / M);
	const output = new Float32Array(outputLength);

	for (let n = 0; n < outputLength; n++) {
		const nM = n * M;
		const phaseIdx = nM % L;
		const q = Math.floor(nM / L);
		const coeffs = phases[phaseIdx];
		let acc = 0;
		for (let m = 0; m < TAPS_PER_PHASE; m++) {
			const idx = q - m;
			if (idx >= 0 && idx < input.length) {
				acc += input[idx] * coeffs[m];
			}
		}
		output[n] = acc;
	}

	return output;
}
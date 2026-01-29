import type { MipMapData } from "../Types/UI";

export default class MipMap {
    private staging:Int8Array;
    private mix: Int8Array;
    private isFull:{
        staging: Int8Array,
        mix: Int8Array,
    };
    private data: MipMapData;

    constructor(stagingSAB: SharedArrayBuffer, mixSAB: SharedArrayBuffer,data:MipMapData){
        this.staging = new Int8Array(stagingSAB,1);
        this.mix = new Int8Array(mixSAB,1);
        this.isFull = {
            staging: new Int8Array(stagingSAB,0,1),
            mix: new Int8Array(mixSAB,0,1),
        }
        this.data = data;
    }

}

export class SessionState {
    private metronomeOn:boolean = false;
    private isPlaying:boolean = false;
    private isRecording:boolean = false;
    private recordData:{take:number,bounce:number} = {take:0,bounce:0};

    constructor(){
        
    }

    getMetronomeOn():boolean{
        return this.metronomeOn;
    }

    setMetronomeOn(value:boolean):void{
        this.metronomeOn = value;
    }

    getIsPlaying():boolean{
        return this.isPlaying;
    }

    setIsPlaying(value:boolean):void{
        this.isPlaying = value;
    }

    getIsRecording():boolean{
        return this.isRecording     ;
    }

    setIsRecording(value:boolean):void{
        this.isRecording = value;
    }
    
    incrementTake():void{
        this.recordData.take += 1;
    }

    incrementBounce():void{
        this.recordData.bounce += 1;
        this.recordData.take = 0;
    }

    getRecordData():{take:number,bounce:number}{
        return this.recordData;
    }

}
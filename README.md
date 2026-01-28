# AudioRoom (Active Development)

A new way for musicians to collaborate over the web.

AudioRoom is a browser-based digital audio workstation (DAW) that lets multiple users create, edit, and play loop-based music together while video chatting in real time. Built with Web Audio, custom DSP, and a real-time collaboration backend.

**NOTE:** The main branch is the previous version of my project, which is the version that is live on my demo page. The current version of the project is being developed on the branch newaudioengine.

### Demos

Live demo (previous version): [https://audio-board.vercel.app](https://audio-board.vercel.app)

Video demo (previous version): [https://www.youtube.com/watch?v=oN72QALuHg8](https://www.youtube.com/watch?v=oN72QALuHg8)

### Features

* Peer-to-peer video chat with WebRTC/PeerJS

* Collaborative web DAW with two tracks, staging and mix. Anyone can record on the staging track, bounce and layer on the mix track

* Recorded audio is compressed, streamed in real time, and inserted into collaborators’ timelines with sample-accurate synchronization

* Uses websockets to sync user state. Playback is shared state, as is playhead location and region selection

* DSP latency measurement system that measures and compensates recording latency within 10 ms

* In progress: Basic editing such as region moving, region resizing, cut and paste, undo


### High-Level Architecture

* Frontend: React/JavaScript/TypeScript

* Backend: Express/Node

* Collaboration: Websockets, WebRTC (PeerJS)

* Audio engine: Web Audio API, AudioWorklet, SharedArrayBuffers, OPFS

The system is split into a UI thread, an audio thread, and background workers to ensure glitch-free playback, smooth UI rendering, and safe concurrent collaboration.

### Audio Engine
 
Audio playback and recording are designed around strict real-time constraints, with all disk I/O and buffer management off the UI thread.

All audio is stored in OPFS. Since the timeline is 15 minutes long, storing audio in memory would not be feasible. OPFS allows for synchronous file reads, helping to store audio on disk and read in time to meet scheduling deadlines.

There are three SharedArrayBuffer ring buffers: One for staging playback, one for mix playback, and one for recording. The audio processor and the web worker that manages OPFS both have access to these buffers.

When recording or playback happens, in the OPFS worker, there are functions that run on a loop that continually poll the buffers. Using Atomics, they can check how much the pointers have moved, and if there is space available or samples to read. On the other end, the audio processor, an AudioWorklet, also continuously polls these buffers to check if there are operations to do. The buffers each hold one second of audio, but these operations happen every few ms, ensuring the buffer is never underrun.

All of this processing happens on dedicated audio / worker threads, ensuring the UI thread is free to render visuals smoothly.

### Codebase Overview

To see the main UI logic: 

/frontend/Components/RoomComponents/AudioBoard.jsx

To see the workers and audio processors:

/frontend/public

### Tests

All of the tests live in:

/frontend/tests

I wrote integration tests that check the entire audio playback data flow. I also wrote unit tests for the timeline reducer (the code that calculates new timeline state on recording end or bounce), the utility that writes to ring buffers, and the utility that writes to OPFS.

### Roadmap

I'm working on debugging and finalizing the new audio engine and the timeline editing logic. Key features for my MVP will be:

* Adding a drum machine and sequencer, and possibly a lightweight synth

* Session storage using AWS S3

* TURN server using AWS

### Why This Project Exists

I used to work as a musician in Los Angeles before moving to New Jersey. This project will help me collaborate with friends I haven't worked with in a long time.

### License

This repository is public for potential employers to view and evaluate only.
All rights reserved. No copying, modification, or commercial use permitted.

### Contact

Name: Larry Scanniello

Email: larryscanniello@gmail.com 

LinkedIn: https://www.linkedin.com/in/larryscanniello

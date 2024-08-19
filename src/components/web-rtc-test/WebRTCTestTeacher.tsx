import React, { useState, useEffect, useRef } from 'react';
import { Producer, connectToServerAsTeacher, startWebcamStream, stopWebcamStream, startScreenShareStream, stopScreenShareStream } from './utils/teacher/teacherClient';

const WebRTCTestTeacher: React.FC = () => {
    const [roomId, setRoomId] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('');
    const [webcamStatus, setWebcamStatus] = useState('');
    const [screenStatus, setScreenStatus] = useState('');
    const [isPublishingDisabled, setIsPublishingDisabled] = useState(true);
    const [useSimulcast, setUseSimulcast] = useState(false);
    const [isScreenShareSupported, setIsScreenShareSupported] = useState(true);

    const [webcamProducer, setWebcamProducer] = useState<Producer | null>(null);
    const [screenShareProducer, setScreenShareProducer] = useState<Producer | null>(null);

    const webcamVideoRef = useRef<HTMLVideoElement>(null);
    const screenShareVideoRef = useRef<HTMLVideoElement>(null);

    const handleConnect = async () => {
        await connectToServerAsTeacher(roomId, setConnectionStatus, setIsPublishingDisabled);
    };
    

    useEffect(() => {
        if (typeof navigator.mediaDevices.getDisplayMedia === 'undefined') {
            setScreenStatus('Not supported');
            setIsScreenShareSupported(false);
        }
    }, []);

    const handleStartWebcam = async () => {
        if (!webcamProducer) {
            const producer = await startWebcamStream(roomId, useSimulcast, setWebcamStatus, webcamVideoRef.current);
            setWebcamProducer(producer);
        }
    };

    const handleStopWebcam = () => {
        if (webcamProducer) {
            stopWebcamStream(webcamProducer, setWebcamStatus);
            setWebcamProducer(null);
        }
    };

    const handleStartScreenShare = async () => {
        if (!screenShareProducer) {
            const producer = await startScreenShareStream(roomId, useSimulcast, setScreenStatus, screenShareVideoRef.current);
            setScreenShareProducer(producer);
        }
    };

    const handleStopScreenShare = () => {
        if (screenShareProducer) {
            stopScreenShareStream(screenShareProducer, setScreenStatus);
            setScreenShareProducer(null);
        }
    };

    useEffect(() => {
        console.log('webcamVideoRef:', webcamVideoRef);
        console.log('webcamVideoRef.current:', webcamVideoRef.current);
        console.log('screenShareVideoRef:', screenShareVideoRef);
        console.log('screenShareVideoRef.current:', screenShareVideoRef.current);
        
        // 만약 current가 없다면, 컴포넌트가 제대로 렌더링되고 있는지 확인해야 합니다.
        if (!webcamVideoRef.current) {
            console.warn('webcamVideoRef.current is not defined');
        }
        if (!screenShareVideoRef.current) {
            console.warn('screenShareVideoRef.current is not defined');
        }
    }, []); // 빈 배열을 의존성으로 하여 컴포넌트가 처음 렌더링될 때만 실행


    return (
        <div>
            <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
            />
            <fieldset id="fs_connection">
                <legend>Connection</legend>
                <div>
                    <button onClick={handleConnect}>Connect</button> 
                    <span>{connectionStatus}</span>
                </div>
            </fieldset>
            <fieldset id="fs_publish" disabled={isPublishingDisabled}>
                <legend>Publishing</legend>
                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={useSimulcast}
                            onChange={(e) => setUseSimulcast(e.target.checked)}
                        />
                        Use Simulcast
                    </label>
                </div>
                <div>
                    <button onClick={handleStartWebcam} disabled={!!webcamProducer}>Start Webcam</button>
                    <button onClick={handleStopWebcam} disabled={!webcamProducer}>Stop Webcam</button>
                    <span>{webcamStatus}</span>
                </div>
                <div>
                    <button onClick={handleStartScreenShare} disabled={!!screenShareProducer || !isScreenShareSupported}>Start Screen Share</button>
                    <button onClick={handleStopScreenShare} disabled={!screenShareProducer}>Stop Screen Share</button>
                    <span>{screenStatus}</span>
                </div>
            </fieldset>
            <div>
            <video 
                ref={webcamVideoRef} 
                autoPlay 
                muted 
                playsInline 
                style={{ width: '400px', height: 'auto', maxWidth: '100%' }} 
            ></video>
            <video 
                ref={screenShareVideoRef} 
                autoPlay 
                muted 
                playsInline 
                style={{ width: '400px', height: 'auto', maxWidth: '100%' }} 
            ></video>
            </div>
        </div>
    );
}

export default WebRTCTestTeacher;
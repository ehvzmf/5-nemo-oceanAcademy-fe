import React, { useState, useEffect, useRef } from 'react';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../../../components/modal/Modal';
import axios, { AxiosError } from 'axios';
import endpoints from '../../../api/endpoints';
import styles from './LiveStudent.module.css';
import { Container } from '../../../styles/GlobalStyles';
import profImage from '../../../assets/images/profile/profile_default.png';
import noCam from '../../../assets/images/icon/no_cam.png';
import share from '../../../assets/images/icon/share.png';
import { connectToServerAsStudent } from '../../../components/web-rtc/utils/student/studentClient';

interface Message {
  room: string;
  message: string;
  nickname: string;
  profileImage: string;
}

const LiveStudent: React.FC = () => {
  const token = localStorage.getItem('accessToken');
  const navigate = useNavigate();
  const { classId } = useParams<{ classId: string }>();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [isSubscriptionDisabled, setIsSubscriptionDisabled] = useState(true);
  const [isScreenClicked, setIsScreenClicked] = useState(false);
  const [userInfo, setUserInfo] = useState<{ nickname: string; profileImage: string } | null>(null);

  // Chat 관련
  const [stompClient, setStompClient] = useState<Client | null>(null);
  const [currentRoom, setCurrentRoom] = useState(classId);
  const [subscription, setSubscription] = useState<StompSubscription | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState("");

  const setConnectedState = (connected: boolean) => {
    setConnected(connected);
    if (!connected) {
      setMessages([]);
    }
  };

  useEffect(() => {
    const connect = () => {
      const socket = new SockJS(endpoints.connectWebSocket);
      console.log('connect 시도 중, url: ', endpoints.connectWebSocket)
      const client = new Client({
        webSocketFactory: () => socket,
        beforeConnect: () => {
          client.connectHeaders = {
            Authorization: `Bearer ${token}`
          };
        },
        onConnect: () => {
            setStompClient(client);
            setConnectedState(true);
  
            console.log('STOMP client connected');
        },
        onStompError: (frame) => {
            console.error('Broker reported error: ' + frame.headers['message']);
            console.error('Additional details: ' + frame.body);
        },
        onDisconnect: () => {
            setConnectedState(false);
            console.log("Disconnected");
        }
      });
  
      client.activate();
    }; 

    connect();
  }, [classId]); 

  // useEffect를 사용하여 stompClient 상태가 업데이트된 후 작업 수행
  useEffect(() => {
    if (stompClient && connected && currentRoom) {
      console.log(stompClient);
      console.log("Attempting to subscribe...");
      subscribeToRoom(currentRoom); // 현재 방에 구독
      loadChatHistory(currentRoom); // 현재 방의 채팅 기록 로드
    }
  }, [stompClient, connected, currentRoom]);

  const disconnect = () => {
    if (stompClient) {
      stompClient.deactivate();
      setConnectedState(false);
      console.log("Disconnected");
    }
  };

  const subscribeToRoom = (classId: string) => {
    if (!stompClient) {
      console.error('STOMP client is not initialized. Cannot subscribe.');
      return;
    }

    if (!stompClient.connected) {
      console.error('STOMP client is not connected. Cannot subscribe.');
      return;
    }

    if (subscription) {
      console.log('Unsubscribing from previous room');
      subscription.unsubscribe();  // 이전 방에 대한 구독 해제
    }
    
    console.log("Attempting to subscribe to roomId = " + classId);
    console.log("currentRoom = " + currentRoom);
    
    try {
      const newSubscription = stompClient.subscribe(`/topic/greetings/${classId}`, (greeting) => {
        const messageContent = JSON.parse(greeting.body);
        console.log(`Received message: ${messageContent.content}`);
        showGreeting(classId, messageContent.content, messageContent.nickname, messageContent.profileImage);
      });

      setSubscription(newSubscription);
      console.log("Successfully subscribed to room " + classId);
    } catch (error) {
      console.error("Failed to subscribe: ", error);
    }
  };

  const sendMessage = () => {
    if (stompClient && stompClient.connected) {
      const chatMessage = {
        roomId: Number(currentRoom), 
        content: content,
        writerId: userInfo ? userInfo.nickname : 'Anonymous',
        createdDate: new Date().toISOString()
      };

      console.log("Student: chat message = " + JSON.stringify(chatMessage));

      // 메시지를 서버로 전송
      stompClient.publish({
        destination: "/app/hello",
        body: JSON.stringify(chatMessage),
      });

      // 입력 필드를 초기화하고 메시지를 UI에 추가
      setContent('');
      //showGreeting(currentRoom, content);
    } else {
      console.error('STOMP client is not connected. Cannot send message.');
    }
  };

  const showGreeting = (room: string, message: string, nickname: string, profileImage: string) => {
    console.log('showGreeting 실행중 - Room:', room, 'Message:', message); // 디버그용
    setMessages((prevMessages) => [
      ...prevMessages,
      { room, message, nickname, profileImage }
    ]);
  };  
  
  const loadChatHistory = (classId: string) => {
    axios.get(endpoints.getChatHistory.replace('{classId}', classId))
      .then(response => {
          setMessages(response.data.map((msg:any) => ({
            room: classId,
            message: msg.content,
            nickname: msg.writerId || 'Anonymous',
            profileImage: msg.profileImage || profImage
          })));
      })
      .catch(error => {
          console.error("Failed to load chat history:", error);
      });
  };

  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // 유저 정보 조회
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await axios.get(endpoints.userInfo, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 200) {
          console.log('LiveStudent: 유저 정보를 정상적으로 받아왔습니다: ', response.data);
          setUserInfo(response.data.data);
        }
      } catch (error) {
        const axiosError = error as AxiosError;

        if (axiosError.response && axiosError.response.status === 401) {
            alert('권한이 없습니다.');
            navigate('/');
        } else {
            console.error('Error occurred: ', axiosError);
        }
      }
    };

    fetchUserInfo();
  }, [navigate, token]);

  // 페이지 로딩 시 강의 정보 가져오기
  useEffect(() => {
    const fetchLectureInfo = async () => {
      if (classId) {
        try {
          const response = await axios.get(endpoints.getLectureInfo.replace('{classId}', classId));
          const lectureData = response.data.data;
          setTitle(lectureData.name);
          setInstructor(lectureData.instructor);
          console.log(response.data.message_eng, response.data.timestamp);
        } catch (error) {
          console.error('LiveStudent: 강의 정보를 불러오는 데 실패했습니다 > ', error);
        }
      } else {
        console.error('Invalid classId');
      }
    };

    fetchLectureInfo();
  }, [classId]);

  // WebRTC Connection
  useEffect(() => {
    const handleConnect = async () => {
      await connectToServerAsStudent(
        classId ?? '',
        setConnectionStatus,
        setIsSubscriptionDisabled,
        webcamVideoRef,
        screenShareVideoRef
      );
    };

    if (classId) {
      handleConnect();
    }
  }, [classId]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  // Modal handler
  const handleLeaveClick = () => {
    setShowModal(true);
  };

  const handleModalLeave = () => {
    setShowModal(false);
    navigate(-1); // 이전 화면으로 이동
  };

  const handleModalCancel = () => {
    setShowModal(false);
  };

  const handleScreenClick = () => {
    setIsScreenClicked((prev) => !prev);
  };

  return (
    <Container>
      {showModal && (
        <Modal 
          title="강의를 나가시겠습니까?"
          content="아직 강의 중이에요!"
          leftButtonText="나가기"
          rightButtonText="취소"
          onLeftButtonClick={handleModalLeave}
          onRightButtonClick={handleModalCancel}
        />
      )}
      <div className={styles.videoSection}>
        <div className={styles.screenShare}>
          <video 
            ref={screenShareVideoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ objectFit: isScreenClicked ? 'cover' : 'contain' }}
          />
        </div>
        <div className={styles.smallVideo}>
          <video 
            ref={webcamVideoRef} 
            autoPlay
            playsInline
            muted 
          />
        </div>
      </div>

      <div className={styles.info}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.instructor}>{instructor}</p>
      </div>

      <div className={styles.chatSection}>
        <div className={styles.chatWindow} ref={chatWindowRef}>
          {messages.map((msg, index) => (
            <div key={index} className={styles.chat}>
              <div className={styles.profContainer}>
                <img
                  src={msg.profileImage}
                  alt="프로필"
                  className={styles.icon}
                />
              </div>  
              <div className={styles.chatContainer}>
                <div className={styles.chatInfo}>
                  <h5>{msg.nickname}</h5>
                  <p>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className={styles.chatBubble}>
                  <p>{msg.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.chatInput}>
          <input 
            type="text" 
            placeholder="메시지를 입력하세요" 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </Container>
  );
};

export default LiveStudent;

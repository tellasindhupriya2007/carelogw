import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, storage } from '../../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSocket } from '../../context/SocketContext';
import { sendMessage as sendSocketMessage, subscribeToMessages, emitTyping, onTyping } from '../../services/socketService';
import { MessageSquare, Send, Wifi, WifiOff, Home, Mic, Square, Pause, Play, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { colors } from '../../styles/colors';

const C = {
    surface: '#F8FAFC',
    surfaceLow: '#F1F5F9',
    surfaceLowest: '#FFFFFF',
    surfaceHigh: '#E2E8F0',
    primary: '#1E3A8A',
    primaryContainer: '#EEF2FF',
    primaryLight: '#3B82F6',
    text: '#0F172A',
    textSub: '#475569',
    textMuted: '#94A3B8',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    outline: '#E2E8F0',
};

export default function ChatInterface({ currentUser, patientId, userRole, onExitChat }) {
    const navigate = useNavigate();
    const { isConnected } = useSocket();

    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [typingPeer, setTypingPeer] = useState(false);
    const [error, setError] = useState(null);

    const [isMobileChat, setIsMobileChat] = useState(window.innerWidth <= 1100);
    const messagesEndRef = useRef(null);
    const typingTimer = useRef(null);
    const unsubMsgs = useRef(null);
    const audioRef = useRef(new Audio());

    const myId = currentUser?.uid;
    const myName = currentUser?.displayName || currentUser?.name || 'User';

    useEffect(() => {
        const handleResize = () => setIsMobileChat(window.innerWidth <= 1100);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showContactList = !isMobileChat || (isMobileChat && !activeContact);
    const showChatWindow = !isMobileChat || (isMobileChat && !!activeContact);

    useEffect(() => {
        if (!patientId || !myId) { setLoadingContacts(false); return; }
        const buildContacts = async () => {
            try {
                const pDoc = await getDoc(doc(db, 'patients', patientId));
                if (!pDoc.exists()) { setLoadingContacts(false); return; }
                const pat = pDoc.data();
                const cMap = [];
                const addPeer = async (id, role, defaultName, Icon, bg, color) => {
                    if (id === myId) return;
                    let name = defaultName;
                    const uSnap = await getDoc(doc(db, 'users', id));
                    if (uSnap.exists()) name = uSnap.data().name || uSnap.data().displayName || defaultName;
                    cMap.push({ peerId: id, peerName: name, peerRole: role, avatar: name.charAt(0), bg, color, Icon });
                };
                const tasks = [];
                if (pat.doctorId) tasks.push(addPeer(pat.doctorId, 'Doctor', 'Doctor', null, '#EEF2FF', '#1E40AF'));
                if (pat.caretakerId) tasks.push(addPeer(pat.caretakerId, 'Caregiver', 'Caregiver', null, '#EDE9FE', '#712AE2'));
                if (pat.familyId) tasks.push(addPeer(pat.familyId, 'Family', 'Family', null, '#DCFCE7', '#059669'));
                await Promise.all(tasks);
                setContacts(cMap);
                if (cMap.length > 0) setActiveContact(cMap[0]);
            } catch (err) { console.error(err); } finally { setLoadingContacts(false); }
        };
        buildContacts();
    }, [patientId, myId]);

    useEffect(() => {
        if (!activeContact?.peerId) return;
        setLoadingMsgs(true);
        if (unsubMsgs.current) unsubMsgs.current();
        const unsub = subscribeToMessages(myId, activeContact.peerId, (msgs) => {
            setMessages(msgs);
            setLoadingMsgs(false);
        });
        unsubMsgs.current = unsub;
        const unsubTyping = onTyping(({ senderId, isTyping }) => {
            if (senderId === activeContact.peerId) setTypingPeer(isTyping);
        });
        return () => { if (unsubMsgs.current) unsubMsgs.current(); unsubTyping(); };
    }, [activeContact?.peerId, myId]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typingPeer]);

    const handleSendText = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        const text = input;
        setInput('');
        try {
            await sendSocketMessage({
                senderId: myId, senderName: myName, senderRole: userRole,
                receiverId: activeContact.peerId, patientId: patientId || null,
                type: 'text', message: text
            });
        } catch { setInput(text); } finally { setSending(false); }
    };

    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: C.surface, height: '100%' }}>
            {showContactList && (
                <div style={{ width: isMobileChat ? '100%' : '280px', borderRight: `1px solid ${C.outline}`, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                    <div style={{ padding: '20px', borderBottom: `1px solid ${C.outline}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {isMobileChat && onExitChat && (
                                <button onClick={onExitChat} style={{ background: 'white', border: `1px solid ${C.outline}`, borderRadius: '8px', padding: '6px 10px', fontSize: '13px', fontWeight: '800' }}>←</button>
                            )}
                            <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>Clinical Chat</h2>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                        {contacts.map(c => (
                            <div key={c.peerId} onClick={() => setActiveContact(c)} style={{ padding: '12px', borderRadius: '12px', backgroundColor: activeContact?.peerId === c.peerId ? '#F1F5F9' : 'transparent', cursor: 'pointer', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900' }}>{c.avatar}</div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '800' }}>{c.peerName}</div>
                                    <div style={{ fontSize: '11px', color: C.textMuted }}>{c.peerRole}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showChatWindow && activeContact && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.outline}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isMobileChat && (
                            <button 
                                onClick={() => {
                                    if (onExitChat && contacts.length <= 1) onExitChat();
                                    else setActiveContact(null);
                                }} 
                                style={{ background: 'white', border: `1px solid ${C.outline}`, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '800' }}
                            >
                                ← Back
                            </button>
                        )}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '800' }}>{activeContact.peerName}</div>
                            <div style={{ fontSize: '11px', color: C.success, fontWeight: '700' }}>Active · {activeContact.peerRole}</div>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F8FAFC' }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ alignSelf: m.senderId === myId ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '10px 14px', borderRadius: '16px', backgroundColor: m.senderId === myId ? C.primary : 'white', color: m.senderId === myId ? 'white' : C.text, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontSize: '14px' }}>
                                {m.message}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.outline}`, display: 'flex', gap: '10px' }}>
                        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendText()} placeholder="Type a message..." style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1px solid ${C.outline}`, outline: 'none' }} />
                        <button onClick={handleSendText} style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: C.primary, color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={18} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}

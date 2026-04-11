import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToMessages, sendMessage as sendSocketMessage, initSocket } from '../../services/socketService';
import { Send, ChevronLeft, ShieldCheck, HeartPulse, UserCircle } from 'lucide-react';

export default function ChatInterface({ currentUser, patientId, userRole, onExitChat }) {
    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const messagesEndRef = useRef(null);
    const unsubMsgs = useRef(null);

    const myId = currentUser?.uid;
    const myName = currentUser?.displayName || currentUser?.name || 'User';

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        if (myId) initSocket({ userId: myId, role: userRole, name: myName });
        return () => window.removeEventListener('resize', handleResize);
    }, [myId, userRole, myName]);

    useEffect(() => {
        if (!patientId || !myId) return;
        const buildContacts = async () => {
            try {
                const pDoc = await getDoc(doc(db, 'patients', patientId));
                if (!pDoc.exists()) return;
                const pat = pDoc.data();
                
                // DATA MAPPING FIX: Syncing with patientService.js field names
                const doctorId = pat.doctorId;
                const familyId = pat.familyId;
                
                // Extract all possible caretaker IDs (Legacy single field + Multi-support array)
                const candidateCaretakerIds = new Set();
                if (pat.caregiverId) candidateCaretakerIds.add(pat.caregiverId);
                if (pat.caretakerIds && Array.isArray(pat.caretakerIds)) {
                    pat.caretakerIds.forEach(id => candidateCaretakerIds.add(id));
                }
                if (pat.caretakerId) candidateCaretakerIds.add(pat.caretakerId);

                const cList = [];
                const addPeer = async (id, role, bg, color) => {
                    if (!id || id === myId) return;
                    const uSnap = await getDoc(doc(db, 'users', id));
                    if (uSnap.exists()) {
                        const uData = uSnap.data();
                        const name = uData.name || uData.displayName || role;
                        cList.push({ peerId: id, peerName: name, peerRole: role, avatar: name.charAt(0), bg, color });
                    } else {
                        cList.push({ peerId: id, peerName: `Assigned Caregiver`, peerRole: role, avatar: '👤', bg: '#F2F4F7', color: '#667085' });
                    }
                };

                const tasks = [];
                if (doctorId) tasks.push(addPeer(doctorId, 'Attending Physician', '#F0F5FF', '#0052FF'));
                if (familyId) tasks.push(addPeer(familyId, 'Family Member', '#F0FDF4', '#16A34A'));
                
                // Add all unique caregivers to the chat list
                Array.from(candidateCaretakerIds).forEach(cid => {
                    tasks.push(addPeer(cid, 'Primary Caretaker', '#F5F3FF', '#7C3AED'));
                });

                await Promise.all(tasks);
                setContacts(cList);
                if (cList.length > 0 && !activeContact) setActiveContact(cList[0]);
            } catch (err) {
                console.error("Clinical Hub Error:", err);
            }
        };
        buildContacts();
    }, [patientId, myId]);

    useEffect(() => {
        if (!activeContact?.peerId) return;
        if (unsubMsgs.current) unsubMsgs.current();
        unsubMsgs.current = subscribeToMessages(myId, activeContact.peerId, setMessages);
        return () => unsubMsgs.current && unsubMsgs.current();
    }, [activeContact?.peerId, myId]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSendText = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        const text = input;
        setInput('');
        try {
            await sendSocketMessage({ senderId: myId, senderName: myName, senderRole: userRole, receiverId: activeContact.peerId, patientId, type: 'text', message: text });
        } catch (err) { setInput(text); } finally { setSending(false); }
    };

    const showSidebar = !isMobile || (isMobile && !activeContact);
    const showChat = !isMobile || (isMobile && !!activeContact);

    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%', backgroundColor: 'white' }}>
            {showSidebar && (
                <div style={{ width: isMobile ? '100%' : '280px', borderRight: '1px solid #EAECF0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #EAECF0' }}>
                        {isMobile && onExitChat && <button onClick={onExitChat} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '900', color: '#0052FF', marginBottom: '8px' }}><ChevronLeft size={18}/> Back</button>}
                        <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>Care Team Hub</h2>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: '#98A2B3', textTransform: 'uppercase', marginTop: '2px' }}>Patient: CL-2026-ACTIVE</div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                        {contacts.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#98A2B3' }}>
                                <UserCircle size={40} style={{ opacity: 0.1, display: 'block', margin: '0 auto 12px' }}/>
                                <div style={{ fontSize: '12px', fontWeight: '700' }}>No members found in clinical registry.</div>
                            </div>
                        ) : contacts.map(c => (
                            <div key={c.peerId} onClick={() => setActiveContact(c)} style={{ padding: '14px', borderRadius: '16px', backgroundColor: activeContact?.peerId === c.peerId ? '#F8FAFF' : 'transparent', cursor: 'pointer', marginBottom: '4px', border: activeContact?.peerId === c.peerId ? '1.5px solid #0052FF' : '1px solid transparent', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.1s' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px' }}>{c.avatar}</div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#101828', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.peerName}</div>
                                    <div style={{ fontSize: '11px', color: '#667085', fontWeight: '800' }}>{c.peerRole}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showChat && activeContact && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F9FAFB' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid #EAECF0', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 10 }}>
                        {isMobile && (
                            <button onClick={() => { if (contacts.length <= 1 && onExitChat) onExitChat(); else setActiveContact(null); }} style={{ background: 'none', border: 'none', padding: '4px' }}><ChevronLeft size={24}/></button>
                        )}
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: activeContact.bg, color: activeContact.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900' }}>{activeContact.avatar}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '900', color: '#101828' }}>{activeContact.peerName}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#079455', fontWeight: '800' }}>
                                <ShieldCheck size={11}/> SECURE BIOMETRIC CHANNEL
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 16px 80px' : '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {messages.map((m, i) => {
                            const isMine = m.senderId === myId;
                            return (
                                <div key={i} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                    <div style={{ backgroundColor: isMine ? '#101828' : 'white', color: isMine ? 'white' : '#101828', padding: '10px 14px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '14px', fontWeight: '600', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: isMine ? 'none' : '1px solid #EAECF0' }}>{m.message}</div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <div style={{ padding: '12px 16px', backgroundColor: 'white', borderTop: '1px solid #EAECF0' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendText()} placeholder="Type observation..." style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #EAECF0', backgroundColor: '#F9FAFB', outline: 'none', fontSize: '14px', fontWeight: '600' }} />
                            <button onClick={handleSendText} disabled={!input.trim()} style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: input.trim() ? '#0052FF' : '#F2F4F7', color: input.trim() ? 'white' : '#98A2B3', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Send size={18}/></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

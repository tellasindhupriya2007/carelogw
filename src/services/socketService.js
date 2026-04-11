/**
 * CareLog — Socket.IO Client Service
 *
 * Architecture:
 *   - Single socket instance (singleton) shared across app
 *   - Firestore handles persistence (messages collection)
 *   - Socket.IO handles real-time delivery only
 *   - Automatic fallback: if socket not connected, Firestore onSnapshot still works
 */

import { io } from 'socket.io-client';
import { db } from '../firebase/config';
import {
    collection, addDoc, query, where,
    onSnapshot, serverTimestamp
} from 'firebase/firestore';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4001';

// ─── Singleton Socket Instance ───────────────────────────
let socket = null;

export const getSocket = () => socket;

/**
 * Initialize socket and join user's room.
 * Safe to call multiple times — only connects once.
 */
export const initSocket = ({ userId, role, name }) => {
    if (!userId) return null;

    // Already connected with same user
    if (socket && socket.connected && socket._userId === userId) return socket;

    // Clean up old socket
    if (socket) { socket.disconnect(); socket = null; }

    socket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'], // Try polling first for better compatibility
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
        withCredentials: true,
    });

    socket._userId = userId;

    socket.on('connect', () => {
        console.log('--- SOCKET CONNECTED ---');
        console.log('[Socket] ID:', socket.id);
        socket.emit('join', { userId, role, name });
    });

    socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection failed (Firestore fallback active):', err.message);
        // Explicitly attempt reconnection if autoConnect didn't catch it
        setTimeout(() => {
            if (socket && !socket.connected) socket.connect();
        }, 5000);
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        if (reason === 'io server disconnect') {
            // the disconnection was initiated by the server, you need to reconnect manually
            socket.connect();
        }
    });

    return socket;
};

/**
 * Disconnect and clear socket.
 */
export const disconnectSocket = () => {
    if (socket) { socket.disconnect(); socket = null; }
};

// ─── MESSAGING API ───────────────────────────────────────

/**
 * Send a message.
 * 1. Saves to Firestore (persists regardless of socket state)
 * 2. Emits via Socket.IO for instant delivery if connected
 */
export const sendMessage = async ({ senderId, senderName, senderRole, receiverId, patientId, message, type = 'text', audioUrl = null, imageUrl = null, duration = null }) => {
    if (!senderId || !receiverId) throw new Error('Invalid message params');
    if (type === 'text' && !message?.trim()) throw new Error('Text message cannot be empty');
    if (type === 'voice' && !audioUrl) throw new Error('Voice message requires audioUrl');
    if (type === 'image' && !imageUrl) throw new Error('Image message requires imageUrl');

    // 1. Persist to Firestore
    const docRef = await addDoc(collection(db, 'messages'), {
        senderId,
        senderName: senderName || senderId,
        senderRole: senderRole || 'unknown',
        receiverId,
        patientId: patientId || null,
        type,
        message: message?.trim() || '',
        audioUrl,
        imageUrl,
        duration,
        timestamp: serverTimestamp(),
        isRead: false,
    });

    // 2. Emit via Socket.IO (best-effort, no throw on failure)
    if (socket?.connected) {
        socket.emit('send_message', {
            ...({ senderId, senderName, senderRole, receiverId, patientId, message, type, audioUrl, imageUrl, duration }),
            messageId: docRef.id,
            timestamp: new Date().toISOString(),
        });
    }

    return docRef.id;
};

/**
 * Subscribe to messages for a conversation thread.
 * Uses Firestore onSnapshot (real-time, persistent fallback).
 * Also listens on socket for instant delivery.
 *
 * Returns unsubscribe function.
 */
export const subscribeToMessages = (userId, peerId, onMessage) => {
    if (!userId || !peerId) return () => {};

    console.log(`[SocketService] Subscribing to messages between ${userId} and ${peerId}`);

    // Query 1: All messages sent BY me
    const q1 = query(
        collection(db, 'messages'),
        where('senderId', '==', userId)
    );
    // Query 2: All messages sent TO me
    const q2 = query(
        collection(db, 'messages'),
        where('receiverId', '==', userId)
    );

    let msgs1 = [];
    let msgs2 = [];
    let socketMsgs = [];

    const emitMerged = () => {
        // Only keep messages involving the peer
        const f1 = msgs1.filter(m => m.receiverId === peerId);
        const f2 = msgs2.filter(m => m.senderId === peerId);
        
        const all = [...f1, ...f2, ...socketMsgs];
        
        // Multi-stage deduplication: ID or temporary messageId
        const unique = Array.from(new Map(all.map(m => [m.id || m.messageId, m])).values());
        
        const merged = unique.sort((a, b) => {
            const getTs = (m) => {
                const raw = m.timestamp;
                if (!raw) return Date.now(); 
                if (raw.toDate) return raw.toDate().getTime();
                if (typeof raw === 'string') return new Date(raw).getTime();
                if (typeof raw === 'number') return raw;
                return Date.now();
            };
            return getTs(a) - getTs(b);
        });
        
        onMessage(merged);
    };

    const u1 = onSnapshot(q1, (snap) => {
        msgs1 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        emitMerged();
    }, (err) => console.error('[Firestore q1 error]', err));

    const u2 = onSnapshot(q2, (snap) => {
        msgs2 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        emitMerged();
    }, (err) => console.error('[Firestore q2 error]', err));

    // Socket Instant updates
    const handleReceive = (msg) => {
        if (msg.senderId === peerId || msg.receiverId === peerId) {
            socketMsgs.push(msg);
            emitMerged();
        }
    };
    
    if (socket) {
        socket.on('receive_message', handleReceive);
        socket.on('message_delivered', (ack) => {
           // update local temp message if needed
        });
    }

    return () => { 
        u1(); 
        u2(); 
        if (socket) socket.off('receive_message', handleReceive);
    };
};

/**
 * Get all threads for a user (unique peers they've messaged).
 */
export const subscribeToThreads = (userId, onThreads) => {
    if (!userId) return () => {};

    // No orderBy — avoids composite index requirement, sorted client-side
    const q = query(
        collection(db, 'messages'),
        where('senderId', '==', userId)
    );
    const q2 = query(
        collection(db, 'messages'),
        where('receiverId', '==', userId)
    );

    const threads = new Map();

    const merge = () => onThreads([...threads.values()].sort((a, b) => b.lastTs - a.lastTs));

    const addToThreads = (msgs, myId) => {
        msgs.forEach(m => {
            const peerId = m.senderId === myId ? m.receiverId : m.senderId;
            if (!threads.has(peerId) || threads.get(peerId).lastTs < m.lastTs) {
                threads.set(peerId, {
                    peerId,
                    peerName: m.senderId === myId ? (m.receiverName || peerId) : (m.senderName || peerId),
                    peerRole: m.senderId === myId ? (m.receiverRole || '') : (m.senderRole || ''),
                    lastMessage: m.message,
                    lastTs: m.timestamp?.toDate?.() || new Date(m.timestamp || 0),
                    patientId: m.patientId,
                });
            }
        });
        merge();
    };

    const u1 = onSnapshot(q, s => addToThreads(s.docs.map(d => ({ id: d.id, ...d.data() })), userId));
    const u2 = onSnapshot(q2, s => addToThreads(s.docs.map(d => ({ id: d.id, ...d.data() })), userId));

    return () => { u1(); u2(); };
};

/**
 * Emit typing indicator.
 */
export const emitTyping = (senderId, receiverId, isTyping) => {
    if (socket?.connected) socket.emit('typing', { senderId, receiverId, isTyping });
};

/**
 * Listen for typing indicators.
 * Returns unsubscribe function.
 */
export const onTyping = (callback) => {
    if (!socket) return () => {};
    socket.on('user_typing', callback);
    return () => socket.off('user_typing', callback);
};

/**
 * Listen for presence updates.
 */
export const onPresenceUpdate = (callback) => {
    if (!socket) return () => {};
    socket.on('presence_update', callback);
    return () => socket.off('presence_update', callback);
};

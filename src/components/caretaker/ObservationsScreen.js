import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as SocketService from '../../services/socketService';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp, addDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../context/AuthContext';
import { getTodayDateString } from '../../utils/dateHelpers';
import { checkCriticalObservationAndAlert } from '../../utils/alertChecker';
import ScreenHeader from '../../components/common/ScreenHeader';
import { colors } from '../../styles/colors';
import { 
    Mic, Play, Trash2, Pause, Loader2, Smile, Meh, Frown, 
    AlertTriangle, Heart, Camera, X 
} from 'lucide-react';
import { uploadPatientMedia } from '../../services/mediaService';

const moodOptions = [
    { label: 'Very Low', color: '#EF4444', icon: AlertTriangle }, 
    { label: 'Low', color: '#F97316', icon: Frown },      
    { label: 'Neutral', color: '#94A3B8', icon: Meh },  
    { label: 'Good', color: '#3B82F6', icon: Smile },     
    { label: 'Excellent', color: '#10B981', icon: Heart } 
];

export default function ObservationsScreen() {
    const navigate = useNavigate();
    const { user, patientId } = useAuthContext();

    const [mood, setMood] = useState(null);
    const [isCritical, setIsCritical] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [caretakerName, setCaretakerName] = useState('');

    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const [recordTimer, setRecordTimer] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageDescription, setImageDescription] = useState('');

    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const timerInterval = useRef(null);
    const audioRef = useRef(new Audio());

    useEffect(() => {
        const getCaretaker = async () => {
            try {
                const uDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
                if (!uDoc.empty) setCaretakerName(uDoc.docs[0].data().name);
            } catch (e) {
                console.error(e);
            }
        };
        if (user) getCaretaker();
        return () => {
            if (timerInterval.current) clearInterval(timerInterval.current);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, [user]);

    const showToast = (message, type) => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
            if (type === 'success') navigate('/caretaker/dashboard');
        }, 2000);
    };

    const toggleRecording = async () => {
        if (isRecording) {
            stopRecording();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.current.push(event.data);
            };
            mediaRecorder.current.onstop = () => {
                const audioBlobRecord = new Blob(audioChunks.current, { type: 'audio/webm' });
                if (audioBlobRecord.size < 500) {
                    setAudioBlob(null);
                    setAudioUrl(null);
                    alert("Recording too short. Please try again.");
                } else {
                    const audioUrlRecord = URL.createObjectURL(audioBlobRecord);
                    setAudioBlob(audioBlobRecord);
                    setAudioUrl(audioUrlRecord);
                }
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.current.start();
            setIsRecording(true);
            setRecordTimer(0);
            timerInterval.current = setInterval(() => {
                setRecordTimer(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error accessing microphone', err);
            alert('Microphone access denied or unavailable.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
            mediaRecorder.current.stop();
            setIsRecording(false);
            clearInterval(timerInterval.current);
        }
    };

    const togglePlayback = () => {
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(e => {
                console.error("Playback error:", e);
                setIsPlaying(false);
            });
            setIsPlaying(true);
            audioRef.current.onended = () => setIsPlaying(false);
        }
    };

    const deleteRecording = (e) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordTimer(0);
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    };

    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1000;
                    const scale = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
        });
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setSubmitting(true);
            try {
                const compressedDataUrl = await compressImage(file);
                setImagePreview(compressedDataUrl);
                setSelectedImage(compressedDataUrl); 
            } finally {
                setSubmitting(false);
            }
        }
    };

    const handleSave = async () => {
        if (!mood && !audioBlob && !selectedImage) {
            alert("Please record something: mood, voice, or image.");
            return;
        }
        setSubmitting(true);
        try {
            let finalAudioData = "";
            if (audioBlob) {
                finalAudioData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(audioBlob);
                });
            }

            const todayString = getTodayDateString();
            const logRef = await (async () => {
                const q = query(collection(db, 'dailyLogs'), where('patientId', '==', patientId), where('date', '==', todayString));
                const snap = await getDocs(q);
                if (snap.empty) {
                    const newR = doc(collection(db, 'dailyLogs'));
                    await setDoc(newR, { patientId, date: todayString, createdAt: serverTimestamp(), observations: [] });
                    return newR;
                }
                return snap.docs[0].ref;
            })();
            
            if (selectedImage) {
                try {
                    const res = await fetch(selectedImage);
                    const blob = await res.blob();
                    const file = new File([blob], `obs_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    await uploadPatientMedia(patientId, file, imageDescription || 'Observation Photo', user.uid);
                } catch (e) {}
            }

            const newObservation = {
                mood: mood || null,
                hasVoice: !!audioBlob,
                hasImage: !!selectedImage,
                isCritical: !!isCritical,
                caretakerName: caretakerName || 'Caregiver',
                recordedAt: new Date().toISOString()
            };

            await updateDoc(logRef, { observations: arrayUnion(newObservation) });
            await checkCriticalObservationAndAlert(patientId, newObservation).catch(() => {});

            const pDoc = await getDoc(doc(db, 'patients', patientId));
            if (pDoc.exists()) {
                const patData = pDoc.data();
                const familyIds = patData.familyIds || (patData.familyId ? [patData.familyId] : []);
                for (const fId of familyIds) {
                    if (finalAudioData) {
                        await SocketService.sendMessage({
                            patientId, senderId: user.uid, senderRole: 'Caretaker',
                            receiverId: fId, type: 'voice', message: 'Voice Log', audioUrl: finalAudioData
                        });
                    }
                    if (selectedImage) {
                        await SocketService.sendMessage({
                            patientId, senderId: user.uid, senderRole: 'Caretaker',
                            receiverId: fId, type: 'image', message: 'Photo Attachment', imageUrl: selectedImage
                        });
                    }
                }
            }
            showToast('Observation recorded successfully', 'success');
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: toast.type === 'success' ? colors.primaryGreen : colors.alertRed,
                    color: colors.white, padding: '12px 32px', borderRadius: '12px', fontWeight: '800',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 2001, textAlign: 'center'
                }}>
                    {toast.message}
                </div>
            )}

            <ScreenHeader title="Observations" showBack onBack={() => navigate(-1)} />

            <div className="main-content" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                
                <div style={{ backgroundColor: colors.white, padding: '20px', borderRadius: '16px', border: `1px solid ${colors.border}`, marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '13px', fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>Wellness Status</h2>
                        <span style={{ fontSize: '13px', fontWeight: '900', color: colors.primaryBlue }}>{mood || 'None'}</span>
                    </div>
                    
                    <div className="mood-scroller">
                        {moodOptions.map((opt) => {
                            const Icon = opt.icon;
                            return (
                                <button
                                    key={opt.label}
                                    onClick={() => setMood(opt.label)}
                                    className="mood-bubble"
                                    style={{
                                        border: `1.5px solid ${mood === opt.label ? opt.color : '#F1F5F9'}`,
                                        backgroundColor: mood === opt.label ? opt.color : colors.white,
                                        color: mood === opt.label ? colors.white : colors.textSecondary,
                                    }}
                                >
                                    <Icon size={24} color={mood === opt.label ? colors.white : opt.color} />
                                    <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ backgroundColor: colors.white, padding: '20px', borderRadius: '16px', border: `1px solid ${colors.border}`, marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '13px', fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: '16px' }}>Log Evidence</h2>
                    <div className="log-evidence-grid">
                        <div className="evidence-box">
                            {!audioUrl ? (
                                <button
                                    onClick={(e) => { e.preventDefault(); toggleRecording(); }}
                                    style={{
                                        width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                                        backgroundColor: isRecording ? colors.alertRed : colors.primaryBlue,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }}
                                >
                                    {isRecording ? <div style={{ width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '2px' }}/> : <Mic size={20} color={colors.white} />}
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={togglePlayback} style={{ background: colors.primaryBlue, border: 'none', borderRadius: '50%', padding: '8px' }}>
                                        {isPlaying ? <Pause size={16} color="white" /> : <Play size={16} color="white" />}
                                    </button>
                                    <button onClick={deleteRecording} style={{ background: 'none', border: 'none', color: colors.alertRed }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                            <span style={{ fontSize: '11px', fontWeight: '900', color: colors.textSecondary }}>VOICE LOG</span>
                        </div>

                        <div className="evidence-box">
                            {!imagePreview ? (
                                <label style={{ cursor: 'pointer' }}>
                                    <div style={{ 
                                        width: '44px', height: '44px', borderRadius: '50%', backgroundColor: colors.lightBlue,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px'
                                    }}>
                                        <Camera size={20} color={colors.primaryBlue} />
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: colors.textSecondary }}>PHOTO</span>
                                    <input type="file" accept="image/*" capture="environment" onChange={handleImageSelect} style={{ display: 'none' }} />
                                </label>
                            ) : (
                                <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                                    <img src={imagePreview} style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover' }} alt="P" />
                                    <button onClick={() => { setImagePreview(null); setSelectedImage(null); }} style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: 'white', borderRadius: '50%', border: '1px solid #ddd', width: '20px', height: '20px' }}><X size={12} /></button>
                                </div>
                            )}
                            {!imagePreview && <div style={{ height: '0px' }} />}
                        </div>
                    </div>
                </div>

                <div style={{ 
                    backgroundColor: colors.white, padding: '20px', borderRadius: '16px', border: `1px solid ${isCritical ? colors.alertRed : colors.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'
                }}>
                    <div>
                        <h2 style={{ fontSize: '14px', fontWeight: '800', color: colors.textPrimary }}>Critical Observation</h2>
                        <p style={{ fontSize: '11px', color: colors.textSecondary }}>Alert medical personnel</p>
                    </div>
                    <button 
                        onClick={() => setIsCritical(!isCritical)}
                        style={{ 
                            width: '52px', height: '28px', backgroundColor: isCritical ? colors.alertRed : '#E2E8F0', 
                            borderRadius: '20px', border: 'none', transition: '0.3s', position: 'relative', cursor: 'pointer'
                        }}
                    >
                        <div style={{ position: 'absolute', top: '2px', left: isCritical ? '26px' : '2px', width: '24px', height: '24px', backgroundColor: 'white', borderRadius: '50%', transition: '0.3s' }} />
                    </button>
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <div className="action-row">
                        <button 
                            onClick={() => navigate(-1)} 
                            style={{ 
                                height: '52px', borderRadius: '12px', border: `1.5px solid ${colors.border}`,
                                color: colors.textSecondary, fontWeight: '800', backgroundColor: colors.white, flex: 1
                            }}
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={submitting || (!mood && !audioBlob && !selectedImage)}
                            style={{
                                flex: 2, height: '52px', backgroundColor: (submitting || (!mood && !audioBlob && !selectedImage)) ? '#E2E8F0' : (isCritical ? colors.alertRed : colors.primaryBlue),
                                color: colors.white, fontSize: '14px', fontWeight: '900', borderRadius: '12px', border: 'none'
                            }}
                        >
                            {submitting ? "SAVING..." : (isCritical ? "SEND CRITICAL ALERT" : "SUBMIT OBSERVATION")}
                        </button>
                    </div>
                    <p style={{ fontSize: '10px', color: colors.textSecondary, textAlign: 'center', marginTop: '16px' }}>
                        * Signed as {caretakerName || 'Caregiver'}
                    </p>
                </div>
            </div>
            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .spinner { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}

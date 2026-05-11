import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as SocketService from '../../services/socketService';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../context/AuthContext';
import { getTodayDateString } from '../../utils/dateHelpers';
import { checkCriticalObservationAndAlert } from '../../utils/alertChecker';
import CaretakerShell from './CaretakerShell';
import { colors } from '../../styles/colors';
import { 
    Mic, Play, Trash2, Pause, Loader2, Smile, Meh, Frown, 
    AlertTriangle, Heart, Camera, X, Check, Save, RotateCcw
} from 'lucide-react';
import { uploadPatientMedia } from '../../services/mediaService';

const moodOptions = [
    { label: 'Low', color: '#EF4444', icon: Frown },      
    { label: 'Neutral', color: '#94A3B8', icon: Meh },  
    { label: 'Good', color: '#0052FF', icon: Smile },     
    { label: 'Excellent', color: '#079455', icon: Heart } 
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
    const [imagePreview, setImagePreview] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);

    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const timerInterval = useRef(null);
    const audioRef = useRef(new Audio());

    useEffect(() => {
        if (user) {
            getDoc(doc(db, 'users', user.uid)).then(s => {
                if(s.exists()) setCaretakerName(s.data().name);
            });
        }
    }, [user]);

    const showToast = (message, type) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorder.current.stop();
            setIsRecording(false);
            clearInterval(timerInterval.current);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
            mediaRecorder.current.onstop = () => {
                const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.current.start();
            setIsRecording(true);
            setRecordTimer(0);
            timerInterval.current = setInterval(() => setRecordTimer(p => p + 1), 1000);
        } catch (e) { alert("Mic access denied"); }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { setImagePreview(ev.target.result); setSelectedImage(ev.target.result); };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!mood && !audioBlob && !selectedImage) return;
        setSubmitting(true);
        try {
            const today = getTodayDateString();
            const logQ = query(collection(db, 'dailyLogs'), where('patientId', '==', patientId), where('date', '==', today));
            const logSnap = await getDocs(logQ);
            let logRef;
            if (logSnap.empty) {
                logRef = doc(collection(db, 'dailyLogs'));
                await setDoc(logRef, { patientId, date: today, observations: [] });
            } else logRef = logSnap.docs[0].ref;

            let uploadedImageUrl = null;
            let uploadedAudioUrl = null;

            // Individual try-catches for media to prevent absolute failure
            if (selectedImage) {
                try {
                    const blob = await (await fetch(selectedImage)).blob();
                    const file = new File([blob], `obs_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const uploadResult = await uploadPatientMedia(patientId, file, 'Observation Image', user.uid);
                    uploadedImageUrl = uploadResult.url; // Use only the URL string
                } catch (e) {
                    console.warn("Image upload failed, proceeding with text log:", e);
                    showToast("Photo sync failed - saving log only", "warning");
                }
            }

            if (audioBlob) {
                try {
                    const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
                    const uploadResult = await uploadPatientMedia(patientId, file, 'Voice Observation', user.uid);
                    uploadedAudioUrl = uploadResult.url; // Use only the URL string
                } catch (e) {
                    console.warn("Audio upload failed, proceeding with text log:", e);
                    showToast("Voice sync failed - saving log only", "warning");
                }
            }

            const obs = {
                mood, 
                hasVoice: !!uploadedAudioUrl, 
                hasImage: !!uploadedImageUrl, 
                isCritical,
                imageUrl: uploadedImageUrl,
                audioUrl: uploadedAudioUrl,
                caretakerName: caretakerName || 'Caregiver', 
                recordedAt: new Date().toISOString()
            };
            
            await updateDoc(logRef, { observations: arrayUnion(obs) });
            await checkCriticalObservationAndAlert(patientId, obs);
            showToast(isCritical ? "CRITICAL ALERT BROADCASTED" : "Observation Logged", "success");
            setTimeout(() => navigate('/caretaker/dashboard'), 1500);
        } catch (e) { 
            console.error("Critical Save error:", e);
            showToast("Sync Error: Clinical channel blocked", "error"); 
        }
        setSubmitting(false);
    };

    return (
        <CaretakerShell title="Patient Observation Log">
            <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {toast && <div style={{ position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? '#079455' : '#D92D20', color: 'white', padding: '12px 32px', borderRadius: '40px', fontWeight: '900', zIndex: 100 }}>{toast.message}</div>}

                <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #EAECF0' }}>
                    <h2 style={{ fontSize: '13px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginBottom: '24px' }}>Wellness Baseline</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        {moodOptions.map(opt => (
                            <div key={opt.label} onClick={() => setMood(opt.label)} style={{ padding: '16px 8px', borderRadius: '20px', border: `2px solid ${mood === opt.label ? opt.color : '#F2F4F7'}`, background: mood === opt.label ? `${opt.color}08` : 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                                <opt.icon size={28} color={mood === opt.label ? opt.color : '#94A3B8'} />
                                <span style={{ fontSize: '10px', fontWeight: '900', color: mood === opt.label ? opt.color : '#667085' }}>{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #EAECF0' }}>
                    <h2 style={{ fontSize: '13px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginBottom: '20px' }}>Evidence Recording</h2>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, height: '120px', borderRadius: '24px', background: '#F9FAFB', border: '1.5px dashed #EAECF0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', position: 'relative' }}>
                            {!audioUrl ? (
                                <div onClick={toggleRecording} style={{ width: '48px', height: '48px', borderRadius: '50%', background: isRecording ? '#D92D20' : '#0052FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    {isRecording ? <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '2px' }}/> : <Mic size={24}/>}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div onClick={() => { audioRef.current.src = audioUrl; audioRef.current.play(); }} style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#F0F5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0052FF' }}><Play size={20}/></div>
                                    <div onClick={() => { setAudioUrl(null); setAudioBlob(null); }} style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B91C1C' }}><RotateCcw size={20}/></div>
                                </div>
                            )}
                            <span style={{ fontSize: '11px', fontWeight: '950', color: '#667085' }}>{isRecording ? `RECORDING ${recordTimer}s` : (audioUrl ? "VOICE CAPTURED" : "TAP TO RECORD")}</span>
                        </div>

                        <div style={{ flex: 1, height: '120px', borderRadius: '24px', background: '#F9FAFB', border: '1.5px dashed #EAECF0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', overflow: 'hidden' }}>
                            {!imagePreview ? (
                                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F0F5FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0052FF' }}><Camera size={24}/></div>
                                    <span style={{ fontSize: '11px', fontWeight: '950', color: '#667085' }}>CAPTURE PHOTO</span>
                                    <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                                </label>
                            ) : (
                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="P"/>
                                    <div onClick={() => setImagePreview(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14}/></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ background: isCritical ? '#FEF2F2' : 'white', padding: '24px', borderRadius: '24px', border: `1px solid ${isCritical ? '#FCA5A5' : '#EAECF0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: '900', color: isCritical ? '#B91C1C' : '#101828' }}>Critical Red Flag</div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: isCritical ? '#D92D20' : '#667085' }}>Instantly alert the medical team</div>
                    </div>
                    <button onClick={() => setIsCritical(!isCritical)} style={{ width: '52px', height: '28px', background: isCritical ? '#D92D20' : '#E2E8F0', borderRadius: '20px', border: 'none', position: 'relative', transition: '0.3s', cursor: 'pointer' }}>
                        <div style={{ position: 'absolute', top: 2, left: isCritical ? 26 : 2, width: '24px', height: '24px', background: 'white', borderRadius: '50%', transition: '0.3s' }} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                    <button onClick={() => navigate(-1)} style={{ flex: 1, height: '56px', borderRadius: '16px', background: 'white', border: '1px solid #EAECF0', fontWeight: '900', color: '#475467', cursor: 'pointer' }}>Discard</button>
                    <button onClick={handleSave} disabled={submitting || (!mood && !audioBlob && !selectedImage)} style={{ flex: 2, height: '56px', borderRadius: '16px', background: isCritical ? '#D92D20' : '#0052FF', color: 'white', border: 'none', fontWeight: '950', cursor: 'pointer', animation: isCritical ? 'pulse-alert 2s infinite' : 'none' }}>
                        {submitting ? <Loader2 size={24} className="animate-spin" /> : (isCritical ? "SEND CRITICAL ALERT" : "SYNC OBSERVATION")}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes pulse-alert {
                    0% { box-shadow: 0 0 0 0 rgba(217, 45, 32, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(217, 45, 32, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(217, 45, 32, 0); }
                }
            `}</style>
        </CaretakerShell>
    );
}

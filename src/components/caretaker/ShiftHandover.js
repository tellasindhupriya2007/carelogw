import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { getLatestHandover, createShiftHandover } from '../../services/handoverService';
import { getDoc, doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToTasks, subscribeToDailyLogs } from '../../services/taskService';
import { listenToAlerts } from '../../services/alertService';
import CaretakerShell from './CaretakerShell';
import PrimaryButton from '../common/PrimaryButton';
import { CheckCircle2, HeartPulse, Pill, Activity, AlertTriangle, Smile, Clock, Users } from 'lucide-react';

export default function ShiftHandover() {
    const navigate = useNavigate();
    const { user, patientId } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [recording, setRecording] = useState(false);
    const [incomingName, setIncomingName] = useState('');
    const [snapshot, setSnapshot] = useState(null);
    const [caregiverName, setCaregiverName] = useState('Caregiver');
    const [toast, setToast] = useState(null);
    const [handoverSubmitted, setHandoverSubmitted] = useState(false);
    const [liveTasks, setLiveTasks] = useState([]);
    const [liveVitals, setLiveVitals] = useState(null);
    const [liveAlerts, setLiveAlerts] = useState([]);
    const [liveCompletions, setLiveCompletions] = useState({});

    useEffect(() => {
        const init = async () => {
            if (user) {
                const uDoc = await getDoc(doc(db, 'users', user.uid));
                if (uDoc.exists()) setCaregiverName(uDoc.data().name || 'Caregiver');
            }
            if (patientId) {
                const data = await getLatestHandover(patientId);
                setSnapshot(data);
                const snapDate = data?.createdAt?.toDate?.() || new Date(data?.createdAt || 0);
                const twelveHoursAgo = new Date();
                twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
                setHandoverSubmitted(snapDate > twelveHoursAgo && data?.caregiverId === user?.uid);
            }
            setLoading(false);
        };
        init();

        if (patientId) {
            const unsubTasks = subscribeToTasks(patientId, setLiveTasks);
            const unsubLogs = subscribeToDailyLogs(patientId, setLiveCompletions);
            const unsubAlerts = listenToAlerts(patientId, setLiveAlerts);
            onSnapshot(query(collection(db, 'vitals'), where('patientId', '==', patientId)), (snap) => {
                if (!snap.empty) {
                    const sorted = snap.docs.map(d => ({ ...d.data(), id: d.id }))
                        .sort((a,b) => (b.recordedAt?.toMillis?.() || 0) - (a.recordedAt?.toMillis?.() || 0));
                    setLiveVitals(sorted[0]);
                }
            });
            return () => { unsubTasks(); unsubLogs(); unsubAlerts(); };
        }
    }, [user, patientId]);

    const handleRecordHandover = async () => {
        if (!incomingName.trim()) return alert("Enter incoming caretaker name");
        setRecording(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), { name: incomingName, lastHandoverAt: serverTimestamp() });
            await createShiftHandover(patientId, user.uid, caregiverName);
            setHandoverSubmitted(true);
            setToast('Handover Logged Successfully');
            setTimeout(() => window.location.reload(), 2000);
        } catch (e) { setToast('Sync Error'); }
        setRecording(false);
    };

    const displayTasks = (handoverSubmitted && snapshot) ? snapshot.tasks : liveTasks.map(t => ({ ...t, status: liveCompletions[t.id]?.completed ? 'completed' : 'pending' }));
    const displayVitals = (handoverSubmitted && snapshot) ? snapshot.vitals : liveVitals;
    const displayCompleted = displayTasks.filter(t => t.status === 'completed').length;
    const displayPending = displayTasks.filter(t => t.status === 'pending').length;

    return (
        <CaretakerShell title="Shift Verification">
            <div style={{ padding: '32px', maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {toast && <div style={{ position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', background: '#101828', color: 'white', padding: '12px 32px', borderRadius: '40px', fontWeight: '900', zIndex: 100 }}>{toast}</div>}

                <div style={{ background: handoverSubmitted ? '#ECFDF5' : '#FFFBEB', padding: '24px', borderRadius: '24px', border: `1px solid ${handoverSubmitted ? '#A7F3D0' : '#FEF3C7'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: handoverSubmitted ? '#059669' : '#B45309', marginBottom: '8px' }}>
                        {handoverSubmitted ? <CheckCircle2 size={20}/> : <Clock size={20}/>}
                        <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>{handoverSubmitted ? 'Shift Validated' : 'Active Duty Snapshot'}</h3>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#101828' }}>{handoverSubmitted ? `Logged by ${snapshot.caregiverName}` : `Signed: ${caregiverName}`}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ background: '#F0FDF4', padding: '24px', borderRadius: '24px', border: '1px solid #BBF7D0', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: '#15803D' }}>{displayCompleted}</div>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#15803D', textTransform: 'uppercase' }}>Events Logged</div>
                    </div>
                    <div style={{ background: '#FEF2F2', padding: '24px', borderRadius: '24px', border: '1px solid #FECACA', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: '900', color: '#B91C1C' }}>{displayPending}</div>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#B91C1C', textTransform: 'uppercase' }}>Missing Sign-offs</div>
                    </div>
                </div>

                {!handoverSubmitted && (
                    <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #0052FF33' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Users size={24} color="#0052FF" />
                            <h3 style={{ fontSize: '18px', fontWeight: '900' }}>Incoming Personnel</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '900', color: '#667085' }}>FULL NAME</label>
                            <input type="text" placeholder="Enter name of takeover caretaker" value={incomingName} onChange={e => setIncomingName(e.target.value)} style={{ width: '100%', height: '52px', background: '#F9FAFB', border: '1px solid #EAECF0', borderRadius: '14px', padding: '0 16px', fontWeight: '800' }} />
                        </div>
                        <button onClick={handleRecordHandover} disabled={recording} style={{ width: '100%', height: '56px', background: '#0052FF', color: 'white', borderRadius: '16px', border: 'none', fontWeight: '950', marginTop: '24px', cursor: 'pointer' }}>Generate Shift Snapshot</button>
                    </div>
                )}

                <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #EAECF0' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '24px' }}>Shift Task Index</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                        {displayTasks.map((t, i) => (
                            <div key={i} style={{ padding: '16px 20px', borderRadius: '18px', background: t.status === 'completed' ? '#F6FEF9' : '#F9FAFB', border: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: '850', color: '#101828' }}>{t.title}</div>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#667085' }}>{t.time} • {t.category}</div>
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: '950', padding: '4px 10px', borderRadius: '8px', background: t.status === 'completed' ? '#DCFCE7' : '#F1F5F9', color: t.status === 'completed' ? '#166534' : '#667085' }}>{t.status.toUpperCase()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </CaretakerShell>
    );
}

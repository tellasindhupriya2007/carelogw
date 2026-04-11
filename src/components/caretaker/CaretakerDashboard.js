import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, doc, getDoc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import CaretakerShell from './CaretakerShell';
import PrimaryButton from '../../components/common/PrimaryButton';
import InputField from '../../components/common/InputField';
import { colors } from '../../styles/colors';
import { Check, Clock, UserCircle, ShieldAlert, HeartPulse } from 'lucide-react';
import { subscribeToTasks, subscribeToDailyLogs, toggleTaskCompletion } from '../../services/taskService';
import CaretakerSidePanel from './CaretakerSidePanel';

export default function CaretakerDashboard() {
    const navigate = useNavigate();
    const { user, patientId, setPatientId } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [humanPatientId, setHumanPatientId] = useState('');
    const [patientInfo, setPatientInfo] = useState({ name: '', allergies: 'None' });
    const [latestVitals, setLatestVitals] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [completions, setCompletions] = useState({});
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

    const [inputId, setInputId] = useState('');
    const [integrating, setIntegrating] = useState(false);

    const handleIntegrate = async () => {
        if (!inputId.trim()) return;
        setIntegrating(true);
        try {
            const q = query(collection(db, 'patients'), where('patientId', '==', inputId.trim()));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const pDoc = snap.docs[0];
                setPatientId(pDoc.id);
                localStorage.setItem('caretaker_patient_link', pDoc.id);
            } else {
                alert("Clinical ID not found. Please verify with family.");
            }
        } catch (e) { alert("Integration error."); }
        setIntegrating(false);
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const savedLink = localStorage.getItem('caretaker_patient_link');
        if (savedLink && !patientId) setPatientId(savedLink);
    }, [patientId, setPatientId]);

    useEffect(() => {
        if (!patientId) return;
        getDoc(doc(db, 'patients', patientId)).then(s => {
            if (s.exists()) {
                const d = s.data();
                setHumanPatientId(d.patientId || '');
                setPatientInfo({ name: d.name, allergies: d.allergies || 'None' });
            }
        });

        const unsubTasks = subscribeToTasks(patientId, setTasks, (err) => {
            if (err.code === 'permission-denied') setError('RESTRICTED');
        });
        const unsubLogs = subscribeToDailyLogs(patientId, setCompletions);
        
        const qV = query(collection(db, 'vitals'), where('patientId', '==', patientId));
        const unsubVitals = onSnapshot(qV, (s) => {
            if (!s.empty) {
                const sorted = s.docs.map(d => ({ ...d.data(), id: d.id }))
                    .sort((a, b) => (b.recordedAt?.toMillis?.() || 0) - (a.recordedAt?.toMillis?.() || 0));
                setLatestVitals(sorted[0]);
            }
        });

        setLoading(false);
        return () => { unsubTasks(); unsubLogs(); unsubVitals(); };
    }, [patientId]);

    const progressPercent = tasks.length > 0 ? (tasks.filter(t => completions[t.id]?.completed).length / tasks.length) * 100 : 0;

    const handleTaskCheck = async (taskId, current) => {
        try {
            await toggleTaskCompletion(patientId, taskId, user.uid, !current);
        } catch (e) { console.error("Sync error"); }
    };

    if (error === 'RESTRICTED') {
        return (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <ShieldAlert size={64} color="#D92D20" style={{ marginBottom: '24px' }} />
                <h2 style={{ fontSize: '24px', fontWeight: '900' }}>Access Restricted</h2>
                <PrimaryButton label="Sign Out" onClick={() => navigate('/')} />
            </div>
        );
    }

    return (
        <CaretakerShell>
            <div style={{ padding: isMobile ? '16px' : '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {!patientId ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <UserCircle size={64} color="#0052FF" style={{ marginBottom: '20px' }} />
                        <h2 style={{ fontSize: '20px', fontWeight: '900' }}>Patient Linking Required</h2>
                        <div style={{ maxWidth: '360px', margin: '24px auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <InputField 
                                placeholder="CL-2026-XXXX" 
                                value={inputId} 
                                onChange={(e) => setInputId(e.target.value)} 
                            />
                            <PrimaryButton 
                                label={integrating ? "Synchronizing..." : "Integrate Profile"} 
                                onClick={handleIntegrate} 
                                disabled={integrating}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
                            <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #EAECF0' }}>
                                <div style={{ fontSize: '11px', fontWeight: '900', color: '#667085', textTransform: 'uppercase' }}>Patient Profile</div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#101828', margin: '8px 0' }}>{patientInfo.name}</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#0052FF', background: '#F0F5FF', padding: '4px 8px', borderRadius: '6px' }}>{humanPatientId}</span>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#B91C1C', background: '#FEF2F2', padding: '4px 8px', borderRadius: '6px' }}>ALLERGIES: {patientInfo.allergies}</span>
                                </div>
                            </div>
                            <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid #EAECF0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800' }}>Care Completion</span>
                                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#079455' }}>{Math.round(progressPercent)}%</span>
                                </div>
                                <div style={{ height: '8px', background: '#F2F4F7', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${progressPercent}%`, height: '100%', background: '#079455' }} />
                                </div>
                            </div>
                            <div style={{ background: '#101828', padding: '24px', borderRadius: '24px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: '800', opacity: 0.6 }}>LATEST HEART RATE</div>
                                    <div style={{ fontSize: '20px', fontWeight: '900' }}>{latestVitals ? `${latestVitals.heartRate} BPM` : '--'}</div>
                                </div>
                                <button onClick={() => navigate('/caretaker/vitals')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', color: 'white', padding: '10px 16px', fontWeight: '800' }}>Update</button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '24px', alignItems: 'start' }}>
                            <div style={{ background: 'white', padding: '28px', borderRadius: '28px', border: '1px solid #EAECF0' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '24px' }}>Day Checklist</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {tasks.map(t => (
                                        <div key={t.id} onClick={() => handleTaskCheck(t.id, completions[t.id]?.completed)} style={{ padding: '18px', borderRadius: '18px', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', background: completions[t.id]?.completed ? '#F6FEF9' : 'white' }}>
                                            <div style={{ width: '26px', height: '26px', borderRadius: '8px', border: '2.5px solid #D0D5DD', display: 'flex', alignItems: 'center', justifyContent: 'center', background: completions[t.id]?.completed ? '#079455' : 'transparent', borderColor: completions[t.id]?.completed ? '#079455' : '#D0D5DD' }}>
                                                {completions[t.id]?.completed && <Check size={16} color="white" />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '15px', fontWeight: '800', color: completions[t.id]?.completed ? '#065F46' : '#101828' }}>{t.title}</div>
                                                <div style={{ fontSize: '12px', color: '#667085', fontWeight: '700' }}>{t.time} · {t.category}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {!isMobile && <CaretakerSidePanel />}
                        </div>
                    </>
                )}
            </div>
        </CaretakerShell>
    );
}

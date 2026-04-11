import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { statusMeta } from './ds';
import DoctorShell from './DoctorShell';
import PatientDetails from './PatientDetails';
import { subscribeToDoctorPatients } from '../../services/patientService';
import { Search, Activity, Plus, Users, AlertTriangle, CheckCircle, HeartPulse, Thermometer } from 'lucide-react';

export default function DoctorDashboard() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const [patients, setPatients] = useState([]);
    const [enrichedPatients, setEnrichedPatients] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [alertCount, setAlertCount] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!user?.uid) return;
        return subscribeToDoctorPatients(user.uid, (pts) => {
            setPatients(pts.filter(p => !!p.patientId).map(pt => ({
                ...pt, status: 'ORANGE', lastUpdated: '--:--', latestVitals: null,
            })));
        });
    }, [user?.uid]);

    useEffect(() => {
        if (patients.length === 0) { setEnrichedPatients([]); return; }
        let currentEnrichments = {};
        const unsubs = patients.map(pt => {
            const vQ = query(collection(db, 'vitals'), where('patientId', '==', pt.id));
            return onSnapshot(vQ, (vSnap) => {
                let status = 'ORANGE', lastUpdated = '--:--', latestVitals = null;
                if (!vSnap.empty) {
                    latestVitals = vSnap.docs
                        .map(d => d.data())
                        .sort((a, b) => {
                            const tA = a.recordedAt?.toMillis ? a.recordedAt.toMillis() : (a.recordedAt ? new Date(a.recordedAt).getTime() : 0);
                            const tB = b.recordedAt?.toMillis ? b.recordedAt.toMillis() : (b.recordedAt ? new Date(b.recordedAt).getTime() : 0);
                            return tB - tA;
                        })[0];
                    const sys = latestVitals.bp?.systolic || latestVitals.bpSystolic || 0;
                    const dia = latestVitals.bp?.diastolic || latestVitals.bpDiastolic || 0;
                    const hr = latestVitals.heartRate || latestVitals.hr || 0;
                    const temp = latestVitals.temperature || latestVitals.temp || 0;

                    const isAbnormal = (sys >= 140 || sys <= 90 || dia >= 90) || (hr >= 110 || hr <= 50) || (temp >= 100.4 || temp <= 95);
                    status = isAbnormal ? 'RED' : 'GREEN';

                    if (latestVitals.recordedAt) {
                        const date = latestVitals.recordedAt?.toMillis ? latestVitals.recordedAt.toDate() : new Date(latestVitals.recordedAt);
                        lastUpdated = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                }
                currentEnrichments[pt.id] = { status, lastUpdated, latestVitals };
                setEnrichedPatients(patients.map(p => ({ ...p, ...(currentEnrichments[p.id] || { status: 'ORANGE', lastUpdated: '--:--', latestVitals: null }) })));
            });
        });
        return () => unsubs.forEach(u => u());
    }, [patients]);

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'alerts'), where('isRead', '==', false), where('doctorId', '==', user.uid));
        return onSnapshot(q, snap => setAlertCount(snap.size));
    }, [user?.uid]);

    const displayPatients = enrichedPatients.length > 0 ? enrichedPatients : patients;
    const filtered = displayPatients.filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const showRegistry = !isMobile || (isMobile && !selectedPatientId);
    const showDetails = !isMobile || (isMobile && !!selectedPatientId);

    return (
        <DoctorShell alertCount={alertCount}>
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                {showRegistry && (
                    <div style={{ 
                        width: isMobile ? '100%' : '300px', 
                        minWidth: isMobile ? '100%' : '300px',
                        borderRight: isMobile ? 'none' : '1px solid #EAECF0',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ padding: isMobile ? '12px' : '20px', borderBottom: '1px solid #EAECF0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h1 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#101828', margin: 0, letterSpacing: '-0.5px' }}>Registry</h1>
                                <button onClick={() => navigate('/doctor/add-patient')} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#0052FF', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} color="#98A2B3" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: '10px', border: '1px solid #EAECF0', backgroundColor: '#F9FAFB', fontSize: '14px' }} />
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {filtered.map(pt => {
                                const isSelected = selectedPatientId === pt.id;
                                const meta = statusMeta(pt.status);
                                return (
                                    <div key={pt.id} onClick={() => setSelectedPatientId(pt.id)} style={{ 
                                        backgroundColor: isSelected ? '#F8FAFF' : 'white', 
                                        borderRadius: '12px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer', 
                                        border: isSelected ? '1.5px solid #0052FF' : '1px solid #F2F4F7',
                                        transition: 'all 0.1s'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isSelected ? '#0052FF' : '#F2F4F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900', color: isSelected ? 'white' : '#475467' }}>{(pt.name || 'P').charAt(0)}</div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#101828', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pt.name}</div>
                                                    <div style={{ fontSize: '10px', color: '#667085', fontWeight: '700', marginTop: '4px' }}>{pt.age}y · {pt.condition}</div>
                                                </div>
                                            </div>
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: meta.color, border: '2px solid #fff', marginTop: '4px' }}></div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', padding: '6px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '800' }}>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Blood Pressure"><Activity size={10} color="#0052FF" /> {pt.latestVitals ? `${pt.latestVitals.bp?.systolic || pt.latestVitals.bpSystolic || '--'}/${pt.latestVitals.bp?.diastolic || pt.latestVitals.bpDiastolic || '--'}` : '--/--'}</div>
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Heart Rate"><HeartPulse size={10} color="#D92D20" /> {pt.latestVitals?.heartRate || pt.latestVitals?.hr || '--'}</div>
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Temperature"><Thermometer size={10} color="#F79009" /> {pt.latestVitals?.temperature || pt.latestVitals?.temp || '--'}°</div>
                                            </div>
                                            <span style={{ color: '#98A2B3', fontSize: '9px' }}>{pt.lastUpdated}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {showDetails && (
                    <div style={{ flex: 1, backgroundColor: 'white', overflow: 'hidden' }}>
                        {selectedPatientId ? <PatientDetails inlinePatientId={selectedPatientId} onClose={() => setSelectedPatientId(null)} /> : 
                        <WelcomePanel user={user} patients={displayPatients} alertCount={alertCount} onSelect={setSelectedPatientId} isMobile={isMobile} />}
                    </div>
                )}
            </div>
        </DoctorShell>
    );
}

function WelcomePanel({ user, patients, alertCount, onSelect, isMobile }) {
    const criticals = patients.filter(p => p.status === 'RED');
    return (
        <div style={{ padding: isMobile ? '16px' : '40px', height: '100%', overflowY: 'auto' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <header style={{ marginBottom: isMobile ? '20px' : '40px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '900', color: '#0052FF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Clinical Command Active</div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '36px', fontWeight: '900', color: '#101828', margin: 0, letterSpacing: '-1px' }}>Good morning, Dr. {user?.displayName?.split(' ')[0] || 'Clinical'}</h1>
                    <p style={{ fontSize: '13px', color: '#667085', fontWeight: '700', marginTop: '2px' }}>{patients.length} monitors online · Diagnostic Sync Active.</p>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px', marginBottom: '24px' }}>
                    {[
                        { label: 'Registry', value: patients.length, color: '#0052FF', bg: '#F0F5FF', icon: Users },
                        { label: 'Alerts', value: alertCount, color: '#D92D20', bg: '#FEF3F2', icon: AlertTriangle },
                        { label: 'Stable', value: patients.filter(p => p.status === 'GREEN').length, color: '#079455', bg: '#ECFDF5', icon: CheckCircle },
                    ].map((s, i) => (
                        <div key={i} style={{ backgroundColor: 'white', border: '1px solid #EAECF0', borderRadius: '16px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.icon size={20} /></div>
                            <div>
                                <div style={{ fontSize: '24px', fontWeight: '900', color: '#101828', lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginTop: '2px' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {criticals.length > 0 && (
                    <section>
                        <h3 style={{ fontSize: '11px', fontWeight: '900', color: '#D92D20', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                             Triage List Required
                        </h3>
                        {criticals.map(pt => (
                            <div key={pt.id} onClick={() => onSelect(pt.id)} style={{ backgroundColor: 'white', border: '1px solid #EAECF0', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D92D20', fontWeight: '900', fontSize: '14px' }}>{pt.name?.charAt(0)}</div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#101828' }}>{pt.name}</div>
                                        <div style={{ fontSize: '11px', color: '#D92D20', fontWeight: '700' }}>Biometric Breach</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} color="#D92D20" />
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </div>
    );
}

function ChevronRight({ size, color }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}

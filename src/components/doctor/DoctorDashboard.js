import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { DS, statusMeta } from './ds';
import DoctorShell from './DoctorShell';
import PatientDetails from './PatientDetails';
import { subscribeToDoctorPatients } from '../../services/patientService';
import { Search, Activity, Plus, Users, AlertTriangle, CheckCircle } from 'lucide-react';

export default function DoctorDashboard() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const [patients, setPatients] = useState([]);
    const [enrichedPatients, setEnrichedPatients] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [alertCount, setAlertCount] = useState(0);

    useEffect(() => {
        if (!user?.uid) return;
        return subscribeToDoctorPatients(user.uid, (pts) => {
            setPatients(pts.filter(p => !!p.patientId).map(pt => ({
                ...pt,
                status: 'ORANGE', lastUpdated: '--:--', latestVitals: null,
            })));
        });
    }, [user?.uid]);

    useEffect(() => {
        if (patients.length === 0) { setEnrichedPatients([]); return; }
        let currentEnrichments = {};
        const unsubs = patients.map(pt => {
            const vQ = query(collection(db, 'vitals'), where('patientId', '==', pt.id), limit(1));
            return onSnapshot(vQ, (vSnap) => {
                let status = 'ORANGE', lastUpdated = '--:--', latestVitals = null;
                if (!vSnap.empty) {
                    latestVitals = vSnap.docs[0].data();
                    if (latestVitals.recordedAt) {
                        lastUpdated = latestVitals.recordedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const sys = latestVitals.bp?.systolic || latestVitals.bpSystolic;
                        const dia = latestVitals.bp?.diastolic || latestVitals.bpDiacholic;
                        status = (sys > 150 || sys < 90 || dia > 95) ? 'RED' : 'GREEN';
                    }
                }
                currentEnrichments[pt.id] = { status, lastUpdated, latestVitals };
                setEnrichedPatients(patients.map(p => ({ ...p, ...(currentEnrichments[p.id] || { status: 'ORANGE', lastUpdated: '--:--', latestVitals: null }) })));
            });
        });
        return () => unsubs.forEach(u => u());
    }, [patients]);

    useEffect(() => {
        if (!user?.uid) { setAlertCount(0); return; }
        const q = query(collection(db, 'alerts'), where('isRead', '==', false), where('doctorId', '==', user.uid));
        return onSnapshot(q, snap => setAlertCount(snap.size));
    }, [user?.uid]);

    const displayPatients = enrichedPatients.length > 0 ? enrichedPatients : patients;
    const filtered = displayPatients.filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const criticalCount = displayPatients.filter(p => p.status === 'RED').length;
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showSidebar = !isMobile || (isMobile && !selectedPatientId);
    const showDetails = !isMobile || (isMobile && !!selectedPatientId);

    return (
        <DoctorShell alertCount={alertCount}>
            <div className="doctor-dashboard-container">
                {showSidebar && (
                    <div className="patient-registry-sidebar">
                    <div style={{ padding: '24px 20px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#101828', margin: 0, letterSpacing: '-0.5px' }}>Diagnostic Registry</h2>
                            <button onClick={() => navigate('/doctor/add-patient')} style={{ width: '32px', height: '32px', borderRadius: '10px', border: 'none', background: '#0052FF', color: 'white', cursor: 'pointer' }}><Plus size={18} /></button>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginBottom: '16px' }}>
                            {displayPatients.length} Monitors · <span style={{ color: criticalCount > 0 ? '#D92D20' : '#079455' }}>{criticalCount > 0 ? `${criticalCount} Flagged` : 'Optimal'}</span>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} color="#98A2B3" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '10px', border: '1px solid #EAECF0', outline: 'none', backgroundColor: '#F9FAFB', fontSize: '14px', fontWeight: '600' }} />
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filtered.map(pt => {
                                const isSelected = selectedPatientId === pt.id;
                                const meta = statusMeta(pt.status);
                                return (
                                    <div key={pt.id} onClick={() => setSelectedPatientId(pt.id)} style={{ backgroundColor: isSelected ? '#F8FAFF' : '#ffffff', borderRadius: '14px', padding: '14px', cursor: 'pointer', border: isSelected ? '1px solid #0052FF' : '1px solid #F2F4F7' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isSelected ? '#0052FF' : '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '900', color: isSelected ? 'white' : '#475467' }}>{(pt.name || 'P').charAt(0)}</div>
                                                <div>
                                                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#101828' }}>{pt.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#667085', fontWeight: '700' }}>{pt.age}y · {pt.condition || 'General'}</div>
                                                </div>
                                            </div>
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: meta.color }}></div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' }}>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><Activity size={12} color="#0052FF" /> {pt.latestVitals ? `${pt.latestVitals.bp?.systolic || pt.latestVitals.bpSystolic || '--'}/${pt.latestVitals.bp?.diastolic || pt.latestVitals.bpDiacholic || '--'}` : '--/--'}</div>
                                            <span style={{ color: '#98A2B3' }}>{pt.lastUpdated}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                )}
                
                {showDetails && (
                    <div className="dashboard-main-view">
                        {selectedPatientId ? (
                            <PatientDetails key={selectedPatientId} inlinePatientId={selectedPatientId} onClose={() => setSelectedPatientId(null)} />
                        ) : (
                            <WelcomePanel patients={displayPatients} alertCount={alertCount} navigate={navigate} onSelectPatient={setSelectedPatientId} user={user} />
                        )}
                    </div>
                )}
            </div>
        </DoctorShell>
    );
}

function WelcomePanel({ patients, alertCount, navigate, onSelectPatient, user }) {
    const attentionPts = patients.filter(p => p.status === 'RED' || p.status === 'ORANGE');
    const doctorName = user?.displayName?.split(' ')[0] || 'Doctor';
    return (
        <div style={{ padding: '40px' }}>
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#0052FF', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Terminal Oversight Active</div>
                    <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#101828', margin: '0 0 6px 0', letterSpacing: '-1.5px' }}>Dr. {doctorName}</h1>
                    <p style={{ fontSize: '16px', color: '#475467', fontWeight: '700', margin: 0 }}>{patients.length} monitors online · <span style={{ color: '#079455' }}>Diagnostic Sync Active</span></p>
                </div>
                <div className="welcome-stats-grid">
                    {[
                        { label: 'Registry', value: patients.length, color: '#0052FF', bg: '#EFF4FF', icon: Users },
                        { label: 'System Triage', value: alertCount, color: '#D92D20', bg: '#FFF1F0', icon: AlertTriangle, onClick: () => navigate('/doctor/alerts') },
                        { label: 'Bio Stability', value: patients.filter(p => p.status === 'GREEN').length, color: '#079455', bg: '#ECFDF5', icon: CheckCircle },
                    ].map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div key={i} onClick={s.onClick} style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', border: '1px solid #EAECF0', cursor: s.onClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={24} /></div>
                                <div>
                                    <div style={{ fontSize: '32px', fontWeight: '900', color: '#101828', lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: '12px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginTop: '4px' }}>{s.label}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {attentionPts.length > 0 && (
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '32px', border: '1px solid #EAECF0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D92D20' }}></div>
                            <h3 style={{ fontSize: '14px', fontWeight: '900', color: '#101828', margin: 0, textTransform: 'uppercase' }}>Diagnostic Triage</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {attentionPts.map(pt => (
                                <div key={pt.id} onClick={() => onSelectPatient(pt.id)} style={{ backgroundColor: '#F9FAFB', borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid #F2F4F7' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0052FF', fontSize: '16px', fontWeight: '900', border: '1px solid #EAECF0' }}>{(pt.name || 'P').charAt(0)}</div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#101828' }}>{pt.name}</div>
                                            <div style={{ fontSize: '12px', color: '#667085', fontWeight: '700' }}>Bio-Range Breach · {pt.condition}</div>
                                        </div>
                                    </div>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0052FF', border: '1px solid #EAECF0' }}><Plus size={20} /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

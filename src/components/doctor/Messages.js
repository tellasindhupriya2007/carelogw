import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import DoctorShell from './DoctorShell';
import ChatInterface from '../common/ChatInterface';
import { useAuthContext } from '../../context/AuthContext';
import { subscribeToDoctorPatients } from '../../services/patientService';
import { Search, MessageSquare, ChevronRight } from 'lucide-react';

export default function DoctorMessages() {
    const { user, role } = useAuthContext();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePatient, setActivePatient] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [alertCount, setAlertCount] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'alerts'), where('isRead', '==', false), where('doctorId', '==', user.uid));
        onSnapshot(q, s => setAlertCount(s.size));
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) return;
        return subscribeToDoctorPatients(user.uid, (pts) => {
            const filtered = pts.filter(p => !!p.patientId);
            setPatients(filtered);
            setLoading(false);
        });
    }, [user?.uid]);

    const filteredPatients = patients.filter(p => 
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const showSidebar = !isMobile || (isMobile && !activePatient);
    const showChat = !isMobile || (isMobile && !!activePatient);

    return (
        <DoctorShell alertCount={alertCount}>
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: 'white' }}>
                
                {/* PATIENT SELECTOR (Full screen list on Mobile) */}
                {showSidebar && (
                    <div style={{ 
                        width: isMobile ? '100%' : '320px', 
                        minWidth: isMobile ? '100%' : '320px',
                        borderRight: isMobile ? 'none' : '1px solid #EAECF0',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ padding: isMobile ? '20px 16px' : '24px 20px', borderBottom: '1px solid #EAECF0' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#101828', margin: '0 0 16px 0', letterSpacing: '-0.7px' }}>Messages</h1>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} color="#98A2B3" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input placeholder="Search clinical contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: '1px solid #EAECF0', backgroundColor: '#F9FAFB', fontSize: '15px' }} />
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                            {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#98A2B3' }}>Toggling communication nodes...</div> : 
                             filteredPatients.length === 0 ? <div style={{ textAlign: 'center', padding: '60px 20px', color: '#667085' }}>No active patients found.</div> :
                             filteredPatients.map(pt => (
                                <div key={pt.id} onClick={() => setActivePatient(pt)} style={{ padding: '16px', borderRadius: '16px', marginBottom: '8px', cursor: 'pointer', backgroundColor: activePatient?.id === pt.id ? '#F8FAFF' : 'white', border: activePatient?.id === pt.id ? '2px solid #0052FF' : '1px solid #F2F4F7', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s' }}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#0052FF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '900' }}>{pt.name?.charAt(0)}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#101828', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pt.name}</div>
                                        <div style={{ fontSize: '12px', color: '#667085', fontWeight: '700' }}>Active Registry · {pt.patientId}</div>
                                    </div>
                                    <ChevronRight size={18} color="#98A2B3" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CHAT INTERFACE (Full screen on Mobile if selected) */}
                {showChat && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
                        {activePatient ? (
                            <ChatInterface 
                                key={activePatient.id}
                                currentUser={user} 
                                patientId={activePatient.id} 
                                userRole={role || "doctor"} 
                                onExitChat={() => setActivePatient(null)}
                            />
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', padding: '40px', textAlign: 'center' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '24px', background: 'white', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}><MessageSquare size={32} color="#0052FF"/></div>
                                <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#101828', marginBottom: '8px' }}>Select a Clinical Case</h3>
                                <p style={{ fontSize: '14px', color: '#667085', maxWidth: '300px', fontWeight: '600' }}>Select a patient from the registry to open a secure channel with their care team.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DoctorShell>
    );
}

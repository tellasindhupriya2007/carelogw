import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import DoctorShell from './DoctorShell';
import ChatInterface from '../common/ChatInterface';
import { useAuthContext } from '../../context/AuthContext';
import { subscribeToDoctorPatients } from '../../services/patientService';
import { User, Search, MessageSquare } from 'lucide-react';
import { DS } from './ds';

export default function DoctorMessages() {
    const { user, role } = useAuthContext();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePatient, setActivePatient] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [alertCount, setAlertCount] = useState(0);

    // Alert count subscription for DoctorShell
    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'alerts'), where('isRead', '==', false), where('doctorId', '==', user.uid));
        return onSnapshot(q, s => setAlertCount(s.size));
    }, [user?.uid]);

    // Fetch My Patients
    useEffect(() => {
        if (!user?.uid) return;
        return subscribeToDoctorPatients(user.uid, (pts) => {
            const filtered = pts.filter(p => !!p.patientId);
            setPatients(filtered);
            setLoading(false);
            if (filtered.length > 0 && !activePatient) {
                // Optionally auto-select first patient
                // setActivePatient(filtered[0]);
            }
        });
    }, [user?.uid]);

    const filteredPatients = patients.filter(p => 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1100);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1100);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showSidebar = !isMobile || (isMobile && !activePatient);
    const showChat = !isMobile || (isMobile && !!activePatient);

    return (
        <DoctorShell alertCount={alertCount}>
            <div className="chat-layout-container">
                
                {/* Patient Selector Sidebar */}
                {showSidebar && (
                    <div className="chat-sidebar">
                    <div style={{ padding: '24px 20px 16px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: '900', color: DS.textPrimary, margin: '0 0 16px 0' }}>Messages</h2>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} color={DS.textMuted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input 
                                placeholder="Search patients..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 12px 10px 36px', borderRadius: '12px',
                                    border: 'none', backgroundColor: DS.surfaceHighest, fontSize: '13px',
                                    outline: 'none', fontFamily: 'inherit'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: DS.textMuted, fontSize: '13px' }}>Loading...</div>
                        ) : filteredPatients.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: DS.textMuted }}>
                                <MessageSquare size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                <div style={{ fontSize: '14px', fontWeight: '700' }}>No patients found</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {filteredPatients.map(pt => (
                                    <div 
                                        key={pt.id} 
                                        onClick={() => setActivePatient(pt)}
                                        style={{
                                            padding: '12px 16px', borderRadius: '14px', cursor: 'pointer',
                                            backgroundColor: activePatient?.id === pt.id ? 'white' : 'transparent',
                                            boxShadow: activePatient?.id === pt.id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px'
                                        }}
                                    >
                                        <div style={{ 
                                            width: '40px', height: '40px', borderRadius: '12px', 
                                            backgroundColor: DS.primaryContainer, color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '14px', fontWeight: '900'
                                        }}>
                                            {pt.name.charAt(0)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '14px', fontWeight: '800', color: DS.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {pt.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: DS.textMuted, fontWeight: '600' }}>
                                                ID: {pt.patientId}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* Chat Interface */}
                {showChat && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

                    {activePatient ? (
                        <ChatInterface 
                            key={activePatient.id}
                            currentUser={user} 
                            patientId={activePatient.id} 
                            userRole={role || "doctor"} 
                            onExitChat={() => setActivePatient(null)}
                        />
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: DS.surface }}>
                            <div style={{ textAlign: 'center', maxWidth: '320px' }}>
                                <div style={{ 
                                    width: '64px', height: '64px', borderRadius: '20px', 
                                    backgroundColor: DS.surfaceLow, display: 'flex', 
                                    alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' 
                                }}>
                                    <MessageSquare size={32} color={DS.textMuted} />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '900', color: DS.textPrimary, margin: '0 0 8px 0' }}>Select a Patient</h3>
                                <p style={{ fontSize: '14px', color: DS.textMuted, lineHeight: 1.5 }}>
                                    Choose a patient from the list on the left to view their secure care team chat.
                                </p>
                            </div>
                        </div>
                    )}
                    </div>
                )}
            </div>
        </DoctorShell>
    );
}

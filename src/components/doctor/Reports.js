import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import DoctorShell from './DoctorShell';
import { FileText, Search, Download, Eye, Clock, User, FileImage } from 'lucide-react';
import { colors } from '../../styles/colors';

export default function DoctorReports() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const { user } = useAuthContext();

    useEffect(() => {
        if (!user?.uid) return;
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        
        let unsubPrescriptions;
        let unsubWeekly;

        const fetchAll = async () => {
            setLoading(true);
            
            // 1. Fetch prescriptions (SIMPLIFIED QUERY TO AVOID INDEX REQS)
            const q1 = query(
                collection(db, 'prescriptions'), 
                where('doctorId', '==', user.uid)
            );
            unsubPrescriptions = onSnapshot(q1, (snap) => {
                const prescData = snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    type: 'External Prescription',
                    icon: FileImage,
                    sortDate: doc.data().uploadedAt?.toDate() || new Date(),
                    imageData: doc.data().photoUrl 
                }));
                
                setReports(prev => {
                    const others = prev.filter(r => r.type !== 'External Prescription');
                    const combined = [...others, ...prescData].sort((a,b) => (b.sortDate?.getTime?.() || 0) - (a.sortDate?.getTime?.() || 0));
                    return combined;
                });
                setLoading(false);
            }, (err) => {
                console.error("Prescriptions fetch error:", err);
                setLoading(false);
            });

            // 2. Fetch weekly reports (SIMPLIFIED QUERY TO AVOID INDEX REQS)
            const q2 = query(
                collection(db, 'weeklyReports'), 
                where('sharedWithDoc', '==', true), 
                where('doctorId', '==', user.uid)
            );
            unsubWeekly = onSnapshot(q2, (snap) => {
                const weeklyData = snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    type: 'Clinical Summary',
                    icon: FileText,
                    sortDate: doc.data().sharedAt?.toDate() || new Date()
                }));

                setReports(prev => {
                    const others = prev.filter(r => r.type !== 'Clinical Summary');
                    const combined = [...others, ...weeklyData].sort((a,b) => (b.sortDate?.getTime?.() || 0) - (a.sortDate?.getTime?.() || 0));
                    return combined;
                });
                setLoading(false);
            }, (err) => {
                console.error("Weekly reports fetch failed", err);
                setLoading(false);
            });
        };

        fetchAll();

        return () => {
            window.removeEventListener('resize', handleResize);
            if (unsubPrescriptions) unsubPrescriptions();
            if (unsubWeekly) unsubWeekly();
        };
    }, []);

    const filteredReports = reports.filter(r => 
        (r.uploaderName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.doctorName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DoctorShell alertCount={0}>
            <div style={{ padding: isMobile ? '16px' : '40px', maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '12px', height: '2px', backgroundColor: colors.primaryBlue }} />
                        <span style={{ fontSize: '12px', fontWeight: '900', color: colors.primaryBlue, textTransform: 'uppercase', letterSpacing: '1px' }}>Medical Record Archive</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                            <h1 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: '900', color: colors.textPrimary, margin: 0 }}>Clinical Reports</h1>
                            <p style={{ color: colors.textSecondary, fontSize: '14px', marginTop: '4px' }}>Review longitudinal summaries and physical document uploads.</p>
                        </div>
                        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 0 300px' }}>
                            <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input 
                                placeholder="Search documents..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: `1px solid ${colors.border}`, outline: 'none' }}
                            />
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>Data synchronized...</div>
                ) : filteredReports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 40px', backgroundColor: 'white', borderRadius: '24px', border: `1.5px dashed ${colors.border}` }}>
                        <FileText size={48} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: '20px' }} />
                        <h3 style={{ fontSize: '18px', fontWeight: '900', color: colors.textPrimary, margin: '0 0 8px 0' }}>Archive Repository Empty</h3>
                        <p style={{ color: colors.textSecondary, fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>External prescriptions and generated reports will synchronize here once clinical sessions are archived.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                        {filteredReports.map((report) => (
                            <div key={report.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#F0F5FF', color: colors.primaryBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {React.createElement(report.icon || FileImage, { size: 24 })}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h3 style={{ fontSize: '16px', fontWeight: '900', color: colors.textPrimary, margin: '0 0 4px 0' }}>{report.patientName || 'Untitled Case'}</h3>
                                            <span style={{ 
                                                 fontSize: '10px', 
                                                 fontWeight: '900', 
                                                 padding: '3px 8px', 
                                                 borderRadius: '6px', 
                                                 backgroundColor: report.type === 'Clinical Summary' ? '#E0F2FE' : '#ECFDF5', 
                                                 color: report.type === 'Clinical Summary' ? '#0369A1' : '#079455' 
                                             }}>
                                                 {report.type === 'Clinical Summary' ? 'HEALTH REPORT' : 'DOC UPLOAD'}
                                             </span>
                                         </div>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textSecondary }}>
                                                 <User size={12} /> {report.type === 'Clinical Summary' ? 'System Analysis' : (report.uploadedBy || 'Family')}
                                             </div>
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textSecondary }}>
                                                 <Clock size={12} /> {report.sortDate ? report.sortDate.toLocaleDateString() : 'Recent'}
                                             </div>
                                         </div>

                                        {report.imageData && (
                                            <div style={{ width: '100%', height: '120px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', border: `1px solid ${colors.border}` }}>
                                                <img src={report.imageData} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {report.type === 'External Prescription' ? (
                                                <>
                                                    <button 
                                                        onClick={() => {
                                                            const link = document.createElement('a');
                                                            link.href = report.imageData;
                                                            link.download = `Prescription_${report.id}.jpg`;
                                                            link.click();
                                                        }}
                                                        style={{ flex: 1, height: '40px', backgroundColor: colors.primaryBlue, color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                    >
                                                        <Download size={14} /> Download
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            const win = window.open("");
                                                            win.document.write(`<img src="${report.imageData}" style="width:100%"/>`);
                                                        }}
                                                        style={{ width: '40px', height: '40px', border: `1px solid ${colors.border}`, borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => navigate(`/doctor/report/${report.patientId}?week=${report.weekStartDate}`)}
                                                    style={{ flex: 1, height: '40px', backgroundColor: colors.primaryBlue, color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                >
                                                    <Eye size={14} /> View Clinical Analysis
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DoctorShell>
    );
}

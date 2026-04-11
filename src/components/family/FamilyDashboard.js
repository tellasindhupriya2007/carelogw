import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, onSnapshot, getDoc, getDocs, updateDoc, doc, setDoc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getTodayDateString } from '../../utils/dateHelpers';
import { calculateAndSaveCareScore } from '../../utils/careScoreCalculator';
import { generatePatientId } from '../../utils/idGenerator';
import { listenToAlerts } from '../../services/alertService';
import Sidebar from '../common/Sidebar';
import FamilyBottomNav from '../common/FamilyBottomNav';
import SkeletonCard from '../common/SkeletonCard';
import { 
    Bell, Pill, HeartPulse, Smile, AlertTriangle, 
    FileText, Users, Activity, Menu 
} from 'lucide-react';
import { colors } from '../../styles/colors';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import TaskManager from './TaskManager';
import { generateWeeklyReport } from '../../services/reportService';
import { createDefaultWorkflow } from '../../services/taskService';

const familySidebarItems = [
    { icon: 'Home', label: 'Dashboard', path: '/family/dashboard' },
    { icon: 'FileText', label: 'Reports', path: '/family/report' },
    { icon: 'Pill', label: 'Prescriptions', path: '/family/prescriptions' },
    { icon: 'Bell', label: 'Alerts', path: '/family/alerts' },
    { icon: 'MessageSquare', label: 'Messages', path: '/family/messages' }
];

export default function FamilyDashboard() {
    const navigate = useNavigate();
    const { user, patientId, setPatientId, isDev } = useAuthContext();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [patientName, setPatientName] = useState('');
    const [patientHumanId, setPatientHumanId] = useState('');
    const [patientData, setPatientData] = useState(null);
    const [data, setData] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [error, setError] = useState(null);
    const [creating, setCreating] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!user) return;
        const fetchPatient = async () => {
            try {
                if (!patientId) {
                    const q = query(collection(db, 'patients'), where('familyId', '==', user.uid));
                    onSnapshot(q, (snap) => {
                        if (!snap.empty) {
                            const pDoc = snap.docs[0];
                            setPatientId(pDoc.id);
                            setPatientName(pDoc.data().name);
                            setPatientHumanId(pDoc.data().patientId || '');
                        } else setLoading(false);
                    });
                } else {
                    const pDoc = await getDoc(doc(db, 'patients', patientId));
                    if (pDoc.exists()) {
                        setPatientName(pDoc.data().name);
                        setPatientHumanId(pDoc.data().patientId || '');
                        setPatientData(pDoc.data());
                    }
                }
            } catch (err) { setError("Load Error"); setLoading(false); }
        };
        fetchPatient();
    }, [user, patientId]);

    useEffect(() => {
        if (!patientId) return;
        setLoading(true);
        const todayString = getTodayDateString();
        
        // Ensure care score is recalculated when any data changes
        listenToAlerts({ patientId }, (f) => setAlerts(f.filter(a => !a.isRead)));
        const { subscribeToTasks } = require('../../services/taskService');
        
        let lT = []; let lC = {}; let lV = []; let lO = [];
        const unsubT = subscribeToTasks(patientId, (all) => { lT = all || []; update(); });
        const unsubL = onSnapshot(query(collection(db, 'dailyLogs'), where('patientId', '==', patientId), where('date', '==', todayString)), (s) => {
            if (!s.empty) { 
                const d = s.docs[0].data(); 
                lC = d.completions || {}; 
                lO = d.observations || []; 
            }
            update();
        });
        const unsubV = onSnapshot(query(collection(db, 'vitals'), where('patientId', '==', patientId), orderBy('recordedAt', 'desc'), limit(20)), (s) => {
            lV = s.docs.map(d => ({ id: d.id, ...d.data() }));
            update();
        }, (err) => {
            console.error("Vitals fetch failed:", err);
            // Fallback for missing index: fetch without order and sort manually
            onSnapshot(query(collection(db, 'vitals'), where('patientId', '==', patientId), limit(20)), (s2) => {
                lV = s2.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.recordedAt?.toMillis?.() || 0) - (a.recordedAt?.toMillis?.() || 0));
                update();
            });
        });

        const update = () => {
            const completedCount = Object.keys(lC).filter(id => lC[id]?.completed).length;
            const totalCount = lT.length;
            
            // Care Score should start at 0 and go to 10 based on completion
            const taskPercentage = totalCount > 0 ? (completedCount / totalCount) : 0;
            const currentScore = Number((taskPercentage * 10).toFixed(1));

            setData({ 
                careScore: currentScore, 
                tasks: lT.map(t => ({ ...t, status: lC[t.id]?.completed ? 'Completed' : 'Pending', completedAt: lC[t.id]?.completedAt })), 
                vitals: lV, 
                observations: lO.sort((a,b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
            });
            setLoading(false);
        };
        return () => { unsubT(); unsubL(); unsubV(); };
    }, [patientId]);

    const safeFormatTime = (d) => {
        if (!d) return "--:--";
        const date = d.toMillis ? d.toDate() : new Date(d);
        return isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const timeline = (() => {
        if (!data) return [];
        const acts = [];
        
        // 1. Task Completions
        data.tasks?.forEach(t => t.status==='Completed' && t.completedAt && acts.push({ 
            text: `${t.title} Done`, 
            timeStr: safeFormatTime(t.completedAt), 
            ts: t.completedAt.toMillis ? t.completedAt.toMillis() : new Date(t.completedAt).getTime(), 
            type: 'success' 
        }));

        // 2. Vitals with details
        data.vitals?.forEach(v => {
            let detail = "";
            if (v.bp) detail += `${v.bp.systolic}/${v.bp.diastolic} BP `;
            if (v.heartRate) detail += `${v.heartRate} HR `;
            if (v.temperature) detail += `${v.temperature}°F `;
            
            // Fallback check for abnormal values if flag is missing (Precision check)
            const manualAbnormal = (v.bp?.systolic > 0 && (v.bp.systolic >= 140 || v.bp.systolic <= 90)) || 
                                   (v.heartRate > 0 && (v.heartRate >= 110 || v.heartRate <= 50)) || 
                                   (v.temperature > 0 && (v.temperature >= 100.4 || v.temperature <= 95));
            const isAbnormal = v.alertTriggered === true || manualAbnormal;
            
            acts.push({ 
                text: isAbnormal ? `ABNORMAL Vitals: ${detail}` : `Vitals: ${detail || 'Recorded'}`, 
                timeStr: safeFormatTime(v.recordedAt), 
                ts: v.recordedAt?.toMillis ? v.recordedAt.toMillis() : new Date(v.recordedAt || 0).getTime(), 
                type: isAbnormal ? 'alert' : 'success' 
            });
        });

        // 3. Observations
        data.observations?.forEach(o => {
            acts.push({
                text: `Status: ${o.mood || 'Updated'}`,
                timeStr: safeFormatTime(o.recordedAt),
                ts: new Date(o.recordedAt).getTime(),
                type: o.isCritical ? 'alert' : 'success'
            });
        });

        return acts.sort((a,b) => b.ts - a.ts).slice(0, 4);
    })();

    // Derived Statuses
    const latestVital = data?.vitals?.[0];
    const latestObs = data?.observations?.[0];
    const medTasks = data?.tasks?.filter(t => t.category === 'Medication') || [];
    const completedMeds = medTasks.filter(t => t.status === 'Completed').length;

    // Standardized fallback check for abnormality
    const isLatestAbnormal = latestVital?.alertTriggered || 
                           (latestVital?.bp?.systolic >= 140) || 
                           (latestVital?.heartRate >= 110) || 
                           (latestVital?.temperature >= 100.4);

    const vitalsStatus = isLatestAbnormal ? 'ABNORMAL' : (latestVital ? 'NORMAL' : 'NO DATA');
    const moodStatus = latestObs?.mood || 'STABLE';

    return (
        <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', position: 'relative', overflowX: 'hidden' }}>
            <Sidebar navItems={familySidebarItems} isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                {/* Header */}
                <div style={{ padding: '0 16px', height: '64px', background: 'white', borderBottom: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
                    <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none' }}><Menu size={24} /></button>
                    <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#101828' }}>Dashboard</h1>
                    <div style={{ position: 'relative' }} onClick={() => navigate('/family/alerts')}>
                        <Bell size={22} /><span style={{ position: 'absolute', top: -4, right: -4, width: '14px', height: '14px', background: '#D92D20', borderRadius: '50%', color: 'white', fontSize: '9px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{alerts.length}</span>
                    </div>
                </div>

                <div style={{ padding: isMobile ? '16px' : '32px', flex: 1, overflowY: 'auto', paddingBottom: '90px', width: '100%', boxSizing: 'border-box' }}>
                    {loading ? <SkeletonCard style={{ height: '300px' }} /> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
                            
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px', width: '100%' }}>
                                {/* Care Score */}
                                <div style={{ flex: 1, background: 'white', borderRadius: '24px', padding: '24px', border: '1px solid #EAECF0', textAlign: 'center' }}>
                                    <div style={{ width: '120px', height: '120px', margin: '0 auto', position: 'relative' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={[{v: data?.careScore || 0}, {v: Math.max(0.1, 10-(data?.careScore||0))}]} innerRadius={40} outerRadius={55} startAngle={90} endAngle={-270} dataKey="v" stroke="none">
                                                    <Cell fill="#0052FF" /><Cell fill="#F2F4F7" />
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '28px', fontWeight: '950', color: '#101828' }}>{data?.careScore || 0}</div>
                                    </div>
                                    <h4 style={{ fontSize: '12px', fontWeight: '900', color: '#667085', marginTop: '12px', textTransform: 'uppercase' }}>Daily Care Progress</h4>
                                </div>

                                {/* Today's Activity */}
                                <div style={{ flex: 1.5, background: 'white', borderRadius: '24px', padding: '24px', border: '1px solid #EAECF0' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '16px', color: '#101828' }}>Activity Feed</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {timeline.length === 0 ? <div style={{ fontSize: '12px', color: '#98A2B3', textAlign: 'center', padding: '20px' }}>No activity logged today</div> : 
                                         timeline.map((act, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: act.type === 'alert' ? '#D92D20' : '#039855', marginTop: '6px' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '850', color: act.type === 'alert' ? '#D92D20' : '#101828' }}>{act.text}</div>
                                                    <div style={{ fontSize: '11px', color: '#667085', fontWeight: '700' }}>{act.timeStr}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
                                gap: '12px', 
                                width: '100%' 
                            }}>
                                <div style={{ background: 'white', padding: '16px', borderRadius: '20px', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F0F5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pill size={20} color="#0052FF" /></div>
                                    <div><div style={{ fontSize: '11px', fontWeight: '900', color: '#667085' }}>MEDICINES</div><div style={{ fontSize: '16px', fontWeight: '900' }}>{completedMeds}/{medTasks.length}</div></div>
                                </div>
                                <div style={{ background: 'white', padding: '16px', borderRadius: '20px', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isLatestAbnormal ? '#FEF2F2' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HeartPulse size={20} color={isLatestAbnormal ? '#D92D20' : '#039855'} /></div>
                                    <div><div style={{ fontSize: '11px', fontWeight: '900', color: '#667085' }}>VITALS</div><div style={{ fontSize: '16px', fontWeight: '900', color: isLatestAbnormal ? '#D92D20' : '#039855' }}>{vitalsStatus}</div></div>
                                </div>
                                <div style={{ background: 'white', padding: '16px', borderRadius: '20px', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Smile size={20} color="#B45309" /></div>
                                    <div><div style={{ fontSize: '11px', fontWeight: '900', color: '#667085' }}>MOOD</div><div style={{ fontSize: '16px', fontWeight: '900', color: '#B45309', textTransform: 'uppercase' }}>{moodStatus}</div></div>
                                </div>
                            </div>

                            <TaskManager patientId={patientId} />
                            
                            <div style={{ 
                                background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)', 
                                borderRadius: '24px', padding: '24px', display: 'flex', 
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: '16px', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <FileText size={28} color="white" />
                                    <div><div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>Clinical Weekly Report</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>Review longitudinal patient health</div></div>
                                </div>
                                <button onClick={() => navigate('/family/report')} style={{ height: '44px', padding: '0 24px', background: 'white', color: '#0052FF', border: 'none', borderRadius: '12px', fontWeight: '950', fontSize: '13px', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}>OPEN ARCHIVE</button>
                            </div>
                        </div>
                    )}
                </div>
                <FamilyBottomNav />
            </div>
        </div>
    );
}

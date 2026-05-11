import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToPatientMedia } from '../../services/mediaService';
import { subscribeToTasks, deleteRelativeTask } from '../../services/taskService';
import { Activity, HeartPulse, Thermometer, ChevronRight, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatDate = (val) => {
    if (!val) return 'Recently';
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function PatientDetails({ inlinePatientId, onClose }) {
    const id = inlinePatientId;
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [patient, setPatient] = useState(null);
    const [vitalsHistory, setVitalsHistory] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [careLogs, setCareLogs] = useState([]);
    const [media, setMedia] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [activeTab, setActiveTab] = useState('Overview');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!id) return;
        onSnapshot(doc(db, 'patients', id), s => setPatient({ id: s.id, ...s.data() }));
        
        const vQ = query(collection(db, 'vitals'), where('patientId', '==', id));
        onSnapshot(vQ, s => {
            const history = s.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a,b) => {
                    const tA = a.recordedAt?.toMillis ? a.recordedAt.toMillis() : (a.recordedAt ? new Date(a.recordedAt).getTime() : 0);
                    const tB = b.recordedAt?.toMillis ? b.recordedAt.toMillis() : (b.recordedAt ? new Date(b.recordedAt).getTime() : 0);
                    return tB - tA;
                });
            setVitalsHistory(history);
            setTrendData([...history].reverse().map(v => {
                const date = v.recordedAt?.toMillis ? v.recordedAt.toDate() : new Date(v.recordedAt);
                return {
                    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    sys: v.bp?.systolic || v.bpSystolic || 0
                };
            }));
        }, (err) => console.error("Vitals stream error:", err));

        const lQ = query(collection(db, 'dailyLogs'), where('patientId', '==', id));
        onSnapshot(lQ, s => {
            const logs = s.docs.flatMap(d => (d.data().observations || []).map(o => ({ ...o, date: d.data().date })));
            setCareLogs(logs.sort((a,b) => new Date(b.recordedAt) - new Date(a.recordedAt)));
        });
        subscribeToPatientMedia(id, setMedia);
        subscribeToTasks(id, setTasks);
    }, [id]);

    if (!patient) return null;
    const tabs = ['Overview', 'Vitals', 'Logs', 'Media', 'Prescriptions', 'Reports', 'Care Plan'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'white' }}>
            <div style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {isMobile && <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '4px' }}><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>}
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#0052FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900', fontSize: '14px' }}>{patient.name?.charAt(0)}</div>
                    <div>
                        <h1 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '900', color: '#101828', margin: 0 }}>{patient.name}</h1>
                        <div style={{ fontSize: '11px', color: '#667085', fontWeight: '700' }}>{patient.age}y · {patient.condition}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', padding: '0 16px', borderBottom: '1px solid #EAECF0', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {tabs.map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '10px 0', border: 'none', borderBottom: activeTab === t ? '2px solid #0052FF' : '2px solid transparent', background: 'none', color: activeTab === t ? '#0052FF' : '#667085', fontSize: '12px', fontWeight: '800', whiteSpace: 'nowrap' }}>{t}</button>
                ))}
            </div>

            <div style={{ flex: 1, padding: isMobile ? '12px' : '20px', overflowY: 'auto', backgroundColor: '#F9FAFB' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    {activeTab === 'Overview' && <OverviewTab trendData={trendData} vitalsHistory={vitalsHistory} isMobile={isMobile} />}
                    {activeTab === 'Vitals' && <VitalsTab vitalsHistory={vitalsHistory} isMobile={isMobile} />}
                    {activeTab === 'Logs' && <LogsTab careLogs={careLogs} isMobile={isMobile} />}
                    {activeTab === 'Media' && <MediaTab media={media} careLogs={careLogs} isMobile={isMobile} />}
                    {activeTab === 'Prescriptions' && <PrescriptionsTab patient={patient} patientId={id} isMobile={isMobile} />}
                    {activeTab === 'Reports' && <ReportsTab patientId={id} isMobile={isMobile} />}
                    {activeTab === 'Care Plan' && <CarePlanTab tasks={tasks} patientId={id} isMobile={isMobile} />}
                </div>
            </div>
        </div>
    );
}

function OverviewTab({ trendData, vitalsHistory, isMobile }) {
    const latestBpEntry = vitalsHistory.find(v => v.bp?.systolic || v.bpSystolic) || {};
    const latestHrEntry = vitalsHistory.find(v => v.heartRate || v.hr) || {};
    const latestTempEntry = vitalsHistory.find(v => v.temperature || v.temp) || {};
    
    // Clinical Threshold Safety Engine
    const isBpAlert = (latestBpEntry.bp?.systolic > 150 || latestBpEntry.bp?.systolic < 90 || latestBpEntry.bpSystolic > 150);
    const isHrAlert = (latestHrEntry.heartRate > 100 || latestHrEntry.heartRate < 60);

    const vitals = [
        { 
            label: 'BP', 
            value: (latestBpEntry.bp?.systolic || latestBpEntry.bpSystolic) ? `${latestBpEntry.bp?.systolic || latestBpEntry.bpSystolic}/${latestBpEntry.bp?.diastolic || latestBpEntry.bpDiastolic || '--'}` : '--', 
            unit: 'mmHg', 
            icon: Activity, 
            isAlert: isBpAlert,
            color: isBpAlert ? '#D92D20' : '#0052FF', 
            bg: isBpAlert ? '#FEF2F2' : '#F0F5FF',
            border: isBpAlert ? '#FDA29B' : '#EAECF0'
        },
        { 
            label: 'HR', 
            value: (latestHrEntry.heartRate || latestHrEntry.hr) ? `${latestHrEntry.heartRate || latestHrEntry.hr} bpm` : '--', 
            unit: 'bpm', 
            icon: HeartPulse, 
            isAlert: isHrAlert,
            color: isHrAlert ? '#D92D20' : '#039855', 
            bg: isHrAlert ? '#FEF2F2' : '#F0FDF4',
            border: isHrAlert ? '#FDA29B' : '#EAECF0'
        },
        { 
            label: 'Temp', 
            value: (latestTempEntry.temperature || latestTempEntry.temp) ? `${latestTempEntry.temperature || latestTempEntry.temp}°F` : '--', 
            unit: '°F', 
            icon: Thermometer, 
            isAlert: (latestTempEntry.temperature >= 100.4 || latestTempEntry.temp >= 100.4 || latestTempEntry.temperature <= 95 || latestTempEntry.temp <= 95),
            color: (latestTempEntry.temperature >= 100.4 || latestTempEntry.temp >= 100.4 || latestTempEntry.temperature <= 95 || latestTempEntry.temp <= 95) ? '#D92D20' : '#F79009', 
            bg: (latestTempEntry.temperature >= 100.4 || latestTempEntry.temp >= 100.4 || latestTempEntry.temperature <= 95 || latestTempEntry.temp <= 95) ? '#FEF2F2' : '#FFFAEB',
            border: (latestTempEntry.temperature >= 100.4 || latestTempEntry.temp >= 100.4 || latestTempEntry.temperature <= 95 || latestTempEntry.temp <= 95) ? '#FDA29B' : '#EAECF0'
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {vitals.map((v, i) => (
                    <div key={i} style={{ 
                        backgroundColor: v.isAlert ? v.bg : 'white', 
                        padding: isMobile ? '12px' : '16px', 
                        borderRadius: '16px', 
                        border: `1.5px solid ${v.border}`,
                        transition: 'all 0.3s ease',
                        boxShadow: v.isAlert ? '0 0 15px rgba(217, 45, 32, 0.1)' : 'none'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <div style={{ background: v.isAlert ? '#FECDCA' : v.bg, color: v.color, padding: '4px', borderRadius: '6px' }}>
                                <v.icon size={12} strokeWidth={3}/>
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: v.isAlert ? v.color : '#667085', textTransform: 'uppercase' }}>{v.label}</span>
                        </div>
                        <div style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '950', color: v.isAlert ? v.color : '#101828' }}>{v.value}</div>
                    </div>
                ))}
            </div>
            <div style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '20px', borderRadius: '16px', border: '1px solid #EAECF0' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '900', marginBottom: '16px', color: '#101828' }}>Biological Trend</h3>
                <div style={{ height: '140px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                            <CartesianGrid vertical={false} stroke="#f1f1f1" />
                            <XAxis dataKey="time" hide />
                            <Tooltip />
                            <Line type="monotone" dataKey="sys" stroke="#0052FF" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function VitalsTab({ vitalsHistory, isMobile }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {vitalsHistory.map((v, i) => {
                const dateObj = v.recordedAt?.toMillis ? v.recordedAt.toDate() : new Date(v.recordedAt);
                const timeStr = isNaN(dateObj.getTime()) ? 'Recently' : 
                    `${dateObj.getDate()}/${dateObj.getMonth() + 1} · ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                
                return (
                    <div key={i} style={{ backgroundColor: 'white', padding: '12px 16px', borderRadius: '14px', border: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <div><div style={{ fontSize: '9px', fontWeight: '900', color: '#667085' }}>BP</div><div style={{ fontWeight: '800', fontSize: '14px' }}>{v.bp?.systolic || v.bpSystolic || '--'}/{v.bp?.diastolic || v.bpDiastolic || '--'}</div></div>
                            <div><div style={{ fontSize: '9px', fontWeight: '900', color: '#667085' }}>HR</div><div style={{ fontWeight: '800', fontSize: '14px' }}>{v.heartRate || v.hr || '--'} bpm</div></div>
                            <div><div style={{ fontSize: '9px', fontWeight: '900', color: '#667085' }}>TEMP</div><div style={{ fontWeight: '800', fontSize: '14px' }}>{v.temperature || v.temp || '--'}°F</div></div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#667085', fontWeight: '850', whiteSpace: 'nowrap' }}>{timeStr}</div>
                    </div>
                );
            })}
        </div>
    );
}

function LogsTab({ careLogs, isMobile }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {careLogs.map((log, i) => (
                <div key={i} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '18px', border: '1px solid #EAECF0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '850', color: '#101828' }}>{log.mood || 'Standard Observation'}</div>
                        <div style={{ fontSize: '10px', color: '#667085', fontWeight: '800', background: '#F2F4F7', padding: '2px 8px', borderRadius: '6px' }}>{log.date}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#667085', fontWeight: '600', marginBottom: '12px' }}>Input by {log.caretakerName || 'Caregiver'}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {log.audioUrl && (
                            <button onClick={() => new Audio(log.audioUrl).play()} style={{ flex: 1, padding: '10px', background: '#F0F5FF', border: 'none', borderRadius: '10px', color: '#0052FF', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>Play Audio</button>
                        )}
                        {log.imageUrl && (
                            <a href={log.imageUrl} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px', background: '#F9FAFB', border: '1px solid #EAECF0', borderRadius: '10px', color: '#101828', fontSize: '11px', fontWeight: '900', textAlign: 'center', textDecoration: 'none' }}>View Photo</a>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function MediaTab({ media, careLogs, isMobile }) {
    const logImages = (careLogs || []).filter(l => l.imageUrl).map(l => ({ url: l.imageUrl, description: `Obs: ${l.mood}`, date: l.date }));
    const allMedia = [...(media || []), ...logImages].filter(item => item.url && !item.url.includes('placeholder'));
    
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {allMedia.map((m, i) => (
                <div key={i} style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #EAECF0', backgroundColor: 'white' }}>
                    <img src={m.url} style={{ width: '100%', height: '120px', objectFit: 'cover' }} alt="Clinical"/>
                    <div style={{ padding: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#101828', marginBottom: '2px' }}>{m.description || 'Biological Image'}</div>
                        <div style={{ fontSize: '9px', color: '#667085', fontWeight: '700' }}>{m.date || 'Captured'}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PrescriptionsTab({ patient, patientId, isMobile }) {
    const [meds, setMeds] = useState(Array.isArray(patient?.medications) ? patient.medications : []);
    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [freq, setFreq] = useState('');
    const [time, setTime] = useState('');

    const save = async (u) => {
        try {
            await updateDoc(doc(db, 'patients', patientId), { medications: u, medicationsUpdatedAt: new Date().toISOString() });
            setMeds(u);
        } catch (error) {
            console.error("Error saving prescriptions:", error);
        }
    };

    const handleAdd = () => {
        if (!name.trim()) return;
        save([...meds, { name, dosage, frequency: freq, scheduledTimes: [time || '08:00'] }]);
        setName(''); setDosage(''); setFreq(''); setTime('');
    };

    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #EAECF0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '900', color: '#101828', margin: 0 }}>Clinical Prescriptions</h3>
                {patient?.medicationsUpdatedAt && <span style={{ fontSize: '9px', color: '#667085', fontWeight: '800' }}>Authorized: {new Date(patient.medicationsUpdatedAt).toLocaleDateString()}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {Array.isArray(meds) && meds.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#F9FAFB', borderRadius: '12px' }}>
                        <div><div style={{ fontSize: '13px', fontWeight: '850' }}>{typeof m === 'string' ? m : (m?.name || m?.title || 'Unknown Medication')}</div>{m?.dosage && <div style={{ fontSize: '10px', color: '#667085' }}>{m.dosage} · {m.frequency}</div>}</div>
                        <button onClick={() => save(meds.filter((_,j)=>j!==i))} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </div>
                ))}
            </div>
            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input placeholder="Medicine Name" value={name} onChange={e=>setName(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EAECF0', fontSize: '12px' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                    <input placeholder="Dosage" value={dosage} onChange={e=>setDosage(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #EAECF0', fontSize: '12px' }} />
                    <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #EAECF0', fontSize: '12px' }} />
                </div>
                <button onClick={handleAdd} style={{ background: '#0052FF', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: '900' }}>Add Prescription</button>
            </div>
        </div>
    );
}

function CarePlanTab({ tasks, patientId, isMobile }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tasks.map((t, i) => (
                <div key={i} style={{ background: 'white', padding: '12px 16px', borderRadius: '14px', border: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontWeight: '800', fontSize: '13px' }}>{t.title}</div><div style={{ fontSize: '10px', color: '#667085', fontWeight: '700' }}>{t.time}</div></div>
                    <button onClick={() => deleteRelativeTask(patientId, t.id)} style={{ border: 'none', color: '#EF4444', background: 'none' }}><Trash2 size={16}/></button>
                </div>
            ))}
        </div>
    );
}


function ReportsTab({ patientId, isMobile }) {
    const [reports, setReports] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const q = query(
            collection(db, 'weeklyReports'), 
            where('patientId', '==', patientId)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a,b) => {
                    const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
                    const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
                    return tB - tA;
                });
            setReports(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [patientId]);

    if (loading) return <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px' }}>Loading reports archive...</div>;
    if (reports.length === 0) return (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #EAECF0' }}>
            <div style={{ fontSize: '12px', color: '#667085', fontWeight: '700' }}>No clinical reports shared yet</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reports.map((r, i) => (
                <div key={i} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: '900', fontSize: '14px', color: '#101828' }}>Clinical Summary</div>
                        <div style={{ fontSize: '11px', color: '#667085', fontWeight: '800' }}>{r.weekStartDate} — {r.weekEndDate}</div>
                    </div>
                    <button 
                        onClick={() => window.open(`/doctor/report/${patientId}?week=${r.weekStartDate}`, '_blank')}
                        style={{ padding: '8px 16px', backgroundColor: '#F0F5FF', border: 'none', borderRadius: '8px', color: '#0052FF', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                    >
                        View Details
                    </button>
                </div>
            ))}
        </div>
    );
}

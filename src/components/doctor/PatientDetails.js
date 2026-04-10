import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToPatientMedia } from '../../services/mediaService';
import { subscribeToTasks, deleteRelativeTask } from '../../services/taskService';
import { 
    Activity, HeartPulse, Thermometer, ShieldCheck, 
    ChevronRight, X, Trash2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Shared utility for consistent clinical timestamps
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
    const [clinicalNotes, setClinicalNotes] = useState([]);
    const [media, setMedia] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [activeTab, setActiveTab] = useState('Overview');
    const [newNote, setNewNote] = useState('');

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
                .sort((a,b) => new Date(b.recordedAt) - new Date(a.recordedAt));
            setVitalsHistory(history);
            setTrendData([...history].reverse().map(v => ({
                time: formatDate(v.recordedAt),
                sys: v.bp?.systolic || v.bpSystolic || 0
            })));
        });

        const lQ = query(collection(db, 'dailyLogs'), where('patientId', '==', id));
        onSnapshot(lQ, s => {
            const logs = s.docs.flatMap(d => (d.data().observations || []).map(o => ({ ...o, date: d.data().date })));
            setCareLogs(logs.sort((a,b) => new Date(b.recordedAt) - new Date(a.recordedAt)));
        });

        const nQ = query(collection(db, 'clinicalNotes'), where('patientId', '==', id));
        onSnapshot(nQ, s => setClinicalNotes(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))));
        
        subscribeToPatientMedia(id, setMedia);
        subscribeToTasks(id, setTasks);
    }, [id]);

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        await addDoc(collection(db, 'clinicalNotes'), { patientId: id, note: newNote, authorName: 'Dr. Tella', timestamp: new Date().toISOString() });
        setNewNote('');
    };

    if (!patient) return null;
    const tabs = ['Overview', 'Vitals', 'Logs', 'Media', 'Prescriptions', 'Care Plan', 'Notes'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff', borderLeft: '1px solid #EAECF0' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    {isMobile && <button onClick={onClose} style={{ background: 'none', border: 'none' }}><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>}
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#0052FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900' }}>{patient.name?.charAt(0)}</div>
                    <div>
                        <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#101828', margin: 0 }}>{patient.name}</h1>
                        <div style={{ fontSize: '11px', color: '#667085' }}>{patient.age}y · {patient.condition}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', padding: '0 24px', borderBottom: '1px solid #EAECF0', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {tabs.map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '12px 0', border: 'none', borderBottom: activeTab === t ? '2px solid #0052FF' : '2px solid transparent', background: 'none', color: activeTab === t ? '#0052FF' : '#667085', fontSize: '13px', fontWeight: '900', whiteSpace: 'nowrap' }}>{t}</button>
                ))}
            </div>

            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', backgroundColor: '#F9FAFB' }}>
                {activeTab === 'Overview' && <OverviewTab trendData={trendData} vitalsHistory={vitalsHistory} isMobile={isMobile} />}
                {activeTab === 'Vitals' && <VitalsTab vitalsHistory={vitalsHistory} />}
                {activeTab === 'Logs' && <LogsTab careLogs={careLogs} />}
                {activeTab === 'Media' && <MediaTab media={media} />}
                {activeTab === 'Prescriptions' && <PrescriptionsTab patient={patient} patientId={id} />}
                {activeTab === 'Care Plan' && <CarePlanTab tasks={tasks} patientId={id} />}
                {activeTab === 'Notes' && <NotesTab clinicalNotes={clinicalNotes} newNote={newNote} setNewNote={setNewNote} onAdd={handleAddNote} />}
            </div>
        </div>
    );
}

function OverviewTab({ trendData, vitalsHistory, isMobile }) {
    const latest = vitalsHistory[0] || {};
    const vitals = [
        { label: 'BP', value: `${latest.bp?.systolic || latest.bpSystolic || '--'}/${latest.bp?.diastolic || latest.bpDiacholic || '--'}`, icon: Activity, color: '#0052FF', bg: '#EFF4FF' },
        { label: 'HR', value: latest.heartRate || '--', icon: HeartPulse, color: '#D92D20', bg: '#FFF1F0' },
        { label: 'Temp', value: latest.temp || '--', icon: Thermometer, color: '#F79009', bg: '#FFFAEB' }
    ];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
                {vitals.map((v, i) => {
                    const Icon = v.icon;
                    return (
                        <div key={i} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #EAECF0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ background: v.bg, color: v.color, p: '4px', borderRadius: '6px' }}><Icon size={14} /></div>
                                <span style={{ fontSize: '11px', fontWeight: '900', color: '#667085' }}>{v.label}</span>
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: '900' }}>{v.value}</div>
                        </div>
                    );
                })}
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #EAECF0', height: '220px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '16px', color: '#101828' }}>Biological Trend</h3>
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

function VitalsTab({ vitalsHistory }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vitalsHistory.map((v, i) => (
                <div key={i} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <div><div style={{ fontSize: '10px', fontWeight: '900', color: '#667085' }}>BP</div><div style={{ fontWeight: '800' }}>{v.bp?.systolic || v.bpSystolic}/{v.bp?.diastolic || v.bpDiacholic}</div></div>
                        <div><div style={{ fontSize: '10px', fontWeight: '900', color: '#667085' }}>HR</div><div style={{ fontWeight: '800' }}>{v.heartRate} bpm</div></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#667085', fontWeight: '800' }}>{formatDate(v.recordedAt)}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function LogsTab({ careLogs }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {careLogs.map((log, i) => (
                <div key={i} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between' }}>
                    <div><div style={{ fontSize: '14px', fontWeight: '800' }}>{log.mood || 'Check-in'}</div><div style={{ fontSize: '12px', color: '#667085' }}>By {log.caretakerName || 'Caregiver'} · {log.date}</div></div>
                </div>
            ))}
        </div>
    );
}

function MediaTab({ media }) {
    const realMedia = (media || []).filter(item => item.url && !item.url.includes('placeholder'));
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {realMedia.map((m, i) => (
                <div key={i} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #EAECF0' }}><img src={m.url} style={{ width: '100%', height: '110px', objectFit: 'cover' }} /></div>
            ))}
        </div>
    );
}

function PrescriptionsTab({ patient, patientId }) {
    const [meds, setMeds] = useState(patient?.medications || []);
    const [newMed, setNewMed] = useState('');
    const save = async (u) => { await updateDoc(doc(db, 'patients', patientId), { medications: u }); setMeds(u); };
    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #EAECF0' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', marginBottom: '16px' }}>Active Medications</h3>
            {meds.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#F9FAFB', borderRadius: '10px', marginBottom: '6px' }}>
                    {m}<button onClick={() => save(meds.filter((_,j)=>j!==i))} style={{ border: 'none', background: 'none', color: '#EF4444' }}><Trash2 size={16}/></button>
                </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <input value={newMed} onChange={e=>setNewMed(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #EAECF0' }} /><button onClick={()=>{ if(newMed.trim()){ save([...meds, newMed.trim()]); setNewMed(''); } }} style={{ background: '#0052FF', color: 'white', border: 'none', borderRadius: '10px', padding: '0 20px', fontWeight: '800' }}>Add</button>
            </div>
        </div>
    );
}

function CarePlanTab({ tasks, patientId }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map((t, i) => (
                <div key={i} style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between' }}>
                    <div>{t.title}</div><button onClick={() => deleteRelativeTask(patientId, t.id)} style={{ border: 'none', color: '#EF4444', background: 'none' }}><Trash2 size={16}/></button>
                </div>
            ))}
        </div>
    );
}

function NotesTab({ clinicalNotes, newNote, setNewNote, onAdd }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #EAECF0' }}>
                <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} style={{ width: '100%', height: '80px', borderRadius: '10px', border: '1px solid #F1F1F1', padding: '12px', marginBottom: '10px' }} /><button onClick={onAdd} style={{ background: '#0052FF', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: '800' }}>Post Note</button>
            </div>
            {clinicalNotes.map((n, i) => (
                <div key={i} style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #F1F1F1' }}>
                    <div style={{ fontSize: '11px', color: '#667085', marginBottom: '4px' }}>{formatDate(n.timestamp)}</div><div style={{ fontSize: '14px' }}>{n.note}</div>
                </div>
            ))}
        </div>
    );
}

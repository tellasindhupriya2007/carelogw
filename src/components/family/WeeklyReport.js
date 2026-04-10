import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../context/AuthContext';
import ScreenHeader from '../../components/common/ScreenHeader';
import Card from '../common/Card';
import PrimaryButton from '../common/PrimaryButton';
import SkeletonCard from '../common/SkeletonCard';
import ErrorCard from '../common/ErrorCard';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import jsPDF from 'jspdf';

const emojis = {
    "Very Sad": '😫',
    "Sad": '😔',
    "Neutral": '😐',
    "Happy": '🙂',
    "Very Happy": '😄'
};

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getFirstDayOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

const formatDateObj = (d) => {
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-');
};

const getDisplayWeek = (mondayDate) => {
    const sunday = new Date(mondayDate);
    sunday.setDate(mondayDate.getDate() + 6);

    const options = { day: 'numeric', month: 'short' };
    const mStr = mondayDate.toLocaleDateString('en-US', options);
    const sStr = sunday.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${mStr} - ${sStr}`;
};

export default function WeeklyReport() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { patientId: authPatientId } = useAuthContext();

    // Fallback to URL ID if navigated from Doctor portal
    const patientId = id || authPatientId;

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [weekStart, setWeekStart] = useState(() => getFirstDayOfWeek(new Date()));
    const [logs, setLogs] = useState({});
    const [stats, setStats] = useState(null);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (message, type) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (patientId) {
            fetchLogsForWeek(weekStart);
        }
    }, [weekStart, patientId]);

    const fetchLogsForWeek = async (startDate) => {
        if (!patientId) return;
        setLoading(true);

        try {
            const weekStr = formatDateObj(startDate);
            const reportRef = doc(db, 'weeklyReports', `${patientId}_${weekStr}`);

            // Read from weeklyReports collection properly
            const reportSnap = await getDoc(reportRef);
            if (reportSnap.exists()) {
                console.log("Existing report metadata fetched", reportSnap.data());
            }

            // Setup the 7 date strings
            const dates = [];
            const current = new Date(startDate);
            for (let i = 0; i < 7; i++) {
                dates.push(formatDateObj(current));
                current.setDate(current.getDate() + 1);
            }

            // Query firestore
            const logsRef = collection(db, 'dailyLogs');
            // Firebase 'in' max is 10, so array of 7 dates is perfectly fine
            const q = query(logsRef, where('patientId', '==', patientId), where('date', 'in', dates));
            const snap = await getDocs(q);

            const logMap = {};
            snap.forEach(d => {
                logMap[d.data().date] = d.data();
            });

            setLogs(logMap);
            await calculateStats(logMap, dates, startDate);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError("Failed to generate report parameters. Data empty or missing.");
            setLoading(false);
        }
    };

    const calculateStats = async (logMap, dates, startDate) => {
        let totMeds = 0;
        let compMeds = 0;
        let scores = [];
        let bpSysArr = [], bpDiaArr = [], hrArr = [], tempArr = [];
        let abnormalDaysMap = {};
        let moodArr = [];
        let obsArr = [];

        dates.forEach((dateStr, idx) => {
            const dayName = daysOfWeek[idx];
            const lg = logMap[dateStr];

            if (lg) {
                // Meds
                const meds = lg.tasks?.filter(t => t.icon === 'Pill') || [];
                totMeds += meds.length;
                compMeds += meds.filter(t => t.status === 'Completed').length;

                // Scores
                scores.push({ day: dayName, score: lg.careScore || 0 });

                // Vitals
                lg.vitals?.forEach(v => {
                    if (v.bpSystolic) bpSysArr.push(v.bpSystolic);
                    if (v.bpDiastolic) bpDiaArr.push(v.bpDiastolic);
                    if (v.heartRate) hrArr.push(v.heartRate);
                    if (v.temperature) tempArr.push(v.temperature);
                });

                // Abnormalities
                const abmVitals = lg.vitals?.filter(v => v.alertTriggered);
                const abmTasks = lg.tasks?.filter(t => t.status !== 'Completed' && t.isCritical); // Ex: missed critical

                const dayAbnormals = [];
                if (abmVitals && abmVitals.length > 0) dayAbnormals.push("Abnormal Vitals");
                lg.observations?.forEach(o => {
                    if (o.isCritical) dayAbnormals.push("Critical Observation");
                });

                abnormalDaysMap[dayName] = dayAbnormals.length > 0 ? dayAbnormals.join(', ') : "None";

                // Mood
                if (lg.observations?.length > 0) {
                    const lastMood = lg.observations[lg.observations.length - 1].mood;
                    if (lastMood) moodArr.push({ day: dayName, mood: lastMood });
                } else {
                    moodArr.push({ day: dayName, mood: null });
                }

                // Observations (bullet list)
                lg.observations?.forEach(o => {
                    if (o.audioUrl || o.mood || o.isCritical) {
                        obsArr.push({
                            date: dateStr,
                            time: new Date(o.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            name: o.caretakerName || 'Caretaker',
                            text: o.isCritical ? "Flagged critical observation" : "Recorded mood/audio observation"
                        });
                    }
                });

            } else {
                // No log for day
                scores.push({ day: dayName, score: 0 });
                abnormalDaysMap[dayName] = "None";
                moodArr.push({ day: dayName, mood: null });
            }
        });

        const calcAvg = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;
        const calcMax = arr => arr.length ? Math.max(...arr) : 0;
        const calcMin = arr => arr.length ? Math.min(...arr) : 0;

        const vStats = {
            bpSys: { avg: calcAvg(bpSysArr), max: calcMax(bpSysArr), min: calcMin(bpSysArr) },
            bpDia: { avg: calcAvg(bpDiaArr), max: calcMax(bpDiaArr), min: calcMin(bpDiaArr) },
            hr: { avg: calcAvg(hrArr), max: calcMax(hrArr), min: calcMin(hrArr) },
            temp: { avg: calcAvg(tempArr), max: calcMax(tempArr), min: calcMin(tempArr) }
        };

        const avgScore = calcAvg(scores.map(s => s.score));
        const medCompliance = totMeds > 0 ? Math.round((compMeds / totMeds) * 100) : 0;
        const happyDays = moodArr.filter(m => m.mood === 'Happy' || m.mood === 'Very Happy').length;

        const newStats = {
            totalMeds: totMeds,
            completedMeds: compMeds,
            medCompliance,
            scores,
            vStats,
            abnormalDaysMap,
            moodArr,
            obsArr,
            avgScore,
            happyDays
        };

        setStats(newStats);

        // Write to weeklyReports collection properly
        try {
            const weekStr = formatDateObj(startDate);
            const reportRef = doc(db, 'weeklyReports', `${patientId}_${weekStr}`);
            await setDoc(reportRef, {
                patientId,
                weekStartDate: weekStr,
                medicineCompliance: medCompliance,
                averageCareScore: avgScore,
                vitalsSummary: vStats,
                dayWiseAbnormalities: abnormalDaysMap,
                moodPattern: moodArr,
                caretakerObservations: obsArr,
                generatedAt: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error("Error saving to weeklyReports", e);
        }
    };

    const handlePrevWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        setWeekStart(d);
    };

    const handleNextWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        setWeekStart(d);
    };

    const generatePDF = () => {
        setGeneratingPDF(true);
        try {
            const doc = new jsPDF();
            doc.setFont("helvetica");

            doc.setFontSize(22);
            doc.setTextColor(45, 107, 228); // #2D6BE4
            doc.text("CareLog Weekly Report", 20, 20);

            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text(`Week: ${getDisplayWeek(weekStart)}`, 20, 28);

            doc.setLineWidth(0.5);
            doc.setDrawColor(200, 200, 200);
            doc.line(20, 32, 190, 32);

            // Section 1
            doc.setFontSize(16);
            doc.setTextColor(26, 26, 46);
            doc.text("1. Medicine Compliance", 20, 45);
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.text(`${stats.completedMeds} of ${stats.totalMeds} medicines given on time (${stats.medCompliance}%)`, 20, 52);

            // Section 2
            doc.setFontSize(16);
            doc.setTextColor(26, 26, 46);
            doc.text("2. Daily Care Scores Summary", 20, 65);
            let xOffset = 20;
            stats.scores.forEach(s => {
                doc.setFontSize(10);
                doc.text(`${s.day}: ${s.score}/10`, xOffset, 72);
                xOffset += 24;
            });
            doc.setFontSize(12);
            doc.text(`Average Score: ${stats.avgScore}/10`, 20, 80);

            // Section 3
            doc.setFontSize(16);
            doc.setTextColor(26, 26, 46);
            doc.text("3. Vitals Summary", 20, 95);
            doc.setFontSize(10);
            doc.text("Param    Avg    Max    Min", 20, 102);
            doc.text(`BP(S)    ${stats.vStats.bpSys.avg}    ${stats.vStats.bpSys.max}    ${stats.vStats.bpSys.min}`, 20, 108);
            doc.text(`BP(D)    ${stats.vStats.bpDia.avg}    ${stats.vStats.bpDia.max}    ${stats.vStats.bpDia.min}`, 20, 114);
            doc.text(`HR       ${stats.vStats.hr.avg}    ${stats.vStats.hr.max}    ${stats.vStats.hr.min}`, 20, 120);
            doc.text(`Temp     ${stats.vStats.temp.avg}    ${stats.vStats.temp.max}    ${stats.vStats.temp.min}`, 20, 126);

            // Section 4
            doc.setFontSize(16);
            doc.setTextColor(26, 26, 46);
            doc.text("4. Day Wise Abnormalities", 20, 140);
            let yOff = 147;
            daysOfWeek.forEach(day => {
                doc.setFontSize(10);
                doc.text(`${day}: ${stats.abnormalDaysMap[day]}`, 20, yOff);
                yOff += 6;
            });

            // Section 6
            yOff += 5;
            doc.setFontSize(16);
            doc.setTextColor(26, 26, 46);
            doc.text("5. Caretaker Observations", 20, yOff);
            yOff += 7;
            if (stats.obsArr.length === 0) {
                doc.setFontSize(10);
                doc.text("No observations recorded.", 20, yOff);
            } else {
                stats.obsArr.forEach(obs => {
                    doc.setFontSize(10);
                    doc.text(`• ${obs.date} ${obs.time}: ${obs.text} (${obs.name})`, 20, yOff);
                    yOff += 6;
                    if (yOff > 280) {
                        doc.addPage();
                        yOff = 20;
                    }
                });
            }

            doc.save(`CareLog_Report_${formatDateObj(weekStart)}.pdf`);
            showToast("Report Downloaded!", "success");
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF.", "error");
        }
        setGeneratingPDF(false);
    };

    const SectionHeading = ({ title }) => (
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.textPrimary, marginBottom: '16px', borderBottom: `2px solid ${colors.border}`, paddingBottom: '8px' }}>
            {title}
        </h3>
    );

    return (
        <div style={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: toast.type === 'success' ? colors.successGreen : colors.alertRed,
                    color: toast.type === 'success' ? colors.primaryGreen : colors.white,
                    padding: '12px 24px', borderRadius: spacing.borderRadius.badge, fontWeight: '600',
                    boxShadow: spacing.shadows.card, zIndex: 100, animation: 'slideDown 0.3s ease-out'
                }}>
                    {toast.message}
                </div>
            )}

            <ScreenHeader
                title="Weekly Report"
                showBack onBack={() => navigate(-1)}
                rightIcon={<History size={24} color={colors.textPrimary} style={{ cursor: 'pointer' }} />}
            />

            {/* Week Selector */}
            <div className="week-selector">
                <button onClick={handlePrevWeek} className="nav-btn">
                    <ChevronLeft size={24} color={colors.primaryBlue} />
                </button>
                <span className="week-label">
                    {getDisplayWeek(weekStart)}
                </span>
                <button onClick={handleNextWeek} className="nav-btn">
                    <ChevronRight size={24} color={colors.primaryBlue} />
                </button>
            </div>

            <div className="main-content scroll-y report-container">
                {error ? (
                    <ErrorCard message={error} />
                ) : loading || !stats ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <SkeletonCard style={{ height: '120px' }} />
                        <SkeletonCard style={{ height: '200px' }} />
                        <SkeletonCard style={{ height: '160px' }} />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Section 1 */}
                        <Card>
                            <SectionHeading title="Medicine Compliance" />
                            <div style={{ width: '100%', height: '12px', backgroundColor: colors.background, borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                                <div style={{ width: `${stats.medCompliance}%`, height: '100%', backgroundColor: colors.primaryGreen, transition: 'width 1s ease-out' }} />
                            </div>
                            <span style={{ fontSize: '14px', color: colors.textSecondary }}>{stats.completedMeds} of {stats.totalMeds} medicines given on time</span>
                            {stats.medCompliance < 100 && stats.totalMeds > 0 && (
                                <div style={{ fontSize: '12px', color: colors.alertRed, marginTop: '8px' }}>Missed {stats.totalMeds - stats.completedMeds} routine(s) this week.</div>
                            )}
                        </Card>

                        {/* Section 2 */}
                        <Card>
                            <SectionHeading title="Daily Care Scores" />
                            <div style={{ height: '160px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.scores} margin={{ top: 15, right: 0, left: -25, bottom: 0 }}>
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: colors.textSecondary }} />
                                        <YAxis hide domain={[0, 10]} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: spacing.shadows.card }} />
                                        <Bar dataKey="score" fill={colors.primaryBlue} radius={[4, 4, 0, 0]} barSize={24}>
                                            {stats.scores.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.score >= 8 ? colors.primaryGreen : (entry.score >= 5 ? colors.alertYellow : colors.alertRed)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '12px' }}>
                                <span style={{ fontSize: '14px', fontWeight: '600' }}>Average Score: {stats.avgScore} / 10</span>
                            </div>
                        </Card>

                        {/* Section 3 */}
                        <Card>
                            <SectionHeading title="Vitals Summary" />
                            <div className="table-wrapper">
                                <table className="clinical-table">
                                    <thead>
                                        <tr>
                                            <th>Parameter</th>
                                            <th>Avg</th>
                                            <th>High</th>
                                            <th>Low</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { label: 'BP Sys', data: stats.vStats.bpSys, abmLim: 140 },
                                            { label: 'BP Dia', data: stats.vStats.bpDia, abmLim: 90 },
                                            { label: 'HR (bpm)', data: stats.vStats.hr, abmLim: 100 },
                                            { label: 'Temp (F)', data: stats.vStats.temp, abmLim: 99 }
                                        ].map((r, i) => (
                                            <tr key={i}>
                                                <td className="param-label">{r.label}</td>
                                                <td>{r.data.avg || '-'}</td>
                                                <td className={r.data.max > r.abmLim ? 'abnormal' : ''}>{r.data.max || '-'}</td>
                                                <td>{r.data.min || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* Section 4 */}
                        <Card>
                            <SectionHeading title="Day Wise Abnormalities" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {daysOfWeek.map((day, i) => {
                                    const val = stats.abnormalDaysMap[day];
                                    const isAbm = val !== 'None';
                                    return (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '600' }}>{day}</span>
                                            <span style={{ fontSize: '14px', color: isAbm ? colors.alertRed : colors.textSecondary, fontWeight: isAbm ? '600' : '400' }}>{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>

                        {/* Section 5 */}
                        <Card>
                            <SectionHeading title="Mood Pattern" />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                {stats.moodArr.map((m, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '24px' }}>{m.mood ? emojis[m.mood] : '—'}</span>
                                        <span style={{ fontSize: '10px', color: colors.textSecondary }}>{m.day}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '14px', color: colors.textSecondary }}>
                                Patient was happy on <span style={{ fontWeight: '600', color: colors.primaryBlue }}>{stats.happyDays}</span> days this week.
                            </div>
                        </Card>

                        {/* Section 6 */}
                        <Card>
                            <SectionHeading title="Caretaker Observations" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {stats.obsArr.length === 0 ? (
                                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>No observations recorded.</span>
                                ) : (
                                    stats.obsArr.map((obs, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ marginTop: '6px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.primaryBlue }} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '14px', color: colors.textPrimary }}>{obs.text}</span>
                                                <span style={{ fontSize: '12px', color: colors.textSecondary }}>{obs.date} {obs.time} • {obs.name}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        {/* Section 7 */}
                        <Card style={{ marginBottom: '16px' }}>
                            <SectionHeading title="Overall Summary" />
                            <div className="overall-summary-grid">
                                <div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Medicines</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{stats.completedMeds}/{stats.totalMeds}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Completion %</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600', color: colors.primaryGreen }}>{stats.medCompliance}%</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Avg Score</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{stats.avgScore} <span style={{ fontSize: '12px' }}>/ 10</span></div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Abnormal Days</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600', color: colors.alertRed }}>
                                        {Object.values(stats.abnormalDaysMap).filter(v => v !== 'None').length}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Happy Days</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600', color: colors.primaryBlue }}>{stats.happyDays}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary }}>Observations</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{stats.obsArr.length}</div>
                                </div>
                            </div>
                        </Card>

                    </div>
                )}
            </div>

            {/* Sticky Bottom Area */}
            <div className="report-footer">
                <div className="footer-content">
                    <PrimaryButton label="Download PDF Report" onClick={generatePDF} isLoading={generatingPDF || loading} disabled={generatingPDF || loading} />
                </div>
            </div>

            <style>{`
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
        </div>
    );
}

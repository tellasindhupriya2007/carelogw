import React, { useState, useEffect } from 'react';
import { 
    Plus, Trash2, Clock, CheckCircle2, AlertCircle, 
    Calendar, ChevronRight, X, Pill, Activity, Utensils 
} from 'lucide-react';
import { addTask, deleteRelativeTask, subscribeToTasks, createDefaultWorkflow } from '../../services/taskService';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { useAuthContext } from '../../context/AuthContext';

export default function TaskManager({ patientId }) {
    const { isDev } = useAuthContext();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // New Task Form State
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('');
    const [category, setCategory] = useState('Routine Check');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!patientId) return;
        const unsub = subscribeToTasks(patientId, async (allTasks) => {
            if (allTasks.length === 0 && isDev) {
                // Auto load realistic mock tasks ONLY in dev mode
                await createDefaultWorkflow(patientId);
            } else {
                setTasks(allTasks);
                setLoading(false);
            }
        });
        return () => unsub();
    }, [patientId, isDev]);

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!title) return;
        
        setIsSubmitting(true);
        let icon = 'Activity';
        if (category === 'Medication') icon = 'Pill';
        if (category === 'Nutrition') icon = 'Utensils';
        if (category === 'Vitals Monitoring') icon = 'HeartPulse';
        if (category === 'Sleep Routine') icon = 'Moon';

        try {
            await addTask(patientId, {
                title,
                time: time || 'As needed',
                category,
                icon
            });
            setTitle('');
            setTime('');
            setShowAddModal(false);
        } catch (err) {
            console.error(err);
            alert("Failed to add task.");
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (taskId) => {
        if (window.confirm("Are you sure you want to remove this task? It will no longer appear on the caretaker's dashboard.")) {
            try {
                await deleteRelativeTask(patientId, taskId);
            } catch (err) {
                console.error(err);
                alert("Failed to delete task.");
            }
        }
    };

    return (
        <div style={{ backgroundColor: colors.white, borderRadius: '16px', padding: '16px', boxShadow: spacing.shadows.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: colors.lightBlue, padding: '8px', borderRadius: '10px' }}>
                        <Clock size={20} color={colors.primaryBlue} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '15px', fontWeight: '800', color: colors.textPrimary, lineHeight: 1.2 }}>Prescribed Care</h2>
                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>Assign tasks for daily care</span>
                    </div>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    style={{ 
                        backgroundColor: colors.background, color: colors.primaryBlue, border: `1.5px solid ${colors.border}`, borderRadius: '10px',
                        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                        fontWeight: '700', fontSize: '13px', transition: 'all 0.2s', marginTop: '2px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.lightBlue; e.currentTarget.style.borderColor = colors.primaryBlue; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.background; e.currentTarget.style.borderColor = colors.border; }}
                >
                    <Plus size={16} strokeWidth={2.5} /> Add Task
                </button>
            </div>

            {loading ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: colors.textSecondary }}>Loading tasks...</div>
            ) : tasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tasks.map((task) => (
                        <div key={task.id} style={{ 
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px',
                            backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9'
                        }}>
                            <div style={{ 
                                width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 
                                    task.category === 'Medication' ? colors.lightBlue : 
                                    task.category === 'Vitals Monitoring' ? '#F3E8FF' : 
                                    task.category === 'Nutrition' ? colors.lightGreen : colors.white,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0', flexShrink: 0
                            }}>
                                {task.category === 'Medication' ? <Pill size={18} color={colors.primaryBlue} /> : 
                                 task.category === 'Nutrition' ? <Utensils size={18} color={colors.primaryGreen} /> : 
                                 <Activity size={18} color={task.category === 'Vitals Monitoring' ? '#8B5CF6' : colors.textSecondary} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{task.title}</h4>
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#E2E8F0', color: '#475569', fontWeight: '600' }}>{task.category}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: colors.textSecondary }}>
                                    <Clock size={12} />
                                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{task.time}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDelete(task.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '6px', borderRadius: '8px', flexShrink: 0 }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ 
                    textAlign: 'left', padding: '16px', backgroundColor: colors.background, borderRadius: '12px', border: `1px solid ${colors.border}`
                }}>
                    <span style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={14} /> {isDev ? "Auto-populating mock tasks..." : "No tasks added to the care plan yet."}
                    </span>
                </div>
            )}

            {/* Add Task Modal overlay */}
            {showAddModal && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
                }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: spacing.shadows.card }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: colors.textPrimary }}>New Care Task</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddTask} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: colors.textSecondary }}>TASK TITLE</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Check Blood Pressure" 
                                    required
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: colors.textSecondary }}>SCHEDULED TIME</label>
                                    <input 
                                        type="time" 
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        required
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: colors.textSecondary }}>CATEGORY</label>
                                    <select 
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', backgroundColor: 'white', outline: 'none' }}
                                    >
                                        <option value="Routine Check">Routine Check</option>
                                        <option value="Medication">Medication</option>
                                        <option value="Vitals Monitoring">Vitals Monitoring</option>
                                        <option value="Nutrition">Nutrition</option>
                                        <option value="Physical Activity">Physical Activity</option>
                                        <option value="Hygiene & Personal Care">Hygiene & Personal Care</option>
                                        <option value="Sleep Routine">Sleep Routine</option>
                                        <option value="Observation">Observation</option>
                                        <option value="Emergency / Alert">Emergency / Alert</option>
                                        <option value="Mental Wellbeing">Mental Wellbeing</option>
                                    </select>
                                </div>
                            </div>
                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                style={{ 
                                    backgroundColor: colors.primaryBlue, color: 'white', border: 'none', borderRadius: '12px',
                                    padding: '14px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginTop: '8px', transition: 'opacity 0.2s'
                                }}
                            >
                                {isSubmitting ? 'Saving...' : 'Add to Care Plan'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

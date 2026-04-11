import { triggerAlert } from '../services/alertService';

export const checkVitalsAndCreateAlert = async (patientId, vitalsData, patientDetails) => {
    // Standardized schema: { bp: { systolic, diastolic }, heartRate, temperature }
    const { bp, heartRate, temperature } = vitalsData;
    const sys = Number(bp?.systolic) || 0;
    const dia = Number(bp?.diastolic) || 0;
    const hr = Number(heartRate) || 0;
    const temp = Number(temperature) || 0;
    
    let anyAlert = false;

    // 1. BLOOD PRESSURE
    if (sys >= 140 || sys <= 90 || dia >= 90) {
        await triggerAlert(patientId, 'critical', `CRITICAL BP: ${sys}/${dia} mmHg`, 'vitals');
        anyAlert = true;
    } else if (sys > 130 || sys < 95) {
        await triggerAlert(patientId, 'warning', `BP Deviation: ${sys}/${dia} mmHg`, 'vitals');
        anyAlert = true;
    }

    // 2. HEART RATE
    if (hr >= 110 || hr <= 50) {
        await triggerAlert(patientId, 'critical', `CRITICAL HEART RATE: ${hr} BPM`, 'vitals');
        anyAlert = true;
    } else if (hr > 95 || hr < 60) {
        await triggerAlert(patientId, 'warning', `HR Deviation: ${hr} BPM`, 'vitals');
        anyAlert = true;
    }

    // 3. TEMPERATURE
    if (temp >= 100.4 || temp <= 95) {
        await triggerAlert(patientId, 'critical', `CRITICAL TEMP: ${temp}°F`, 'vitals');
        anyAlert = true;
    } else if (temp > 99.1 || temp < 96.5) {
        await triggerAlert(patientId, 'warning', `Febrile Warning: ${temp}°F`, 'vitals');
        anyAlert = true;
    }

    return anyAlert;
};

export const checkCriticalObservationAndAlert = async (patientId, observationData) => {
    // C. OBSERVATIONS: Caregiver marks abnormal → critical
    if (observationData.isCritical) {
        await triggerAlert(patientId, 'critical', 'Caretaker marked abnormal observation', 'observation');
        return true;
    }
    return false;
};

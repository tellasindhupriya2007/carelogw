import React from 'react';
import { useAuthContext } from '../../context/AuthContext';
import CaretakerShell from './CaretakerShell';
import ChatInterface from '../common/ChatInterface';

export default function CaretakerMessages() {
    const { user, patientId } = useAuthContext();

    return (
        <CaretakerShell title="Care Team Hub">
            <div style={{ height: 'calc(100vh - 72px)', display: 'flex', overflow: 'hidden' }}>
                <ChatInterface 
                    currentUser={user} 
                    patientId={patientId} 
                    userRole="caretaker" 
                />
            </div>
        </CaretakerShell>
    );
}

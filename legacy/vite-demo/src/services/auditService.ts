import { AuditLogEntry } from '../types';
import { DEMO_AUDIT_LOGS } from '../constants';

const STORAGE_KEY = 'synapse_audit_logs';

export const getAuditLogs = (): AuditLogEntry[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_AUDIT_LOGS));
    return DEMO_AUDIT_LOGS;
  }
  return JSON.parse(stored);
};

export const logAction = (
  userId: string, 
  userName: string, 
  action: string, 
  category: AuditLogEntry['category'], 
  metadata?: AuditLogEntry['metadata']
) => {
  const logs = getAuditLogs();
  const newLog: AuditLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action,
    category,
    metadata
  };
  
  const updatedLogs = [newLog, ...logs];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs.slice(0, 100))); // Keep last 100
  return newLog;
};

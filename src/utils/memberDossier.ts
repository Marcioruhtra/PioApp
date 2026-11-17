import {
  AuditLogEntry,
  ClubActivity,
  Member,
  MemberTrainingProgress,
  OfficialDocument,
  PaymentReceipt,
  UserAccount,
} from '../types';
import { ClubDatabaseState } from '../services/storageService';
import {
  calculateMemberQuotaSummary,
  MemberQuotaSummary,
  resolveQuotaConfig,
} from '../services/quotaService';
import { calculateAgeYears, getTodayISODate } from './date';

export interface MemberAttendanceEntry {
  activityId: string;
  title: string;
  type: ClubActivity['type'];
  date: string;
  location: string;
  stage: ClubActivity['stage'];
  status: 'presente' | 'justificado' | 'ausente';
  notes?: string;
}

export interface MemberTimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  actorName?: string;
  category: 'cadastro' | 'formacao' | 'equipa' | 'tesouraria' | 'auditoria' | 'documento';
}

export interface MemberDossierData {
  ageYears: number | null;
  isMinor: boolean;
  missingGuardianInfo: boolean;
  linkedUser: UserAccount | null;
  training: {
    items: (MemberTrainingProgress & { progressPercent: number; isCompleted: boolean })[];
    classesCount: number;
    honorsCount: number;
    completedCount: number;
    averageProgressPercent: number;
  };
  attendance: {
    entries: MemberAttendanceEntry[];
    totalRecorded: number;
    presentCount: number;
    justifiedCount: number;
    absentCount: number;
    attendanceRatePercent: number;
  };
  quotas: {
    summary: MemberQuotaSummary;
    receipts: PaymentReceipt[];
    documents: OfficialDocument[];
  };
  timeline: MemberTimelineEvent[];
}

function matchesMemberRef(candidateId: string | undefined, member: Member): boolean {
  if (!candidateId) return false;
  return candidateId === member.id || candidateId === member.manualNumber;
}

function classifyAuditCategory(entry: AuditLogEntry): MemberTimelineEvent['category'] {
  const mod = (entry.module || '').toLowerCase();
  if (mod === 'treasury') return 'tesouraria';
  if (mod === 'training') return 'formacao';
  if (mod === 'documents') return 'documento';
  if ((entry.action || '').includes('EQUIPA')) return 'equipa';
  if (mod === 'members') return 'cadastro';
  return 'auditoria';
}

export function buildMemberDossierData(
  member: Member,
  state: Pick<
    ClubDatabaseState,
    'users' | 'trainingProgress' | 'activities' | 'settings' | 'fees' | 'receipts' | 'quotaWaivers' | 'documents' | 'auditLogs'
  >,
  referenceDateStr: string = getTodayISODate()
): MemberDossierData {
  const refDate = referenceDateStr ? new Date(`${referenceDateStr}T12:00:00`) : new Date();
  const ageYears = calculateAgeYears(member.birthDate, isNaN(refDate.getTime()) ? new Date() : refDate);
  const isMinor = ageYears !== null && ageYears < 18;
  const missingGuardianInfo =
    isMinor && (!member.guardianName?.trim() || !member.guardianPhone?.trim());

  const linkedUser =
    (state.users || []).find(
      (u) =>
        u.linkedMemberId === member.id ||
        u.linkedMemberId === member.manualNumber ||
        (member.manualNumber && u.manualNumber === member.manualNumber) ||
        (member.email && u.email && u.email.trim().toLowerCase() === member.email.trim().toLowerCase())
    ) || null;

  // Formação (Classes & Especialidades)
  const trainingItems = (state.trainingProgress || [])
    .filter((tp) => matchesMemberRef(tp.memberId, member))
    .map((tp) => {
      const total = tp.totalRequirements > 0 ? tp.totalRequirements : 1;
      const progressPercent = Math.min(
        100,
        Math.round((tp.completedRequirements.length / total) * 100)
      );
      const isCompleted =
        tp.finalAuthorizedApproval ||
        (tp.instructorValidated && tp.completedRequirements.length >= tp.totalRequirements);
      return {
        ...tp,
        progressPercent,
        isCompleted,
      };
    });

  const classesCount = trainingItems.filter((t) => t.type === 'classe').length;
  const honorsCount = trainingItems.filter((t) => t.type === 'especialidade').length;
  const completedCount = trainingItems.filter((t) => t.isCompleted).length;
  const averageProgressPercent =
    trainingItems.length > 0
      ? Math.round(
          trainingItems.reduce((sum, item) => sum + item.progressPercent, 0) /
            trainingItems.length
        )
      : 0;

  // Assiduidade & Atividades
  const attendanceEntries: MemberAttendanceEntry[] = [];
  (state.activities || []).forEach((act) => {
    const rec = (act.attendees || []).find((att) => matchesMemberRef(att.memberId, member));
    if (rec) {
      const status: MemberAttendanceEntry['status'] = rec.present
        ? 'presente'
        : rec.justified
        ? 'justificado'
        : 'ausente';
      attendanceEntries.push({
        activityId: act.id,
        title: act.title,
        type: act.type,
        date: act.startDate,
        location: act.location,
        stage: act.stage,
        status,
        notes: rec.notes,
      });
    }
  });
  attendanceEntries.sort((a, b) => b.date.localeCompare(a.date));

  const totalRecorded = attendanceEntries.length;
  const presentCount = attendanceEntries.filter((e) => e.status === 'presente').length;
  const justifiedCount = attendanceEntries.filter((e) => e.status === 'justificado').length;
  const absentCount = attendanceEntries.filter((e) => e.status === 'ausente').length;
  const attendanceRatePercent =
    totalRecorded > 0 ? Math.round(((presentCount + justifiedCount) / totalRecorded) * 100) : 0;

  // Quotas, Recibos e Documentos Oficiais
  const effectiveQuotaConfig = resolveQuotaConfig(state.settings, state.fees || []);
  const summary = calculateMemberQuotaSummary(
    member,
    effectiveQuotaConfig,
    state.fees || [],
    state.receipts || [],
    referenceDateStr,
    state.quotaWaivers || []
  );

  const memberReceipts = (state.receipts || [])
    .filter(
      (r) =>
        matchesMemberRef(r.memberId, member) ||
        r.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase()
    )
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  const memberDocuments = (state.documents || [])
    .filter(
      (d) =>
        matchesMemberRef(d.issuedToMemberId, member) ||
        (d.issuedToName &&
          d.issuedToName.trim().toLowerCase() === member.fullName.trim().toLowerCase())
    )
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  // Linha do Tempo Associativa (Marcos + Auditoria do Membro)
  const timeline: MemberTimelineEvent[] = [];

  if (member.joinedDate) {
    timeline.push({
      id: `ML-JOIN-${member.id}`,
      date: member.joinedDate,
      title: 'Admissão Oficial no Clube',
      description: `Ingresso registado na categoria ${member.category.toUpperCase()}${
        member.unitOrTeam ? ` · Equipa ${member.unitOrTeam}` : ''
      }.`,
      category: 'cadastro',
    });
  }

  if (member.investitureDate) {
    timeline.push({
      id: `ML-INV-${member.id}`,
      date: member.investitureDate,
      title: 'Cerimónia de Investidura',
      description: `Investido oficialmente na categoria ${
        member.category === 'lider' ? 'Líder' : 'Embaixador'
      }.`,
      category: 'formacao',
    });
  }

  if (member.archivedAt) {
    timeline.push({
      id: `ML-ARC-${member.id}`,
      date: member.archivedAt,
      title: 'Arquivamento de Ficha',
      description: member.archiveReason || 'Ficha arquivada administrativamente.',
      category: 'cadastro',
    });
  }

  const normalizedName = member.fullName.trim().toLowerCase();
  (state.auditLogs || []).forEach((log) => {
    const matchesTarget =
      matchesMemberRef(log.entityId, member) ||
      (log.entityName && log.entityName.trim().toLowerCase() === normalizedName);
    if (matchesTarget) {
      timeline.push({
        id: log.id,
        date: log.timestamp,
        title: log.action.replace(/_/g, ' '),
        description: log.details,
        actorName: log.actorName,
        category: classifyAuditCategory(log),
      });
    }
  });

  timeline.sort((a, b) => b.date.localeCompare(a.date));

  return {
    ageYears,
    isMinor,
    missingGuardianInfo,
    linkedUser,
    training: {
      items: trainingItems,
      classesCount,
      honorsCount,
      completedCount,
      averageProgressPercent,
    },
    attendance: {
      entries: attendanceEntries,
      totalRecorded,
      presentCount,
      justifiedCount,
      absentCount,
      attendanceRatePercent,
    },
    quotas: {
      summary,
      receipts: memberReceipts,
      documents: memberDocuments,
    },
    timeline,
  };
}

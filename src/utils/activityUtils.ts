import {
  ActivityRsvpRecord,
  ActivityStage,
  ClubActivity,
  ModuleName,
  PermissionAction,
  RoleType,
} from '../types';
import { hasPermission } from '../services/permissionService';

export const ACTIVITY_TYPE_LABELS: Record<ClubActivity['type'], string> = {
  reuniao_regular: 'Actividades Normais',
  acampamento: 'Acampamento / Bivaque',
  civica: 'Atividade Cívica',
  formacao: 'Formação e Módulos',
  social: 'Ação Social',
  diretoria: 'Reunião da Comissão',
};

export const ACTIVITY_STAGE_LABELS: Record<ActivityStage, string> = {
  planeamento: 'Planeamento',
  aprovacao: 'Aprovação',
  preparacao: 'Preparação',
  execucao: 'Execução',
  relatorio: 'Relatório',
  encerrado: 'Encerrado',
};

export const ACTIVITY_TYPE_COLORS: Record<
  ClubActivity['type'],
  { pill: string; badge: string; border: string }
> = {
  reuniao_regular: {
    pill: 'bg-blue-100 text-blue-900 border-blue-200 hover:bg-blue-200',
    badge: 'bg-blue-100 text-blue-900 border-blue-200',
    border: 'border-l-blue-700',
  },
  acampamento: {
    pill: 'bg-emerald-100 text-emerald-900 border-emerald-200 hover:bg-emerald-200',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    border: 'border-l-emerald-700',
  },
  civica: {
    pill: 'bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    border: 'border-l-amber-600',
  },
  formacao: {
    pill: 'bg-indigo-100 text-indigo-900 border-indigo-200 hover:bg-indigo-200',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    border: 'border-l-indigo-700',
  },
  social: {
    pill: 'bg-cyan-100 text-cyan-900 border-cyan-200 hover:bg-cyan-200',
    badge: 'bg-cyan-100 text-cyan-900 border-cyan-200',
    border: 'border-l-cyan-700',
  },
  diretoria: {
    pill: 'bg-purple-100 text-purple-900 border-purple-200 hover:bg-purple-200',
    badge: 'bg-purple-100 text-purple-900 border-purple-200',
    border: 'border-l-purple-700',
  },
};

export function getActivityTypeLabel(type: ClubActivity['type']): string {
  return ACTIVITY_TYPE_LABELS[type] || String(type).replace('_', ' ');
}

export function getActivityStageLabel(stage: ActivityStage): string {
  return ACTIVITY_STAGE_LABELS[stage] || stage;
}

/**
 * Regra institucional: Atas oficiais só podem ser redigidas quando o tipo de atividade
 * for "Reunião da Comissão" (`type === 'diretoria'`).
 */
export function canActivityHaveMinute(type?: ClubActivity['type'] | null): boolean {
  return type === 'diretoria';
}

/**
 * Devolve apenas atividades que exigem ata ("Reunião da Comissão"), já saíram
 * da fase de planeamento e ainda não têm ata redigida.
 */
export function getActivitiesRequiringMinute(activities: ClubActivity[]): ClubActivity[] {
  return activities.filter(
    (act) => canActivityHaveMinute(act.type) && act.stage !== 'planeamento' && !act.minute
  );
}

/**
 * Apenas o Diretor (ou Administrador Técnico / papel com permissão explícita APPROVE em atividades)
 * pode autorizar ou revogar a visualização de atividades no Portal do Membro.
 */
export function canManageActivityPortalVisibility(
  role: RoleType,
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): boolean {
  if (role === 'diretor' || role === 'admin_tecnico') return true;
  if (permissionsMatrix?.[role] && Array.isArray(permissionsMatrix[role].activities)) {
    return permissionsMatrix[role].activities.includes('APPROVE');
  }
  return hasPermission(role, 'activities', 'APPROVE');
}

/**
 * Devolve apenas atividades explicitamente autorizadas pelo Diretor para visualização
 * no Portal do Membro, ordenadas por data de início (mais próximas primeiro).
 */
export function getMemberPortalVisibleActivities(activities: ClubActivity[]): ClubActivity[] {
  return (activities || [])
    .filter((act) => act.visibleInMemberPortal === true)
    .slice()
    .sort((a, b) => getActivityDateOnly(a.startDate).localeCompare(getActivityDateOnly(b.startDate)));
}

/**
 * Extrai AAAA-MM-DD de uma data ISO ou timestamp.
 */
export function getActivityDateOnly(dateValue?: string | null): string {
  if (!dateValue) return '';
  const str = String(dateValue).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

/**
 * Verifica se uma atividade ocorre numa determinada data AAAA-MM-DD (suporta eventos multi-dia).
 */
export function doesActivityOccurOnDate(activity: Pick<ClubActivity, 'startDate' | 'endDate'>, isoDate: string): boolean {
  const start = getActivityDateOnly(activity.startDate);
  if (!start || !isoDate) return false;
  const end = getActivityDateOnly(activity.endDate) || start;
  const normalizedEnd = end >= start ? end : start;
  return isoDate >= start && isoDate <= normalizedEnd;
}

/**
 * Formata o horário de uma atividade a partir de startTime/endTime ou do componente horário ISO.
 */
export function getActivityTimeRangeLabel(
  activity: Pick<ClubActivity, 'startDate' | 'endDate' | 'startTime' | 'endTime'>
): string | null {
  const extractTime = (iso?: string): string | null => {
    if (!iso || !iso.includes('T')) return null;
    const match = iso.match(/T(\d{2}:\d{2})/);
    if (!match) return null;
    return match[1] === '00:00' ? null : match[1];
  };

  const startT = activity.startTime?.trim() || extractTime(activity.startDate);
  const endT = activity.endTime?.trim() || extractTime(activity.endDate);
  if (startT && endT) return `${startT} – ${endT}`;
  if (startT) return startT;
  return null;
}

/**
 * Procura a ata da Reunião da Comissão imediatamente anterior à atividade atual.
 */
export function getPreviousCommissionMinute(
  activities: ClubActivity[],
  currentActivityId?: string
): { activityId: string; activityTitle: string; minute: NonNullable<ClubActivity['minute']> } | null {
  const candidates = (activities || [])
    .filter(
      (act) =>
        act.id !== currentActivityId &&
        canActivityHaveMinute(act.type) &&
        Boolean(act.minute)
    )
    .sort((a, b) => {
      const dateA = getActivityDateOnly(a.minute?.date || a.startDate);
      const dateB = getActivityDateOnly(b.minute?.date || b.startDate);
      return dateB.localeCompare(dateA);
    });

  if (candidates.length === 0 || !candidates[0].minute) return null;
  return {
    activityId: candidates[0].id,
    activityTitle: candidates[0].title,
    minute: candidates[0].minute,
  };
}

/**
 * Converte texto de deliberações em títulos limpos para geração de tarefas operacionais.
 */
export function parseDeliberationsToTaskDrafts(deliberationsText: string): string[] {
  if (!deliberationsText) return [];
  return deliberationsText
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length >= 4);
}

/**
 * Resume respostas de confirmação de presença (RSVP) do Portal do Membro.
 */
export function formatRsvpSummary(rsvps?: ActivityRsvpRecord[]): {
  vou: number;
  talvez: number;
  nao_posso: number;
  total: number;
} {
  const list = Array.isArray(rsvps) ? rsvps : [];
  let vou = 0;
  let talvez = 0;
  let nao_posso = 0;
  for (const r of list) {
    if (r.status === 'vou') vou++;
    else if (r.status === 'talvez') talvez++;
    else if (r.status === 'nao_posso') nao_posso++;
  }
  return { vou, talvez, nao_posso, total: list.length };
}

/**
 * Gera conteúdo RFC 5545 (.ics) válido para importação em qualquer calendário (Google, Apple, Outlook).
 */
export function buildActivityICS(
  activity: Pick<
    ClubActivity,
    'id' | 'title' | 'department' | 'location' | 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'description'
  >,
  clubName: string = "Clube de Embaixadores Pioneiros D'Alvorada"
): string {
  const escapeICS = (val: string) =>
    String(val || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');

  const startDateOnly = getActivityDateOnly(activity.startDate) || new Date().toISOString().split('T')[0];
  const endDateOnly = getActivityDateOnly(activity.endDate) || startDateOnly;
  const timeRange = getActivityTimeRangeLabel(activity);
  const startTimeParts = (activity.startTime || (timeRange ? timeRange.split('–')[0].trim() : '') || '08:30').split(':');
  const endTimeParts = (activity.endTime || (timeRange && timeRange.includes('–') ? timeRange.split('–')[1].trim() : '') || '12:00').split(':');

  const toICSDateTime = (dateISO: string, hh: string, mm: string) => {
    const cleanDate = dateISO.replace(/-/g, '');
    const h = (hh || '08').padStart(2, '0');
    const m = (mm || '00').padStart(2, '0');
    return `${cleanDate}T${h}${m}00`;
  };

  const dtStart = toICSDateTime(startDateOnly, startTimeParts[0], startTimeParts[1]);
  const dtEnd = toICSDateTime(
    endDateOnly >= startDateOnly ? endDateOnly : startDateOnly,
    endTimeParts[0],
    endTimeParts[1]
  );
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const descriptionParts = [
    activity.description?.trim(),
    `Departamento: ${activity.department || 'Geral'}`,
    `Organização: ${clubName}`,
  ].filter(Boolean);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PioApp//Gestao Clube DAlvorada//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${activity.id}@clubedalvorada.ao`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(activity.title)}`,
    `LOCATION:${escapeICS(activity.location || clubName)}`,
    `DESCRIPTION:${escapeICS(descriptionParts.join('\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadActivityICS(
  activity: Pick<
    ClubActivity,
    'id' | 'title' | 'department' | 'location' | 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'description'
  >,
  clubName?: string
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const icsContent = buildActivityICS(activity, clubName);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeSlug = (activity.title || 'atividade')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  link.href = url;
  link.download = `${safeSlug || 'atividade'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Calcula a participação agregada real de uma equipa considerando exclusivamente
 * atividades que já possuem lista de presenças registada (evita que atividades futuras
 * ou em planeamento sem chamada distorçam a percentagem da equipa).
 */
export function calculateTeamAttendanceStats(
  teamMemberIds: Set<string>,
  activities: ClubActivity[]
): {
  recordedActivitiesCount: number;
  totalSlots: number;
  totalPresent: number;
  participationPct: number;
} {
  const recordedActivities = activities.filter(
    (act) => Array.isArray(act.attendees) && act.attendees.length > 0
  );
  const totalSlots = teamMemberIds.size * recordedActivities.length;
  let totalPresent = 0;

  if (totalSlots > 0) {
    recordedActivities.forEach((act) => {
      act.attendees.forEach((att) => {
        if (att.present && teamMemberIds.has(att.memberId)) {
          totalPresent++;
        }
      });
    });
  }

  const participationPct =
    totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : 0;

  return {
    recordedActivitiesCount: recordedActivities.length,
    totalSlots,
    totalPresent,
    participationPct,
  };
}

/**
 * Aplica atualização de presença em lote para vários membros numa atividade específica,
 * preservando registos de membros fora do lote e notas existentes quando não sobrescritas.
 */
export function applyBatchAttendanceToActivities(
  activities: ClubActivity[],
  activityId: string,
  memberIds: string[],
  present: boolean,
  notes?: string
): ClubActivity[] {
  const uniqueIds = Array.from(new Set(memberIds.filter(Boolean)));
  if (uniqueIds.length === 0) return activities;
  const targetSet = new Set(uniqueIds);

  return activities.map((act) => {
    if (act.id !== activityId) return act;
    const preserved = (act.attendees || []).filter((att) => !targetSet.has(att.memberId));
    const existingById = new Map((act.attendees || []).map((att) => [att.memberId, att]));
    const updatedEntries = uniqueIds.map((memberId) => {
      const prev = existingById.get(memberId);
      return {
        memberId,
        present,
        notes: notes !== undefined ? notes : prev?.notes,
      };
    });
    return {
      ...act,
      attendees: [...preserved, ...updatedEntries],
    };
  });
}

export function formatTaskStatusLabel(status: ClubActivity['tasks'][number]['status']): string {
  switch (status) {
    case 'pendente':
      return 'Pendente';
    case 'em_progresso':
      return 'Em Progresso';
    case 'concluido':
      return 'Concluído';
    default:
      return status;
  }
}


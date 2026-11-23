import { ClubActivity } from '../types';

export const ACTIVITY_TYPE_LABELS: Record<ClubActivity['type'], string> = {
  reuniao_regular: 'Actividades Normais',
  acampamento: 'Acampamento / Bivaque',
  civica: 'Atividade Cívica',
  formacao: 'Formação e Módulos',
  social: 'Ação Social',
  diretoria: 'Reunião da Comissão',
};

export function getActivityTypeLabel(type: ClubActivity['type']): string {
  return ACTIVITY_TYPE_LABELS[type] || String(type).replace('_', ' ');
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


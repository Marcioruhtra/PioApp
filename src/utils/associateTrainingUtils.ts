import {
  ClubActivity,
  Member,
  MemberTrainingProgress,
  RoleType,
  SpecialtyHonor,
  TrainingClass,
  UserAccount,
} from '../types';
import { isDirectionMember } from '../services/accountSyncService';
import {
  getActivityDateOnly,
  getActivityStageLabel,
  getActivityTypeLabel,
  normalizeActivityStage,
  normalizeActivityType,
} from './activityUtils';

export const TRAINING_STALLED_DAYS_THRESHOLD = 30;

export interface CatalogTrainingSummary {
  id: string;
  code: string;
  type: 'classe' | 'especialidade';
  title: string;
  category?: SpecialtyHonor['category'];
  requirementsCount: number;
  enrolledCount: number;
  inProgressCount: number;
  readyForValidationCount: number;
  approvedCount: number;
  stalledCount: number;
  avgPct: number;
  instructorNames: string[];
}

export interface InstructorWorkloadSummary {
  instructorUserId: string;
  instructorName: string;
  role: RoleType | 'outro';
  totalAssigned: number;
  modulesCount: number;
  medalsCount: number;
  readyForValidationCount: number;
  approvedCount: number;
  stalledCount: number;
  avgPct: number;
}

export function computeTrainingProgressPct(
  progress: Pick<MemberTrainingProgress, 'completedRequirements' | 'totalRequirements'>
): number {
  const totalReq = progress.totalRequirements > 0 ? progress.totalRequirements : 1;
  const completed = Array.isArray(progress.completedRequirements) ? progress.completedRequirements.length : 0;
  return Math.min(100, Math.round((completed / totalReq) * 100));
}

export function getTrainingStagnationDays(
  progress: Pick<MemberTrainingProgress, 'updatedAt' | 'finalAuthorizedApproval' | 'completedRequirements' | 'totalRequirements'>,
  now: Date = new Date()
): number {
  if (progress.finalAuthorizedApproval) return 0;
  if (computeTrainingProgressPct(progress) >= 100) return 0;
  if (!progress.updatedAt) return 0;
  const updatedMs = Date.parse(progress.updatedAt);
  if (!Number.isFinite(updatedMs)) return 0;
  const diffMs = now.getTime() - updatedMs;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function isTrainingProgressStalled(
  progress: Pick<MemberTrainingProgress, 'updatedAt' | 'finalAuthorizedApproval' | 'completedRequirements' | 'totalRequirements'>,
  now: Date = new Date(),
  thresholdDays: number = TRAINING_STALLED_DAYS_THRESHOLD
): boolean {
  return getTrainingStagnationDays(progress, now) >= thresholdDays;
}

export function getMembersWithoutTraining(
  members: Member[],
  trainingProgress: MemberTrainingProgress[],
  users: UserAccount[]
): Member[] {
  const enrolledMemberIds = new Set(trainingProgress.map((tp) => tp.memberId));
  return members.filter(
    (m) =>
      m.status === 'ativo' &&
      !isDirectionMember(m, users) &&
      !enrolledMemberIds.has(m.id)
  );
}

export function resolveCatalogRequirementsForProgress(
  progress: Pick<MemberTrainingProgress, 'type' | 'targetId' | 'targetTitle' | 'totalRequirements'>,
  classes: TrainingClass[],
  specialties: SpecialtyHonor[]
): string[] {
  if (progress.type === 'classe') {
    const cls = classes.find(
      (c) =>
        c.id === progress.targetId ||
        c.code === progress.targetId ||
        c.title.toLowerCase() === progress.targetTitle.toLowerCase()
    );
    if (cls?.requirements && cls.requirements.length > 0) {
      return cls.requirements;
    }
    const count = cls?.requirementsCount || progress.totalRequirements || 1;
    return Array.from({ length: count }, (_, idx) => `Requisito Oficial #${idx + 1}`);
  }

  const spec = specialties.find(
    (s) =>
      s.id === progress.targetId ||
      s.code === progress.targetId ||
      s.title.toLowerCase() === progress.targetTitle.toLowerCase()
  );
  if (spec?.requirements && spec.requirements.length > 0) {
    return spec.requirements;
  }
  const count = spec?.requirementsCount || progress.totalRequirements || 1;
  return Array.from({ length: count }, (_, idx) => `Requisito Oficial #${idx + 1}`);
}

export function buildCatalogProgressSummaries(
  classes: TrainingClass[],
  specialties: SpecialtyHonor[],
  trainingProgress: MemberTrainingProgress[],
  activeMembers: Member[],
  now: Date = new Date()
): CatalogTrainingSummary[] {
  const activeIds = new Set(activeMembers.map((m) => m.id));
  const activeProgress = trainingProgress.filter((tp) => activeIds.has(tp.memberId));

  const summarize = (
    item: {
      id: string;
      code: string;
      type: 'classe' | 'especialidade';
      title: string;
      category?: SpecialtyHonor['category'];
      requirementsCount: number;
    }
  ): CatalogTrainingSummary => {
    const matching = activeProgress.filter(
      (tp) =>
        tp.type === item.type &&
        (tp.targetId === item.id ||
          tp.targetId === item.code ||
          tp.targetTitle.trim().toLowerCase() === item.title.trim().toLowerCase())
    );

    const enrolledCount = matching.length;
    const approvedCount = matching.filter((tp) => tp.finalAuthorizedApproval).length;
    const readyForValidationCount = matching.filter(
      (tp) => !tp.finalAuthorizedApproval && computeTrainingProgressPct(tp) >= 100
    ).length;
    const inProgressCount = enrolledCount - approvedCount - readyForValidationCount;
    const stalledCount = matching.filter((tp) => isTrainingProgressStalled(tp, now)).length;
    const avgPct =
      enrolledCount > 0
        ? Math.round(
            matching.reduce((sum, tp) => sum + computeTrainingProgressPct(tp), 0) / enrolledCount
          )
        : 0;
    const instructorNames = Array.from(
      new Set(matching.map((tp) => tp.instructorName).filter((n) => Boolean(n && n.trim())))
    );

    return {
      ...item,
      enrolledCount,
      inProgressCount,
      readyForValidationCount,
      approvedCount,
      stalledCount,
      avgPct,
      instructorNames,
    };
  };

  const moduleSummaries = classes
    .filter((c) => c.active !== false)
    .map((c) =>
      summarize({
        id: c.id,
        code: c.code,
        type: 'classe',
        title: c.title,
        requirementsCount: c.requirements?.length || c.requirementsCount || 0,
      })
    );

  const medalSummaries = specialties
    .filter((s) => s.active !== false)
    .map((s) =>
      summarize({
        id: s.id,
        code: s.code,
        type: 'especialidade',
        title: s.title,
        category: s.category,
        requirementsCount: s.requirements?.length || s.requirementsCount || 0,
      })
    );

  return [...moduleSummaries, ...medalSummaries];
}

export function buildInstructorWorkloadSummaries(
  users: UserAccount[],
  trainingProgress: MemberTrainingProgress[],
  activeMembers: Member[],
  now: Date = new Date()
): InstructorWorkloadSummary[] {
  const activeIds = new Set(activeMembers.map((m) => m.id));
  const activeProgress = trainingProgress.filter((tp) => activeIds.has(tp.memberId));

  const map = new Map<string, {
    instructorUserId: string;
    instructorName: string;
    role: RoleType | 'outro';
    items: MemberTrainingProgress[];
  }>();

  users
    .filter((u) => u.active && (u.role === 'instrutor' || u.role === 'diretor_associado'))
    .forEach((u) => {
      map.set(u.id, {
        instructorUserId: u.id,
        instructorName: u.name,
        role: u.role,
        items: [],
      });
    });

  activeProgress.forEach((tp) => {
    const key = tp.instructorUserId || tp.instructorName || 'sem_instrutor';
    const existing = map.get(key);
    if (existing) {
      existing.items.push(tp);
    } else {
      const matchedUser = users.find(
        (u) => u.id === tp.instructorUserId || u.name === tp.instructorName
      );
      if (matchedUser && map.has(matchedUser.id)) {
        map.get(matchedUser.id)!.items.push(tp);
      } else {
        map.set(key, {
          instructorUserId: tp.instructorUserId || key,
          instructorName: tp.instructorName || 'Instrutor Não Atribuído',
          role: matchedUser?.role || 'outro',
          items: [tp],
        });
      }
    }
  });

  return Array.from(map.values())
    .map((entry) => {
      const totalAssigned = entry.items.length;
      const modulesCount = entry.items.filter((i) => i.type === 'classe').length;
      const medalsCount = entry.items.filter((i) => i.type === 'especialidade').length;
      const approvedCount = entry.items.filter((i) => i.finalAuthorizedApproval).length;
      const readyForValidationCount = entry.items.filter(
        (i) => !i.finalAuthorizedApproval && computeTrainingProgressPct(i) >= 100
      ).length;
      const stalledCount = entry.items.filter((i) => isTrainingProgressStalled(i, now)).length;
      const avgPct =
        totalAssigned > 0
          ? Math.round(
              entry.items.reduce((sum, tp) => sum + computeTrainingProgressPct(tp), 0) / totalAssigned
            )
          : 0;

      return {
        instructorUserId: entry.instructorUserId,
        instructorName: entry.instructorName,
        role: entry.role,
        totalAssigned,
        modulesCount,
        medalsCount,
        readyForValidationCount,
        approvedCount,
        stalledCount,
        avgPct,
      };
    })
    .sort((a, b) => b.totalAssigned - a.totalAssigned || a.instructorName.localeCompare(b.instructorName));
}

export function getModuleMedalStudySessions(activities: ClubActivity[]): {
  upcoming: ClubActivity[];
  completed: ClubActivity[];
  all: ClubActivity[];
} {
  const studyActivities = (activities || [])
    .filter((act) => normalizeActivityType(act.type) === 'modulos_medalhas')
    .slice()
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  const upcoming = studyActivities.filter(
    (act) => normalizeActivityStage(act.stage) !== 'realizado'
  );
  const completed = studyActivities
    .filter((act) => normalizeActivityStage(act.stage) === 'realizado')
    .slice()
    .reverse();

  return { upcoming, completed, all: studyActivities };
}

export function applyBatchTrainingRequirementUpdate(
  progressList: MemberTrainingProgress[],
  progressIds: string[],
  requirementNumber: number,
  completed: boolean,
  nowIso: string,
  notes?: string
): { updatedList: MemberTrainingProgress[]; updatedCount: number } {
  if (!Number.isInteger(requirementNumber) || requirementNumber < 1) {
    return { updatedList: progressList, updatedCount: 0 };
  }

  const targetIdSet = new Set((progressIds || []).filter(Boolean));
  if (targetIdSet.size === 0) {
    return { updatedList: progressList, updatedCount: 0 };
  }

  const trimmedNotes = (notes || '').trim();
  let updatedCount = 0;

  const updatedList = progressList.map((prg) => {
    if (!targetIdSet.has(prg.id)) return prg;
    if (prg.totalRequirements > 0 && requirementNumber > prg.totalRequirements) return prg;
    // Registos com investidura já homologada não devem ter requisitos removidos em lote sem reabertura explícita
    if (prg.finalAuthorizedApproval && !completed) return prg;

    const currentReqs = Array.isArray(prg.completedRequirements) ? prg.completedRequirements : [];
    const alreadyHas = currentReqs.includes(requirementNumber);

    const nextReqs = completed
      ? alreadyHas
        ? currentReqs
        : [...currentReqs, requirementNumber].sort((a, b) => a - b)
      : currentReqs.filter((r) => r !== requirementNumber);

    const reqsChanged = nextReqs.length !== currentReqs.length;
    const notesChanged = Boolean(trimmedNotes) && trimmedNotes !== (prg.observations || '').trim();

    if (!reqsChanged && !notesChanged) {
      return prg;
    }

    updatedCount += 1;
    const mergedNotes = trimmedNotes
      ? prg.observations && prg.observations.trim() && !prg.observations.includes(trimmedNotes)
        ? `${prg.observations.trim()} | ${trimmedNotes}`
        : trimmedNotes
      : prg.observations;

    return {
      ...prg,
      completedRequirements: nextReqs,
      instructorValidated: nextReqs.length > 0 ? true : prg.instructorValidated,
      observations: mergedNotes,
      updatedAt: nowIso,
    };
  });

  return { updatedList, updatedCount };
}

export interface MemberAttendanceEntry {
  activityId: string;
  title: string;
  type: ClubActivity['type'];
  typeLabel: string;
  stageLabel: string;
  date: string;
  location: string;
  present: boolean;
  notes?: string;
}

export function buildMemberAttendanceHistory(
  activities: ClubActivity[],
  memberId: string
): {
  entries: MemberAttendanceEntry[];
  presentCount: number;
  absentCount: number;
  totalCount: number;
  attendancePct: number | null;
} {
  if (!memberId) {
    return { entries: [], presentCount: 0, absentCount: 0, totalCount: 0, attendancePct: null };
  }

  const entries: MemberAttendanceEntry[] = [];

  (activities || []).forEach((act) => {
    const rec = (act.attendees || []).find((att) => att.memberId === memberId);
    if (!rec) return;
    entries.push({
      activityId: act.id,
      title: act.title,
      type: act.type,
      typeLabel: getActivityTypeLabel(act.type),
      stageLabel: getActivityStageLabel(act.stage),
      date: getActivityDateOnly(act.startDate) || act.startDate,
      location: act.location || 'Clube',
      present: Boolean(rec.present),
      notes: rec.notes?.trim() || undefined,
    });
  });

  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const presentCount = entries.filter((e) => e.present).length;
  const totalCount = entries.length;
  const absentCount = totalCount - presentCount;
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : null;

  return {
    entries,
    presentCount,
    absentCount,
    totalCount,
    attendancePct,
  };
}

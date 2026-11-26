import {
  AssociateDirective,
  ClubActivity,
  ClubSettings,
  Member,
  MemberCategory,
  MemberTrainingProgress,
  Message,
  RoleType,
  TeamEvaluation,
  UserAccount,
  TeamTask,
  TeamNote,
  TeamAward,
} from '../types';
import { isDirectionRole } from '../services/accountSyncService';
import { calculateTeamAttendanceStats } from './activityUtils';
import { computeTrainingProgressPct } from './associateTrainingUtils';

export type ClubUnit = ClubSettings['units'][number];

export interface SanitizedTeammate {
  id: string;
  fullName: string;
  manualNumber: string;
  category: MemberCategory;
  isLeader: boolean;
  photoUrl?: string;
}

export interface TeamOverviewData {
  unit: ClubUnit;
  leaderName: string;
  leaderRoleLabel?: string;
  teammates: SanitizedTeammate[];
  attendanceStats: {
    recordedActivitiesCount: number;
    totalSlots: number;
    totalPresent: number;
    participationPct: number;
  };
  trainingStats: {
    totalEnrollments: number;
    completedCount: number;
    inProgressCount: number;
    avgProgressPct: number;
  };
  evaluations: TeamEvaluation[];
  latestOverallScore: number | null;
  averageOverallScore: number | null;
  rankingPosition: number | null;
  totalRankedTeams: number;
  directives: AssociateDirective[];
  unitMessages: Message[];
  teamTasks: TeamTask[];
  teamNotes: TeamNote[];
  teamAwards: TeamAward[];
}

export const TEAM_CATEGORY_LABELS: Record<MemberCategory | 'mista', string> = {
  embaixador: 'Embaixadores',
  lider: 'Líderes',
  aspirante: 'Aspirantes',
  mista: 'Equipa Mista',
};

const normalizeTeamText = (value?: string | null): string =>
  (value || '').trim().toLowerCase();

/**
 * Membros da Direção (Diretor, Secretário e Diretor-associado) mais o Administrador Técnico
 * podem visualizar todos os chats de todas as equipas para monitorização e moderação.
 */
export function isDirectionChatMonitor(role?: RoleType | null): boolean {
  return Boolean(role && (isDirectionRole(role) || role === 'admin_tecnico'));
}

/**
 * Verifica se o utilizador foi atribuído como Líder da Equipa (pela Secretaria ou Diretor-associado).
 */
export function isAssignedTeamLeader(
  unit: Pick<ClubUnit, 'leaderUserId'>,
  user: Pick<UserAccount, 'id'> | null | undefined
): boolean {
  if (!user || !unit.leaderUserId) return false;
  return unit.leaderUserId.trim() === user.id.trim();
}

/**
 * Verifica se a ficha de membro pertence à equipa/unidade indicada.
 */
export function doesMemberBelongToUnit(
  member: Pick<Member, 'unitOrTeam' | 'status'> | null | undefined,
  unit: Pick<ClubUnit, 'id' | 'name'>
): boolean {
  if (!member || member.status !== 'ativo') return false;
  const memberTeam = normalizeTeamText(member.unitOrTeam);
  if (!memberTeam) return false;
  return (
    memberTeam === normalizeTeamText(unit.name) ||
    memberTeam === normalizeTeamText(unit.id)
  );
}

/**
 * Lista todas as equipas ativas acessíveis ao utilizador no módulo "Minha Equipa":
 * - Diretor, Secretário, Diretor-associado (e Admin Técnico): visualizam TODAS as equipas ativas para monitorização.
 * - Membros e Líderes de Equipa: visualizam apenas a(s) equipa(s) à(s) qual(is) pertencem ou que lideram.
 */
export function getAccessibleTeamsForUser(
  units: ClubUnit[],
  linkedMember: Pick<Member, 'unitOrTeam' | 'status'> | null | undefined,
  user: Pick<UserAccount, 'id' | 'role'> | null | undefined
): ClubUnit[] {
  const activeUnits = (units || []).filter((u) => u && u.active !== false);
  if (!user) return [];

  if (isDirectionChatMonitor(user.role)) {
    return activeUnits;
  }

  return activeUnits.filter(
    (unit) =>
      isAssignedTeamLeader(unit, user) ||
      doesMemberBelongToUnit(linkedMember, unit)
  );
}

/**
 * Verifica se o utilizador pode visualizar o chat de determinada equipa.
 */
export function canViewTeamChat(
  unit: Pick<ClubUnit, 'id' | 'name' | 'leaderUserId' | 'active'>,
  linkedMember: Pick<Member, 'unitOrTeam' | 'status'> | null | undefined,
  user: Pick<UserAccount, 'id' | 'role'> | null | undefined
): boolean {
  if (!user || unit.active === false) return false;
  if (isDirectionChatMonitor(user.role)) return true;
  if (isAssignedTeamLeader(unit, user)) return true;
  return doesMemberBelongToUnit(linkedMember, unit);
}

/**
 * Verifica estritamente quem pode enviar mensagens no chat interno da equipa:
 * APENAS membros ativos dessa equipa (não-Direção) OU o Líder da Equipa atribuído (leaderUserId).
 * Diretor, Secretário e Diretor-associado sem vínculo de liderança/membro na equipa visualizam em modo monitorização.
 */
export function canPostInTeamChat(
  unit: Pick<ClubUnit, 'id' | 'name' | 'leaderUserId' | 'active'>,
  linkedMember: Pick<Member, 'unitOrTeam' | 'status'> | null | undefined,
  user: Pick<UserAccount, 'id' | 'role'> | null | undefined
): boolean {
  if (!user || unit.active === false) return false;
  if (isDirectionChatMonitor(user.role)) return true;
  if (isAssignedTeamLeader(unit, user)) return true;
  return doesMemberBelongToUnit(linkedMember, unit);
}

/**
 * Verifica quem pode excluir mensagens do chat para todos:
 * - Diretor, Secretário e Diretor-associado (e Admin Técnico) em qualquer equipa;
 * - O Líder da Equipa atribuído pela Secretaria ou pelo módulo do Diretor-associado nessa respetiva equipa.
 */
export function canDeleteTeamChatMessage(
  unit: Pick<ClubUnit, 'leaderUserId'> | null | undefined,
  user: Pick<UserAccount, 'id' | 'role'> | null | undefined
): boolean {
  if (!user) return false;
  if (isDirectionChatMonitor(user.role)) return true;
  if (!unit) return false;
  return isAssignedTeamLeader(unit, user);
}

/**
 * Constrói o painel consolidado e com proteção de privacidade da equipa selecionada.
 * Nunca expõe B.I., telefone, endereço, dados médicos ou dívidas de quotas dos colegas.
 */
export function buildTeamOverviewData(params: {
  unit: ClubUnit;
  allUnits: ClubUnit[];
  members: Member[];
  users: UserAccount[];
  activities: ClubActivity[];
  trainingProgress: MemberTrainingProgress[];
  teamEvaluations: TeamEvaluation[];
  associateDirectives: AssociateDirective[];
  messages: Message[];
  teamTasks?: TeamTask[];
  teamNotes?: TeamNote[];
  teamAwards?: TeamAward[];
}): TeamOverviewData {
  const {
    unit,
    allUnits,
    members,
    users,
    activities,
    trainingProgress,
    teamEvaluations,
    associateDirectives,
    messages,
  } = params;

  const activeUnits = (allUnits || []).filter((u) => u && u.active !== false);
  const activeMembers = (members || []).filter((m) => m && m.status === 'ativo');

  const leaderUser = unit.leaderUserId
    ? users.find((u) => u.id === unit.leaderUserId)
    : undefined;
  const leaderLinkedMemberId = leaderUser?.linkedMemberId;

  const teamMembers = activeMembers.filter((m) => doesMemberBelongToUnit(m, unit));
  const teamMemberIds = new Set(teamMembers.map((m) => m.id));

  const teammates: SanitizedTeammate[] = teamMembers
    .map((m) => {
      const isLeader = Boolean(
        leaderLinkedMemberId &&
          (m.id === leaderLinkedMemberId || m.manualNumber === leaderLinkedMemberId)
      );
      return {
        id: m.id,
        fullName: m.fullName,
        manualNumber: m.manualNumber,
        category: m.category,
        isLeader,
        photoUrl: m.photoUrl,
      };
    })
    .sort((a, b) => {
      if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'pt-AO');
    });

  const attendanceStats = calculateTeamAttendanceStats(teamMemberIds, activities || []);

  const teamTraining = (trainingProgress || []).filter((tp) => teamMemberIds.has(tp.memberId));
  const completedCount = teamTraining.filter(
    (tp) => tp.finalAuthorizedApproval || computeTrainingProgressPct(tp) >= 100
  ).length;
  const inProgressCount = teamTraining.length - completedCount;
  const avgProgressPct =
    teamTraining.length > 0
      ? Math.round(teamTraining.reduce((acc, tp) => acc + computeTrainingProgressPct(tp), 0) / teamTraining.length)
      : 0;

  const unitEvals = (teamEvaluations || [])
    .filter(
      (ev) =>
        ev.unitId === unit.id ||
        normalizeTeamText(ev.unitName) === normalizeTeamText(unit.name)
    )
    .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt));

  const latestOverallScore = unitEvals.length > 0 ? unitEvals[0].overallScore : null;
  const averageOverallScore =
    unitEvals.length > 0
      ? Math.round(unitEvals.reduce((acc, ev) => acc + ev.overallScore, 0) / unitEvals.length)
      : null;

  // Ranking geral entre todas as equipas ativas (média de avaliação + assiduidade como critério combinado/desempate)
  const rankingList = activeUnits
    .map((u) => {
      const uMembers = activeMembers.filter((m) => doesMemberBelongToUnit(m, u));
      const uIds = new Set(uMembers.map((m) => m.id));
      const uAtt = calculateTeamAttendanceStats(uIds, activities || []);
      const uEvals = (teamEvaluations || []).filter(
        (ev) => ev.unitId === u.id || normalizeTeamText(ev.unitName) === normalizeTeamText(u.name)
      );
      const uEvalAvg =
        uEvals.length > 0
          ? uEvals.reduce((acc, ev) => acc + ev.overallScore, 0) / uEvals.length
          : 0;
      const uTrain = (trainingProgress || []).filter((tp) => uIds.has(tp.memberId));
      const uTrainAvg =
        uTrain.length > 0
          ? uTrain.reduce((acc, tp) => acc + computeTrainingProgressPct(tp), 0) / uTrain.length
          : 0;
      const compositeScore =
        uEvals.length > 0
          ? uEvalAvg * 0.6 + uAtt.participationPct * 0.25 + uTrainAvg * 0.15
          : uAtt.participationPct * 0.6 + uTrainAvg * 0.4;
      return {
        unitId: u.id,
        compositeScore,
        hasSignal: uEvals.length > 0 || uAtt.recordedActivitiesCount > 0 || uTrain.length > 0,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const rankIdx = rankingList.findIndex((item) => item.unitId === unit.id);
  const rankingPosition = rankIdx >= 0 ? rankIdx + 1 : null;

  const directives = (associateDirectives || [])
    .filter(
      (d) =>
        normalizeTeamText(d.targetUnitName) === normalizeTeamText(unit.name) ||
        normalizeTeamText(d.targetUnitName) === 'todas'
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const unitMessages = (messages || [])
    .filter(
      (msg) =>
        msg.recipientType === 'unit' &&
        (normalizeTeamText(msg.recipientId) === normalizeTeamText(unit.name) ||
          normalizeTeamText(msg.recipientId) === normalizeTeamText(unit.id))
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const teamTasks = (params.teamTasks || [])
    .filter((t) => t.unitId === unit.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const teamNotes = (params.teamNotes || [])
    .filter((n) => n.unitId === unit.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const teamAwards = (params.teamAwards || [])
    .filter((a) => a.unitId === unit.id)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  return {
    unit,
    leaderName: leaderUser?.name || 'Sem líder atribuído',
    teammates,
    attendanceStats,
    trainingStats: {
      totalEnrollments: teamTraining.length,
      completedCount,
      inProgressCount,
      avgProgressPct,
    },
    evaluations: unitEvals,
    latestOverallScore,
    averageOverallScore,
    rankingPosition,
    totalRankedTeams: activeUnits.length,
    directives,
    unitMessages,
    teamTasks,
    teamNotes,
    teamAwards,
  };
}

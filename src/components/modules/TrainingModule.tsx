import React, { useState } from 'react';
import {
  GraduationCap,
  Award,
  CheckCircle,
  Clock,
  Plus,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  Edit2,
  Save,
  Settings,
  Trash2,
  ListChecks,
  AlertCircle,
  PlusCircle,
  Check,
  Sparkles,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { MemberTrainingProgress, TrainingClass, SpecialtyHonor } from '../../types';
import { formatDateAO } from '../../utils/date';
import { Modal } from '../common/Modal';



const CATEGORY_LABELS: Record<SpecialtyHonor['category'], { label: string; color: string }> = {
  natureza: { label: 'Natureza', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  habilidades: { label: 'Habilidades', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  saude: { label: 'Saúde', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  artes: { label: 'Artes', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  espiritual: { label: 'Espiritual', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  adra: { label: 'ADRA / Comunitária', color: 'bg-teal-100 text-teal-800 border-teal-200' },
};

export const TrainingModule: React.FC = () => {
  const {
    state,
    can,
    currentUser,
    updateTrainingProgress,
    createTrainingProgress,
    approveFinalTraining,
    revokeTrainingApproval,
    deleteTrainingProgress,
    createTrainingClass,
    updateTrainingClass,
    deleteTrainingClass,
    createSpecialtyHonor,
    updateSpecialtyHonor,
    deleteSpecialtyHonor,
  } = useClub();

  // Diretor e Instrutor (e Administrador) podem criar e gerir o catálogo de formação
  const canManageTrainingCatalog =
    can('training', 'EDIT') ||
    can('training', 'ADMIN') ||
    currentUser.role === 'diretor' ||
    currentUser.role === 'admin_tecnico' ||
    currentUser.role === 'instrutor';

  // Diretor, Instrutor e Administrador podem homologar investiduras
  const canApproveInvestiture =
    can('training', 'APPROVE') ||
    currentUser.role === 'diretor' ||
    currentUser.role === 'admin_tecnico' ||
    currentUser.role === 'instrutor';

  const [activeTab, setActiveTab] = useState<'classes' | 'specialties' | 'manage_catalog'>('classes');
  const [selectedProgressId, setSelectedProgressId] = useState<string>('');
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  // Notificação / Feedback de ações
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // --- MODAL: CRIAR NOVA CLASSE ---
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState(false);
  const [newClassForm, setNewClassForm] = useState({
    title: '',
    minimumAge: 10,
    requirements: [] as string[],
    newReqInput: '',
  });

  // --- MODAL: EDITAR CLASSE ---
  const [editingClass, setEditingClass] = useState<TrainingClass | null>(null);
  const [classTitleInput, setClassTitleInput] = useState('');
  const [classMinAgeInput, setClassMinAgeInput] = useState<number>(10);
  const [classRequirementsInput, setClassRequirementsInput] = useState<string[]>([]);
  const [classNewReqInput, setClassNewReqInput] = useState('');

  // --- MODAL: CRIAR NOVA ESPECIALIDADE ---
  const [isNewSpecialtyModalOpen, setIsNewSpecialtyModalOpen] = useState(false);
  const [newSpecialtyForm, setNewSpecialtyForm] = useState({
    title: '',
    category: 'natureza' as SpecialtyHonor['category'],
    requirements: [] as string[],
    newReqInput: '',
  });

  // --- MODAL: EDITAR ESPECIALIDADE ---
  const [editingSpecialty, setEditingSpecialty] = useState<SpecialtyHonor | null>(null);
  const [specialtyTitleInput, setSpecialtyTitleInput] = useState('');
  const [specialtyCategoryInput, setSpecialtyCategoryInput] = useState<SpecialtyHonor['category']>('natureza');
  const [specialtyRequirementsInput, setSpecialtyRequirementsInput] = useState<string[]>([]);
  const [specialtyNewReqInput, setSpecialtyNewReqInput] = useState('');

  // Inscrição em Nova Classe / Especialidade
  const [enrollForm, setEnrollForm] = useState({
    memberId: state.members[0]?.id || '',
    type: 'classe' as 'classe' | 'especialidade',
    targetId: state.classes[0]?.id || '',
  });

  const handleRequirementToggle = (progressId: string, reqIndex: number) => {
    if (
      !can('training', 'EDIT') &&
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'instrutor' &&
      currentUser.role !== 'admin_tecnico'
    ) {
      return;
    }

    const targetProgress = state.trainingProgress.find((p) => p.id === progressId);
    if (!targetProgress) return;

    const exists = targetProgress.completedRequirements.includes(reqIndex);
    const updated = exists
      ? targetProgress.completedRequirements.filter((r) => r !== reqIndex)
      : [...targetProgress.completedRequirements, reqIndex].sort((a, b) => a - b);

    updateTrainingProgress(progressId, updated);
  };

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const member = state.members.find((m) => m.id === enrollForm.memberId);
    if (!member) return;

    let targetTitle = '';
    let totalReqs = 6;

    if (enrollForm.type === 'classe') {
      const cls = state.classes.find((c) => c.id === enrollForm.targetId);
      targetTitle = cls ? cls.title : 'Classe Oficial';
      totalReqs = cls ? (cls.requirements?.length || cls.requirementsCount) : 8;
    } else {
      const esp = state.specialties.find((s) => s.id === enrollForm.targetId);
      targetTitle = esp ? esp.title : 'Especialidade';
      totalReqs = esp ? (esp.requirements?.length || esp.requirementsCount) : 6;
    }

    const res = createTrainingProgress(
      enrollForm.memberId,
      enrollForm.type,
      enrollForm.targetId,
      targetTitle,
      totalReqs
    );

    if (res.success) {
      setIsEnrollModalOpen(false);
      showFeedback('success', `Membro ${member.fullName} inscrito com sucesso em ${targetTitle}.`);
    } else {
      showFeedback('error', res.error || 'Erro ao inscrever membro.');
    }
  };

  // Handlers para Criação e Edição de Classes
  const openNewClassModal = () => {
    setNewClassForm({
      title: '',
      minimumAge: 10,
      requirements: [],
      newReqInput: '',
    });
    setIsNewClassModalOpen(true);
  };

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassForm.title.trim()) {
      showFeedback('error', 'O título da classe é obrigatório.');
      return;
    }
    const cleanReqs = newClassForm.requirements.map((r) => r.trim()).filter(Boolean);
    if (cleanReqs.length === 0) {
      showFeedback('error', 'A classe deve conter pelo menos 1 requisito de conclusão.');
      return;
    }

    const res = createTrainingClass({
      title: newClassForm.title.trim(),
      minimumAge: Number(newClassForm.minimumAge) || 10,
      requirements: cleanReqs,
    });

    if (res.success) {
      setIsNewClassModalOpen(false);
      showFeedback('success', `Nova classe "${newClassForm.title.trim()}" criada com ${cleanReqs.length} requisitos de conclusão!`);
    } else {
      showFeedback('error', res.error || 'Erro ao criar classe.');
    }
  };

  const openEditClassModal = (cls: TrainingClass) => {
    setEditingClass(cls);
    setClassTitleInput(cls.title || '');
    setClassMinAgeInput(cls.minimumAge || 10);
    const count = (cls.requirements && cls.requirements.length > 0) ? cls.requirements.length : (cls.requirementsCount || 8);
    const existingReqs = cls.requirements && cls.requirements.length > 0
      ? [...cls.requirements]
      : Array.from({ length: count }).map((_, i) => `Requisito Oficial #${i + 1}: Demonstração prática e teórica`);
    setClassRequirementsInput(existingReqs);
    setClassNewReqInput('');
  };

  const handleUpdateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    if (!classTitleInput.trim()) {
      showFeedback('error', 'O título da classe é obrigatório.');
      return;
    }
    const cleanReqs = classRequirementsInput.map((r) => r.trim()).filter(Boolean);
    if (cleanReqs.length === 0) {
      showFeedback('error', 'A classe deve possuir pelo menos 1 requisito de conclusão.');
      return;
    }

    const res = updateTrainingClass(editingClass.id, {
      title: classTitleInput.trim(),
      minimumAge: Number(classMinAgeInput) || 10,
      requirements: cleanReqs,
    });

    if (res.success) {
      setEditingClass(null);
      showFeedback('success', `Classe "${classTitleInput.trim()}" e respetivos requisitos atualizados com sucesso!`);
    } else {
      showFeedback('error', res.error || 'Erro ao atualizar classe.');
    }
  };

  // Modal de confirmação segura de eliminação (sem depender de window.confirm em iframe)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'classe' | 'especialidade';
    id: string;
    title: string;
  } | null>(null);

  const confirmDeleteAction = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'classe') {
      const res = deleteTrainingClass(deleteTarget.id);
      if (res.success) {
        showFeedback('success', `Classe "${deleteTarget.title}" eliminada com sucesso.`);
      } else {
        showFeedback('error', res.error || 'Erro ao remover classe.');
      }
    } else {
      const res = deleteSpecialtyHonor(deleteTarget.id);
      if (res.success) {
        showFeedback('success', `Especialidade "${deleteTarget.title}" eliminada com sucesso.`);
      } else {
        showFeedback('error', res.error || 'Erro ao remover especialidade.');
      }
    }
    setDeleteTarget(null);
  };

  const handleDeleteClass = (id: string, title: string) => {
    setDeleteTarget({ type: 'classe', id, title });
  };

  // Handlers para Criação e Edição de Especialidades
  const openNewSpecialtyModal = () => {
    setNewSpecialtyForm({
      title: '',
      category: 'natureza',
      requirements: [],
      newReqInput: '',
    });
    setIsNewSpecialtyModalOpen(true);
  };

  const handleCreateSpecialty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecialtyForm.title.trim()) {
      showFeedback('error', 'O título da especialidade é obrigatório.');
      return;
    }
    const cleanReqs = newSpecialtyForm.requirements.map((r) => r.trim()).filter(Boolean);
    if (cleanReqs.length === 0) {
      showFeedback('error', 'A especialidade deve conter pelo menos 1 requisito de conclusão.');
      return;
    }

    const res = createSpecialtyHonor({
      title: newSpecialtyForm.title.trim(),
      category: newSpecialtyForm.category,
      requirements: cleanReqs,
    });

    if (res.success) {
      setIsNewSpecialtyModalOpen(false);
      showFeedback('success', `Nova especialidade "${newSpecialtyForm.title.trim()}" criada com ${cleanReqs.length} requisitos de conclusão!`);
    } else {
      showFeedback('error', res.error || 'Erro ao criar especialidade.');
    }
  };

  const openEditSpecialtyModal = (esp: SpecialtyHonor) => {
    setEditingSpecialty(esp);
    setSpecialtyTitleInput(esp.title || '');
    setSpecialtyCategoryInput(esp.category || 'habilidades');
    const count = (esp.requirements && esp.requirements.length > 0) ? esp.requirements.length : (esp.requirementsCount || 6);
    const existingReqs = esp.requirements && esp.requirements.length > 0
      ? [...esp.requirements]
      : Array.from({ length: count }).map((_, i) => `Requisito da Especialidade #${i + 1}: Demonstração prática`);
    setSpecialtyRequirementsInput(existingReqs);
    setSpecialtyNewReqInput('');
  };

  const handleUpdateSpecialty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpecialty) return;
    if (!specialtyTitleInput.trim()) {
      showFeedback('error', 'O título da especialidade é obrigatório.');
      return;
    }
    const cleanReqs = specialtyRequirementsInput.map((r) => r.trim()).filter(Boolean);
    if (cleanReqs.length === 0) {
      showFeedback('error', 'A especialidade deve possuir pelo menos 1 requisito de conclusão.');
      return;
    }

    const res = updateSpecialtyHonor(editingSpecialty.id, {
      title: specialtyTitleInput.trim(),
      category: specialtyCategoryInput,
      requirements: cleanReqs,
    });

    if (res.success) {
      setEditingSpecialty(null);
      showFeedback('success', `Especialidade "${specialtyTitleInput.trim()}" e respetivos requisitos atualizados com sucesso!`);
    } else {
      showFeedback('error', res.error || 'Erro ao atualizar especialidade.');
    }
  };

  const handleDeleteSpecialty = (id: string, title: string) => {
    setDeleteTarget({ type: 'especialidade', id, title });
  };

  const activeList = state.trainingProgress.filter(
    (p) => p.type === (activeTab === 'classes' ? 'classe' : 'especialidade')
  );
  const currentItem = activeList.find((p) => p.id === selectedProgressId) || activeList[0] || null;

  return (
    <div className="space-y-6">
      {/* Notificação Toast/Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 ml-4 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-900" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Classes e Especialidades
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão curricular por Diretores e Instrutores, verificação de cadernetas e validação oficial de investiduras.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManageTrainingCatalog && (
            <>
              <button
                onClick={openNewClassModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-colors"
                title="Criar nova classe oficial com requisitos de conclusão"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Classe</span>
              </button>

              <button
                onClick={openNewSpecialtyModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors"
                title="Criar nova especialidade com requisitos de conclusão"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Especialidade</span>
              </button>
            </>
          )}

          {can('training', 'CREATE') && (
            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Inscrever Membro</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('classes');
            setSelectedProgressId('');
          }}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
            activeTab === 'classes'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Classes Oficiais ({state.classes.length})</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('specialties');
            setSelectedProgressId('');
          }}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
            activeTab === 'specialties'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Especialidades ({state.specialties.length})</span>
        </button>
        {canManageTrainingCatalog && (
          <button
            onClick={() => {
              setActiveTab('manage_catalog');
              setSelectedProgressId('');
            }}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 ${
              activeTab === 'manage_catalog'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Gerir Nomes, Classes, Especialidades e Requisitos</span>
          </button>
        )}
      </div>

      {/* Conteúdo da Aba de Gestão de Catálogo */}
      {activeTab === 'manage_catalog' && canManageTrainingCatalog ? (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold block text-sm">Painel Curricular do Diretor e Instrutor</span>
              <p className="text-slate-600 mt-0.5">
                Diretores e Instrutores possuem permissão total para criar e editar novas classes e especialidades, personalizando inclusive a lista completa de requisitos de conclusão obrigatórios.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openNewClassModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Criar Nova Classe</span>
              </button>
              <button
                onClick={openNewSpecialtyModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Criar Nova Especialidade</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Secção de Classes Oficiais */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-900" />
                  <span>Classes Oficiais e Requisitos ({state.classes.length})</span>
                </h2>
                <button
                  onClick={openNewClassModal}
                  className="text-xs font-bold text-blue-900 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nova Classe</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {state.classes.map((cls) => {
                  const reqCount = cls.requirements?.length || cls.requirementsCount;
                  return (
                    <div
                      key={cls.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/70 transition-colors rounded-lg border border-slate-200 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">{cls.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>Idade mín: <strong>{cls.minimumAge} anos</strong></span>
                            <span>·</span>
                            <span className="text-blue-900 font-semibold flex items-center gap-1">
                              <ListChecks className="w-3 h-3" />
                              {reqCount} requisitos de conclusão
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openEditClassModal(cls)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-white border border-blue-200 hover:bg-blue-50 rounded shadow-xs"
                            title="Editar classe e lista de requisitos de conclusão"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls.id, cls.title)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded shadow-xs transition-colors"
                            title="Remover classe"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>

                      {/* Pré-visualização resumida dos requisitos */}
                      {cls.requirements && cls.requirements.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700 block mb-1">
                            Requisitos ({cls.requirements.length}):
                          </span>
                          <ol className="list-decimal list-inside space-y-0.5 pl-1 text-[10px] text-slate-500">
                            {cls.requirements.slice(0, 3).map((r, i) => (
                              <li key={i} className="truncate">
                                {r}
                              </li>
                            ))}
                            {cls.requirements.length > 3 && (
                              <li className="list-none text-[10px] text-blue-800 font-semibold">
                                + {cls.requirements.length - 3} outros requisitos...
                              </li>
                            )}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Secção de Especialidades */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-800" />
                  <span>Especialidades e Requisitos ({state.specialties.length})</span>
                </h2>
                <button
                  onClick={openNewSpecialtyModal}
                  className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nova Especialidade</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {state.specialties.map((esp) => {
                  const reqCount = esp.requirements?.length || esp.requirementsCount;
                  const catBadge = CATEGORY_LABELS[esp.category] || { label: esp.category, color: 'bg-slate-100 text-slate-700' };
                  return (
                    <div
                      key={esp.id}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100/70 transition-colors rounded-lg border border-slate-200 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">{esp.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${catBadge.color}`}>
                              {catBadge.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-emerald-900 font-semibold flex items-center gap-1">
                              <ListChecks className="w-3 h-3" />
                              {reqCount} requisitos de conclusão
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openEditSpecialtyModal(esp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-white border border-emerald-200 hover:bg-emerald-50 rounded shadow-xs"
                            title="Editar especialidade e lista de requisitos de conclusão"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSpecialty(esp.id, esp.title)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded shadow-xs transition-colors"
                            title="Remover especialidade"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>

                      {/* Pré-visualização resumida dos requisitos */}
                      {esp.requirements && esp.requirements.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700 block mb-1">
                            Requisitos ({esp.requirements.length}):
                          </span>
                          <ol className="list-decimal list-inside space-y-0.5 pl-1 text-[10px] text-slate-500">
                            {esp.requirements.slice(0, 3).map((r, i) => (
                              <li key={i} className="truncate">
                                {r}
                              </li>
                            ))}
                            {esp.requirements.length > 3 && (
                              <li className="list-none text-[10px] text-emerald-800 font-semibold">
                                + {esp.requirements.length - 3} outros requisitos...
                              </li>
                            )}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab !== 'manage_catalog' ? (
        /* Grid Principal de Progresso */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Lista de Membros e Progresso */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden h-fit">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Registos de Formação ({activeList.length})
              </h3>
              {canManageTrainingCatalog && (
                <button
                  onClick={() => setActiveTab('manage_catalog')}
                  className="text-[11px] font-semibold text-blue-900 hover:underline flex items-center gap-1"
                  title="Configurar nomes e requisitos"
                >
                  <Settings className="w-3 h-3" />
                  <span>Gerir Catálogo</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {activeList.map((item) => {
                const member = state.members.find((m) => m.id === item.memberId);
                const pct = Math.round((item.completedRequirements.length / item.totalRequirements) * 100);

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedProgressId(item.id)}
                    className={`w-full text-left p-4 transition-colors flex items-start justify-between ${
                      currentItem?.id === item.id
                        ? 'bg-blue-50/70 border-l-4 border-blue-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {member?.fullName || item.memberId}
                      </h4>
                      <p className="text-[11px] text-blue-900 font-semibold mt-0.5">
                        {item.targetTitle}
                      </p>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>{pct}% concluído</span>
                        <span>·</span>
                        <span
                          className={
                            item.finalAuthorizedApproval
                              ? 'text-emerald-700 font-bold'
                              : 'text-amber-700 font-medium'
                          }
                        >
                          {item.finalAuthorizedApproval ? 'Investidura Aprovada' : 'Em Curso'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                  </button>
                );
              })}

              {activeList.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  Nenhum membro inscrito nesta categoria ainda.
                </div>
              )}
            </div>
          </div>

          {/* Coluna da Direita: Caderneta de Requisitos */}
          {currentItem ? (
            <div className="lg:col-span-2 space-y-4">
              {(() => {
                const member = state.members.find((m) => m.id === currentItem.memberId);
                const classObj = currentItem.type === 'classe'
                  ? (state.classes.find((c) => c.id === currentItem.targetId || c.code === currentItem.targetId || c.title?.toLowerCase() === currentItem.targetTitle?.toLowerCase()) || null)
                  : null;
                const specObj = currentItem.type === 'especialidade'
                  ? (state.specialties.find((s) => s.id === currentItem.targetId || s.code === currentItem.targetId || s.title?.toLowerCase() === currentItem.targetTitle?.toLowerCase()) || null)
                  : null;
                const targetRequirements = (currentItem.type === 'classe' ? classObj?.requirements : specObj?.requirements) || [];
                const totalReqs = Math.max(currentItem.totalRequirements, targetRequirements.length || 0);
                const pct = Math.round((currentItem.completedRequirements.length / totalReqs) * 100);

                return (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-blue-900 tracking-wider">
                          Caderneta Oficial de Formação
                        </span>
                        <h2 className="text-lg font-black text-slate-900 mt-0.5">
                          {member?.fullName} ({currentItem.targetTitle})
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Instrutor Responsável: {currentItem.instructorName || 'Instrução do Clube'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-2xl font-black text-blue-900">{pct}%</div>
                          <div className="text-[10px] text-slate-500">
                            {currentItem.completedRequirements.length} de {totalReqs} requisitos
                          </div>
                        </div>

                        {(currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico' || can('training', 'APPROVE')) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Tem a certeza que deseja retirar / desmatricular ${member?.fullName || 'o membro'} de ${currentItem.targetTitle}?`)) {
                                const res = deleteTrainingProgress(currentItem.id);
                                if (res.success) {
                                  setSelectedProgressId('');
                                  showFeedback('success', 'Membro desmatriculado da formação com sucesso.');
                                } else {
                                  showFeedback('error', res.error || 'Erro ao desmatricular membro.');
                                }
                              }
                            }}
                            className="p-2 text-rose-600 hover:text-white hover:bg-rose-700 bg-rose-50 border border-rose-200 rounded-lg transition-colors ml-2"
                            title="Desmatricular / Retirar membro da Classe ou Especialidade (Apenas Diretor)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de Progresso Visual */}
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-900 h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Checklist de Requisitos Curriculares Personalizados */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Grelha de Requisitos de Conclusão Obrigatórios
                        </h3>
                        {canManageTrainingCatalog && (
                          <button
                            type="button"
                            onClick={() => {
                              if (currentItem.type === 'classe') {
                                const targetCls: TrainingClass = classObj || state.classes.find(c => c.id === currentItem.targetId || c.title?.toLowerCase() === currentItem.targetTitle?.toLowerCase()) || {
                                  id: currentItem.targetId || `CLS-${Date.now()}`,
                                  title: currentItem.targetTitle || 'Classe Oficial',
                                  code: currentItem.targetId || 'CLS',
                                  minimumAge: 10,
                                  requirementsCount: currentItem.totalRequirements || 8,
                                  requirements: Array.from({ length: currentItem.totalRequirements || 8 }, (_, i) => `Requisito Oficial #${i + 1}: Demonstração prática e curricular`),
                                  active: true,
                                };
                                openEditClassModal(targetCls);
                              } else {
                                const targetSpec: SpecialtyHonor = specObj || state.specialties.find(s => s.id === currentItem.targetId || s.title?.toLowerCase() === currentItem.targetTitle?.toLowerCase()) || {
                                  id: currentItem.targetId || `ESP-${Date.now()}`,
                                  title: currentItem.targetTitle || 'Especialidade Oficial',
                                  code: currentItem.targetId || 'ESP',
                                  category: 'natureza' as SpecialtyHonor['category'],
                                  requirementsCount: currentItem.totalRequirements || 6,
                                  requirements: Array.from({ length: currentItem.totalRequirements || 6 }, (_, i) => `Requisito da Especialidade #${i + 1}: Demonstração prática e teórica`),
                                  active: true,
                                };
                                openEditSpecialtyModal(targetSpec);
                              }
                            }}
                            className="text-[11px] font-semibold text-blue-900 hover:text-blue-700 hover:underline flex items-center gap-1.5 cursor-pointer bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 transition-colors shadow-2xs"
                            title="Editar classe e lista de requisitos de conclusão"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-900" />
                            <span>Editar Requisitos Desta Formação</span>
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {Array.from({ length: totalReqs }).map((_, idx) => {
                          const reqNumber = idx + 1;
                          const isDone = currentItem.completedRequirements.includes(reqNumber);
                          const reqDescription =
                            targetRequirements[idx] ||
                            `Requisito Oficial #${reqNumber}: Demonstração prática e curricular avaliada pelo Instrutor`;

                          const canEditProgress =
                            can('training', 'EDIT') ||
                            currentUser.role === 'diretor' ||
                            currentUser.role === 'instrutor' ||
                            currentUser.role === 'admin_tecnico';

                          return (
                            <div
                              key={reqNumber}
                              onClick={() => canEditProgress && handleRequirementToggle(currentItem.id, reqNumber)}
                              className={`p-3 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                isDone
                                  ? 'bg-blue-50/70 border-blue-200 text-blue-950 font-medium'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 ${
                                    isDone
                                      ? 'bg-blue-900 text-white'
                                      : 'bg-white border border-slate-300 text-slate-700'
                                  }`}
                                >
                                  {isDone ? <Check className="w-3.5 h-3.5" /> : reqNumber}
                                </span>
                                <div className="space-y-0.5">
                                  <span className="block leading-relaxed">{reqDescription}</span>
                                </div>
                              </div>

                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ml-2 shrink-0 ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isDone ? 'Concluído' : 'Pendente'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Validação Final de Investidura (Diretor e Instrutor) */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Aprovação Institucional de Investidura
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Homologação e concessão oficial de investidura pelo Diretor ou Instrutor.
                        </p>
                      </div>

                      {currentItem.finalAuthorizedApproval ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Aprovado para Investidura</span>
                          </div>
                          {canApproveInvestiture && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = revokeTrainingApproval(currentItem.id);
                                if (res.success) {
                                  showFeedback('success', `Aprovação de investidura reaberta para reavaliação de ${currentItem.targetTitle}.`);
                                } else {
                                  showFeedback('error', res.error || 'Erro ao reabrir investidura.');
                                }
                              }}
                              className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 underline cursor-pointer"
                              title="Reabrir investidura para edição ou reavaliação"
                            >
                              Reabrir / Revogar
                            </button>
                          )}
                        </div>
                      ) : canApproveInvestiture ? (
                        <button
                          type="button"
                          onClick={() => {
                            const res = approveFinalTraining(currentItem.id);
                            if (res.success) {
                              showFeedback('success', `Investidura final autorizada com sucesso para ${currentItem.targetTitle}!`);
                            } else {
                              showFeedback('error', res.error || 'Erro ao aprovar investidura.');
                            }
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Autorizar Investidura Final</span>
                        </button>
                      ) : (
                        <span className="text-xs text-amber-800 font-semibold">
                          Aguardando Validação da Direção / Instrutor
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* MODAL 1: Inscrever Membro */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title="Inscrever Membro em Formação"
        description="Associe o membro à classe etária ou especialidade de aptidão."
        maxWidth="md"
      >
        <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Membro</label>
            <select
              value={enrollForm.memberId}
              onChange={(e) => setEnrollForm({ ...enrollForm, memberId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              {state.members
                .filter((m) => m.status === 'ativo')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.manualNumber})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tipo</label>
            <select
              value={enrollForm.type}
              onChange={(e) =>
                setEnrollForm({
                  ...enrollForm,
                  type: e.target.value as 'classe' | 'especialidade',
                  targetId: e.target.value === 'classe' ? state.classes[0]?.id : state.specialties[0]?.id,
                })
              }
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              <option value="classe">Classe</option>
              <option value="especialidade">Especialidade</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              {enrollForm.type === 'classe' ? 'Classe' : 'Especialidade'}
            </label>
            <select
              value={enrollForm.targetId}
              onChange={(e) => setEnrollForm({ ...enrollForm, targetId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              {enrollForm.type === 'classe'
                ? state.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} (A partir dos {c.minimumAge} anos · {c.requirements?.length || c.requirementsCount} reqs)
                    </option>
                  ))
                : state.specialties.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({CATEGORY_LABELS[s.category]?.label || s.category} · {s.requirements?.length || s.requirementsCount} reqs)
                    </option>
                  ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
            >
              Confirmar Matrícula de Formação
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Criar Nova Classe (com Requisitos de Conclusão) */}
      <Modal
        isOpen={isNewClassModalOpen}
        onClose={() => setIsNewClassModalOpen(false)}
        title="Criar Nova Classe"
        description="O Diretor e o Instrutor podem definir o título, idade mínima e todos os requisitos de conclusão."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateClass} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Título Oficial da Classe</label>
              <input
                type="text"
                placeholder="Ex: Classe de Líder Master"
                value={newClassForm.title}
                onChange={(e) => setNewClassForm({ ...newClassForm, title: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Idade Mínima Obrigatória (Anos)</label>
            <input
              type="number"
              min="5"
              max="99"
              value={newClassForm.minimumAge}
              onChange={(e) => setNewClassForm({ ...newClassForm, minimumAge: Number(e.target.value) })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          {/* Gestão Dinâmica dos Requisitos de Conclusão */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-slate-800 font-bold">
                  Requisitos de Conclusão Obrigatórios ({newClassForm.requirements.length})
                </label>
                <p className="text-[11px] text-slate-500">
                  Adicione e edite os itens que o membro deve concluir para obter a investidura oficial nesta classe.
                </p>
              </div>
            </div>

            {/* Lista dos Requisitos */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {newClassForm.requirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-blue-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => {
                      const updated = [...newClassForm.requirements];
                      updated[index] = e.target.value;
                      setNewClassForm({ ...newClassForm, requirements: updated });
                    }}
                    className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                    placeholder={`Descrição do requisito #${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = newClassForm.requirements.filter((_, i) => i !== index);
                      setNewClassForm({ ...newClassForm, requirements: updated });
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                    title="Remover requisito"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar Novo Requisito */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Digitar novo requisito de conclusão..."
                value={newClassForm.newReqInput}
                onChange={(e) => setNewClassForm({ ...newClassForm, newReqInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newClassForm.newReqInput.trim()) {
                      setNewClassForm({
                        ...newClassForm,
                        requirements: [...newClassForm.requirements, newClassForm.newReqInput.trim()],
                        newReqInput: '',
                      });
                    }
                  }
                }}
                className="flex-1 p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (newClassForm.newReqInput.trim()) {
                    setNewClassForm({
                      ...newClassForm,
                      requirements: [...newClassForm.requirements, newClassForm.newReqInput.trim()],
                      newReqInput: '',
                    });
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Requisito</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsNewClassModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Gravar Nova Classe Oficial</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Editar Classe e Requisitos */}
      <Modal
        isOpen={Boolean(editingClass)}
        onClose={() => setEditingClass(null)}
        title={`Editar ${editingClass?.title || 'Classe Oficial'}`}
        description="Altere a nomenclatura, idade mínima e a lista completa de requisitos de conclusão."
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateClass} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Título da Classe</label>
              <input
                type="text"
                value={classTitleInput}
                onChange={(e) => setClassTitleInput(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Idade Mínima Obrigatória</label>
            <input
              type="number"
              min="3"
              max="99"
              value={classMinAgeInput}
              onChange={(e) => setClassMinAgeInput(Number(e.target.value))}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          {/* Gestão Dinâmica dos Requisitos de Conclusão */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-slate-800 font-bold">
                  Requisitos de Conclusão Obrigatórios ({classRequirementsInput.length})
                </label>
                <p className="text-[11px] text-slate-500">
                  Edite, adicione ou remova requisitos de conclusão desta classe curricular.
                </p>
              </div>
            </div>

            {/* Lista dos Requisitos */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {classRequirementsInput.map((req, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-blue-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => {
                      const updated = [...classRequirementsInput];
                      updated[index] = e.target.value;
                      setClassRequirementsInput(updated);
                    }}
                    className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                    placeholder={`Descrição do requisito #${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = classRequirementsInput.filter((_, i) => i !== index);
                      setClassRequirementsInput(updated);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                    title="Remover requisito"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar Novo Requisito */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Adicionar novo requisito de conclusão..."
                value={classNewReqInput}
                onChange={(e) => setClassNewReqInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (classNewReqInput.trim()) {
                      setClassRequirementsInput([...classRequirementsInput, classNewReqInput.trim()]);
                      setClassNewReqInput('');
                    }
                  }
                }}
                className="flex-1 p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (classNewReqInput.trim()) {
                    setClassRequirementsInput([...classRequirementsInput, classNewReqInput.trim()]);
                    setClassNewReqInput('');
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Requisito</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingClass(null)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Alterações da Classe</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Criar Nova Especialidade (com Requisitos de Conclusão) */}
      <Modal
        isOpen={isNewSpecialtyModalOpen}
        onClose={() => setIsNewSpecialtyModalOpen(false)}
        title="Criar Nova Especialidade / Formação"
        description="O Diretor e o Instrutor podem definir o título, categoria e todos os requisitos de conclusão."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSpecialty} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Título da Especialidade</label>
              <input
                type="text"
                placeholder="Ex: Primeiros Socorros Avançado"
                value={newSpecialtyForm.title}
                onChange={(e) => setNewSpecialtyForm({ ...newSpecialtyForm, title: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Área / Categoria de Formação</label>
            <select
              value={newSpecialtyForm.category}
              onChange={(e) =>
                setNewSpecialtyForm({
                  ...newSpecialtyForm,
                  category: e.target.value as SpecialtyHonor['category'],
                })
              }
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              <option value="natureza">Estudos da Natureza</option>
              <option value="habilidades">Habilidades Manuais e Técnicas</option>
              <option value="saude">Saúde e Ciência</option>
              <option value="artes">Artes e Atividades Domésticas</option>
              <option value="espiritual">Atividades Espirituais e Missionárias</option>
              <option value="adra">ADRA / Serviço Comunitário</option>
            </select>
          </div>

          {/* Gestão Dinâmica dos Requisitos de Conclusão */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-slate-800 font-bold">
                  Requisitos de Conclusão da Especialidade ({newSpecialtyForm.requirements.length})
                </label>
                <p className="text-[11px] text-slate-500">
                  Defina os critérios e tarefas que o candidato deve executar e comprovar perante o Instrutor.
                </p>
              </div>
            </div>

            {/* Lista dos Requisitos */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {newSpecialtyForm.requirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => {
                      const updated = [...newSpecialtyForm.requirements];
                      updated[index] = e.target.value;
                      setNewSpecialtyForm({ ...newSpecialtyForm, requirements: updated });
                    }}
                    className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                    placeholder={`Requisito #${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = newSpecialtyForm.requirements.filter((_, i) => i !== index);
                      setNewSpecialtyForm({ ...newSpecialtyForm, requirements: updated });
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                    title="Remover requisito"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar Novo Requisito */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Digitar novo requisito da especialidade..."
                value={newSpecialtyForm.newReqInput}
                onChange={(e) => setNewSpecialtyForm({ ...newSpecialtyForm, newReqInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newSpecialtyForm.newReqInput.trim()) {
                      setNewSpecialtyForm({
                        ...newSpecialtyForm,
                        requirements: [...newSpecialtyForm.requirements, newSpecialtyForm.newReqInput.trim()],
                        newReqInput: '',
                      });
                    }
                  }
                }}
                className="flex-1 p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (newSpecialtyForm.newReqInput.trim()) {
                    setNewSpecialtyForm({
                      ...newSpecialtyForm,
                      requirements: [...newSpecialtyForm.requirements, newSpecialtyForm.newReqInput.trim()],
                      newReqInput: '',
                    });
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded shadow-xs shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Requisito</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsNewSpecialtyModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Gravar Nova Especialidade</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: Editar Especialidade / Formação e Requisitos */}
      <Modal
        isOpen={Boolean(editingSpecialty)}
        onClose={() => setEditingSpecialty(null)}
        title={`Editar ${editingSpecialty?.title || 'Especialidade'}`}
        description="Atualize o nome, categoria e todos os requisitos de conclusão."
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateSpecialty} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Título da Especialidade</label>
              <input
                type="text"
                value={specialtyTitleInput}
                onChange={(e) => setSpecialtyTitleInput(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Categoria</label>
            <select
              value={specialtyCategoryInput}
              onChange={(e) => setSpecialtyCategoryInput(e.target.value as SpecialtyHonor['category'])}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              <option value="natureza">Estudos da Natureza</option>
              <option value="habilidades">Habilidades Manuais e Técnicas</option>
              <option value="saude">Saúde e Ciência</option>
              <option value="artes">Artes e Atividades Domésticas</option>
              <option value="espiritual">Atividades Espirituais e Missionárias</option>
              <option value="adra">ADRA / Serviço Comunitário</option>
            </select>
          </div>

          {/* Gestão Dinâmica dos Requisitos de Conclusão */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-slate-800 font-bold">
                  Requisitos de Conclusão ({specialtyRequirementsInput.length})
                </label>
                <p className="text-[11px] text-slate-500">
                  Edite, adicione ou remova requisitos para aprovação desta especialidade.
                </p>
              </div>
            </div>

            {/* Lista dos Requisitos */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {specialtyRequirementsInput.map((req, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => {
                      const updated = [...specialtyRequirementsInput];
                      updated[index] = e.target.value;
                      setSpecialtyRequirementsInput(updated);
                    }}
                    className="flex-1 p-1.5 text-xs bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                    placeholder={`Requisito #${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = specialtyRequirementsInput.filter((_, i) => i !== index);
                      setSpecialtyRequirementsInput(updated);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                    title="Remover requisito"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar Novo Requisito */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Digitar novo requisito da especialidade..."
                value={specialtyNewReqInput}
                onChange={(e) => setSpecialtyNewReqInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (specialtyNewReqInput.trim()) {
                      setSpecialtyRequirementsInput([...specialtyRequirementsInput, specialtyNewReqInput.trim()]);
                      setSpecialtyNewReqInput('');
                    }
                  }
                }}
                className="flex-1 p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (specialtyNewReqInput.trim()) {
                    setSpecialtyRequirementsInput([...specialtyRequirementsInput, specialtyNewReqInput.trim()]);
                    setSpecialtyNewReqInput('');
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded shadow-xs shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Requisito</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingSpecialty(null)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-emerald-800 hover:bg-emerald-700 rounded shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Alterações da Especialidade</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Confirmação de Eliminação Segura */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title={`Eliminar ${deleteTarget.type === 'classe' ? 'Classe' : 'Especialidade'}`}
          description={`Tem a certeza que deseja remover "${deleteTarget.title}" do catálogo oficial?`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 leading-relaxed">
              Esta ação eliminará permanentemente esta {deleteTarget.type === 'classe' ? 'classe' : 'especialidade'} do catálogo e cancelará quaisquer registos de formação associados que ainda não foram homologados.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAction}
                className="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs"
              >
                Sim, Eliminar Definitivamente
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

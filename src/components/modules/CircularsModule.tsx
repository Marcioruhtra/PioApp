import React, { useState } from 'react';
import {
  Bell,
  Clock,
  Plus,
  Send,
  AlertTriangle,
  FileText,
  Users,
  CheckCircle2,
  Trash2,
  Eye,
  Search,
  Filter,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { Circular, RoleType } from '../../types';
import { formatDateAO, formatDateTimeAO } from '../../utils/date';
import { Modal } from '../common/Modal';
import { ROLE_LABELS } from '../../services/permissionService';

export const CircularsModule: React.FC = () => {
  const { state, can, currentUser, createCircular, deleteCircular } = useClub();

  const [isNewCircularModalOpen, setIsNewCircularModalOpen] = useState(false);
  const [selectedCircular, setSelectedCircular] = useState<Circular | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'todos' | 'normal' | 'alta' | 'urgente'>('todos');

  const [circularForm, setCircularForm] = useState({
    title: '',
    content: '',
    targetRoles: ['membro', 'instrutor', 'secretario', 'tesoureiro', 'diretor', 'admin_tecnico'] as RoleType[],
    priority: 'normal' as Circular['priority'],
  });

  const handleCreateCircular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!circularForm.title.trim() || !circularForm.content.trim()) return;

    const res = createCircular({
      title: circularForm.title.trim(),
      content: circularForm.content.trim(),
      targetRoles: circularForm.targetRoles,
      priority: circularForm.priority,
    });

    if (res.success) {
      setIsNewCircularModalOpen(false);
      setCircularForm({
        title: '',
        content: '',
        targetRoles: ['membro', 'instrutor', 'secretario', 'tesoureiro', 'diretor', 'admin_tecnico'],
        priority: 'normal',
      });
    }
  };

  const filteredCirculars = state.circulars.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'todos' || c.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const getPriorityStyles = (priority: Circular['priority']) => {
    switch (priority) {
      case 'urgente': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'alta': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-900" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Comunicação Institucional & Circulares
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de avisos oficiais, convocações e diretivas com rasto de leitura.
          </p>
        </div>

        {can('requests', 'CREATE') && (
          <button
            onClick={() => setIsNewCircularModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publicar Nova Circular</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar nas circulares..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-900"
          >
            <option value="todos">Todas as Prioridades</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
      </div>

      {/* Circulars List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCirculars.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Nenhuma circular encontrada</h3>
            <p className="text-xs text-slate-500 mt-1">Publique a primeira circular oficial para os membros do clube.</p>
          </div>
        ) : (
          filteredCirculars.map((circular) => (
            <div
              key={circular.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden hover:border-blue-300 transition-colors"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityStyles(circular.priority)}`}>
                        {circular.priority}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTimeAO(circular.publishedAt)}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">
                      {circular.title}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Publicado por: <span className="font-semibold text-slate-700">{circular.publishedByName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedCircular(circular)}
                      className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Ver detalhes e rasto de leitura"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {can('requests', 'ADMIN') && (
                      <button
                        onClick={() => {
                          if (window.confirm('Deseja realmente remover esta circular oficial?')) {
                            deleteCircular(circular.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remover circular"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">
                  {circular.content}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span>{circular.readBy.length} visualizações</span>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {circular.targetRoles.map((role: RoleType) => (
                      <div 
                        key={role}
                        className="w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center"
                        title={ROLE_LABELS[role]?.label}
                      >
                        <span className="text-[8px] font-bold text-slate-600 uppercase">
                          {role.charAt(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: New Circular */}
      <Modal
        isOpen={isNewCircularModalOpen}
        onClose={() => setIsNewCircularModalOpen(false)}
        title="Publicar Circular Oficial"
      >
        <form onSubmit={handleCreateCircular} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Título da Circular
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Convocatória para Assembleia Geral"
              value={circularForm.title}
              onChange={(e) => setCircularForm({ ...circularForm, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Prioridade
            </label>
            <select
              value={circularForm.priority}
              onChange={(e) => setCircularForm({ ...circularForm, priority: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-900"
            >
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Conteúdo da Circular
            </label>
            <textarea
              required
              rows={8}
              placeholder="Escreva aqui o comunicado oficial..."
              value={circularForm.content}
              onChange={(e) => setCircularForm({ ...circularForm, content: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              Destinatários (Cargos)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_LABELS) as RoleType[]).map(role => (
                <label key={role} className="flex items-center gap-2 p-2 border border-slate-100 rounded hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={circularForm.targetRoles.includes(role)}
                    onChange={(e) => {
                      const roles = e.target.checked 
                        ? [...circularForm.targetRoles, role]
                        : circularForm.targetRoles.filter(r => r !== role);
                      setCircularForm({ ...circularForm, targetRoles: roles });
                    }}
                    className="rounded text-blue-900"
                  />
                  <span className="text-[11px] font-medium text-slate-700">{ROLE_LABELS[role]?.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setIsNewCircularModalOpen(false)}
              className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publicar Circular</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Circular Details & Read Tracking */}
      {selectedCircular && (
        <Modal
          isOpen={!!selectedCircular}
          onClose={() => setSelectedCircular(null)}
          title="Detalhes da Circular"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityStyles(selectedCircular.priority)}`}>
                  {selectedCircular.priority}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Publicado em {formatDateTimeAO(selectedCircular.publishedAt)}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                {selectedCircular.title}
              </h2>
              <div className="text-xs text-slate-500">
                Responsável: <span className="font-bold text-slate-700">{selectedCircular.publishedByName}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {selectedCircular.content}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-900" />
                <span>Rasto de Leitura ({selectedCircular.readBy.length})</span>
              </h3>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-[150px] overflow-y-auto divide-y divide-slate-100">
                  {selectedCircular.readBy.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum membro confirmou leitura até ao momento.
                    </div>
                  ) : (
                    selectedCircular.readBy.map(memberId => {
                      const member = state.members.find(m => m.id === memberId);
                      return (
                        <div key={memberId} className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-900 font-bold text-[10px]">
                              {member?.fullName.charAt(0) || '?'}
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-slate-900">{member?.fullName || 'Membro Desconhecido'}</div>
                              <div className="text-[9px] text-slate-500">{member?.unitOrTeam}</div>
                            </div>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedCircular(null)}
              className="w-full px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

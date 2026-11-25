import React, { useEffect, useState } from 'react';
import {
  Settings,
  Building,
  Shield,
  Save,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { formatKz } from '../../utils/currency';
import { Modal } from '../common/Modal';

export const SettingsModule: React.FC = () => {
  const { state, can, updateSettings, openNewFiscalYear } = useClub();

  const [form, setForm] = useState({
    clubName: state.settings.clubName || "Clube de Embaixadores Pioneiros D'Alvorada",
    city: state.settings.city || "Luanda, Município de Talatona",
    address: state.settings.address || "Rua do Grupo Desportivo da Banca, Maianga, Luanda, Angola",
    phone: state.settings.phone || "931793101",
    alternatePhone: state.settings.alternatePhone || "927705324",
    email: state.settings.email || "ebxpioneirosdalvorada2019@hotmail.com",
    currentYear: state.settings.currentYear,
  });

  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmFiscalYear, setConfirmFiscalYear] = useState<number | null>(null);

  useEffect(() => {
    setForm({
      clubName: state.settings.clubName || "Clube de Embaixadores Pioneiros D'Alvorada",
      city: state.settings.city || "Luanda, Município de Talatona",
      address: state.settings.address || "Rua do Grupo Desportivo da Banca, Maianga, Luanda, Angola",
      phone: state.settings.phone || "931793101",
      alternatePhone: state.settings.alternatePhone || "927705324",
      email: state.settings.email || "ebxpioneirosdalvorada2019@hotmail.com",
      currentYear: state.settings.currentYear,
    });
  }, [
    state.settings.clubName,
    state.settings.city,
    state.settings.address,
    state.settings.phone,
    state.settings.alternatePhone,
    state.settings.email,
    state.settings.currentYear,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!can('settings', 'EDIT')) {
      setErrorMessage('Sem permissão para alterar as configurações do clube.');
      return;
    }

    updateSettings({
      clubName: form.clubName,
      city: form.city,
      headquarters: form.city,
      address: form.address,
      phone: form.phone,
      alternatePhone: form.alternatePhone,
      email: form.email,
      currentYear: form.currentYear,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-900" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Parâmetros e Configurações do Clube
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão dos dados institucionais, modelos de documentos e tabelas de módulos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-900" />
            <span>Dados da Organização</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                {errorMessage}
              </div>
            )}
            {isSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                Configurações atualizadas com sucesso!
              </div>
            )}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nome Oficial da Entidade</label>
              <input
                type="text"
                value={form.clubName}
                onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                disabled={!can('settings', 'EDIT')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Igreja Adventista do Sétimo Dia</label>
                <input
                  type="text"
                  placeholder="ex: Igreja Adventista do Sétimo Dia Central"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  disabled={!can('settings', 'EDIT')}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ano Fiscal em Curso</label>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={Number.isFinite(form.currentYear) ? form.currentYear : state.settings.currentYear}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    setForm({ ...form, currentYear: Number.isNaN(parsed) ? state.settings.currentYear : parsed });
                  }}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  disabled={!can('settings', 'EDIT')}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Endereço Oficial (Impressão de Documentos)</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                disabled={!can('settings', 'EDIT')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telefone Principal</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  disabled={!can('settings', 'EDIT')}
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telefone Alternativo</label>
                <input
                  type="text"
                  value={form.alternatePhone}
                  onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  disabled={!can('settings', 'EDIT')}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">E-mail Institucional</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                disabled={!can('settings', 'EDIT')}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {isSaved ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5 text-xs">
                  <CheckCircle className="w-4 h-4" />
                  <span>Atualizado!</span>
                </span>
              ) : <span />}

              <div className="flex gap-2">
                {can('settings', 'ADMIN') && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      const targetYear = (Number.isFinite(form.currentYear) ? form.currentYear : state.settings.currentYear) + 1;
                      setConfirmFiscalYear(targetYear);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Abrir Ano {(Number.isFinite(form.currentYear) ? form.currentYear : state.settings.currentYear) + 1}</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-900" />
            <span>Configurações Avançadas</span>
          </h2>
          <div className="text-xs space-y-3">
             <p className="text-slate-600">Edição de Categorias, Módulos, Unidades e Modelos de Documentos disponível no Módulo Administrativo.</p>
             <div className="divide-y divide-slate-100">
                {state.fees.map((fee) => (
                    <div key={fee.id} className="py-2.5 flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{fee.title}</span>
                      <span className="font-black text-slate-900">{formatKz(fee.amountInCents)}</span>
                    </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação de Abertura de Novo Ano Fiscal */}
      <Modal
        isOpen={confirmFiscalYear !== null}
        onClose={() => setConfirmFiscalYear(null)}
        title={`Abrir Ano Fiscal ${confirmFiscalYear ?? ''}?`}
        description="Confirme a transição institucional do ano fiscal ativo."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5 leading-relaxed">
              <p className="font-semibold">
                O sistema passará do ano fiscal <strong>{state.settings.currentYear}</strong> para <strong>{confirmFiscalYear}</strong>.
              </p>
              <p>
                Todos os dados históricos (membros, recibos, fechos mensais, atas e documentos oficiais de anos anteriores) são integralmente preservados, sem liquidação automática de dívidas anteriores.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmFiscalYear(null)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmFiscalYear === null) return;
                const targetYear = confirmFiscalYear;
                setConfirmFiscalYear(null);
                const res = openNewFiscalYear(targetYear);
                if (res.success) {
                  setForm((prev) => ({ ...prev, currentYear: targetYear }));
                  setIsSaved(true);
                  setTimeout(() => setIsSaved(false), 3000);
                } else {
                  setErrorMessage(res.error || 'Erro ao abrir novo ano fiscal.');
                }
              }}
              className="px-4 py-2 font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg cursor-pointer"
            >
              Confirmar Abertura do Ano {confirmFiscalYear}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

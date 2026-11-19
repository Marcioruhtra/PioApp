import React, { useState } from 'react';
import {
  Music,
  Plus,
  Search,
  Printer,
  Edit,
  Trash2,
  BookOpen,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { MusicCategory, MusicItem } from '../../types';
import { Modal } from '../common/Modal';

const CATEGORY_LABELS: Record<MusicCategory, string> = {
  hino_oficial: 'Hino Oficial do Clube',
  louvor_jovem: 'Louvor Jovem / Inspiracional',
  marcha: 'Marcha de Acampamento / Cívica',
  coral: 'Coral & Cânticos',
  especial: 'Número Especial',
};

const CATEGORY_COLORS: Record<MusicCategory, string> = {
  hino_oficial: 'bg-amber-100 text-amber-900 border-amber-300',
  louvor_jovem: 'bg-blue-100 text-blue-900 border-blue-300',
  marcha: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  coral: 'bg-purple-100 text-purple-900 border-purple-300',
  especial: 'bg-slate-100 text-slate-800 border-slate-300',
};

export const MusicModule: React.FC = () => {
  const { state, can, createMusicItem, updateMusicItem, deleteMusicItem } = useClub();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MusicItem | null>(null);
  const [selectedSongToView, setSelectedSongToView] = useState<MusicItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MusicItem | null>(null);

  const [form, setForm] = useState({
    title: '',
    composer: '',
    category: 'louvor_jovem' as MusicCategory,
    lyrics: '',
    chordChartUrl: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const musicList = state.musicItems || [];

  const filteredMusic = musicList.filter((item) => {
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.composer && item.composer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.lyrics && item.lyrics.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchCategory = categoryFilter === 'todos' || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({
      title: '',
      composer: '',
      category: 'louvor_jovem',
      lyrics: '',
      chordChartUrl: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MusicItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      composer: item.composer || '',
      category: item.category,
      lyrics: item.lyrics || '',
      chordChartUrl: item.chordChartUrl || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) {
      setFormError('O título do hino/cântico é obrigatório.');
      return;
    }

    if (editingItem) {
      const res = updateMusicItem(editingItem.id, {
        title: form.title.trim(),
        composer: form.composer.trim() || undefined,
        category: form.category,
        lyrics: form.lyrics.trim() || undefined,
        chordChartUrl: form.chordChartUrl.trim() || undefined,
      });
      if (res.success) {
        setIsModalOpen(false);
      } else {
        setFormError(res.error || 'Erro ao atualizar hino.');
      }
    } else {
      const res = createMusicItem({
        title: form.title.trim(),
        composer: form.composer.trim() || undefined,
        category: form.category,
        lyrics: form.lyrics.trim() || undefined,
        chordChartUrl: form.chordChartUrl.trim() || undefined,
      });
      if (res.success) {
        setIsModalOpen(false);
      } else {
        setFormError(res.error || 'Erro ao registar hino.');
      }
    }
  };

  const handleDelete = (id: string) => {
    const target = musicList.find((m) => m.id === id);
    if (target) {
      setItemToDelete(target);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-blue-900 shrink-0" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Repertório e Hinos Oficiais do Clube
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestão do acervo musical, hinos oficiais, cânticos de louvor, marchas e letras para reuniões e acampamentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can('music', 'CREATE') && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Hino / Cântico</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between w-full max-w-full min-w-0">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por título, autor ou letra..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white w-full md:w-auto font-medium"
        >
          <option value="todos">Todas as Categorias Musicais</option>
          <option value="hino_oficial">Hinos Oficiais do Clube</option>
          <option value="louvor_jovem">Louvores Jovens / Inspiracionais</option>
          <option value="marcha">Marchas de Acampamento</option>
          <option value="coral">Coral & Cânticos</option>
          <option value="especial">Números Especiais</option>
        </select>
      </div>

      {/* Grelha de Cânticos e Hinos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full min-w-0">
        {filteredMusic.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
            Nenhum hino ou cântico encontrado com os filtros selecionados.
          </div>
        ) : (
          filteredMusic.map((song) => (
            <div
              key={song.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${CATEGORY_COLORS[song.category] || 'bg-slate-100 text-slate-800 border-slate-300'}`}>
                    {CATEGORY_LABELS[song.category] || song.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedSongToView(song)}
                      className="p-1.5 text-slate-500 hover:text-blue-900 rounded"
                      title="Ver Letra e Detalhes"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                    {can('music', 'EDIT') && (
                      <button
                        onClick={() => handleOpenEdit(song)}
                        className="p-1.5 text-slate-500 hover:text-blue-900 rounded"
                        title="Editar Hino"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {can('music', 'EDIT') && (
                      <button
                        onClick={() => handleDelete(song.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-700 rounded"
                        title="Eliminar Hino"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-black text-slate-900 leading-snug">
                  {song.title}
                </h3>
                {song.composer && (
                  <p className="text-xs text-slate-500 font-medium italic">
                    Compositor / Autor: {song.composer}
                  </p>
                )}
              </div>

              {song.lyrics && (
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 text-[11px] text-slate-700 font-serif line-clamp-3 whitespace-pre-line">
                  {song.lyrics}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Adicionado ao Repertório</span>
                <button
                  onClick={() => setSelectedSongToView(song)}
                  className="font-bold text-blue-900 hover:underline inline-flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ler Cifras / Letra</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Criação / Edição de Hino */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Editar Hino / Cântico' : 'Adicionar Novo Hino ao Repertório'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Título do Hino / Cântico *</label>
            <input
              type="text"
              placeholder="Ex: Hino Oficial dos Embaixadores / Alvos ao Sol"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-lg font-semibold focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Categoria Musical</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as MusicCategory })}
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white"
              >
                <option value="hino_oficial">Hino Oficial do Clube</option>
                <option value="louvor_jovem">Louvor Jovem / Inspiracional</option>
                <option value="marcha">Marcha de Acampamento</option>
                <option value="coral">Coral & Cânticos</option>
                <option value="especial">Número Especial</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Compositor / Autor (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Hinário Adventista / Autoria Própria"
                value={form.composer}
                onChange={(e) => setForm({ ...form, composer: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Letra / Estrofes do Hino</label>
            <textarea
              rows={6}
              placeholder="Escreva ou cole a letra completa com estrofes e coro..."
              value={form.lyrics}
              onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-lg font-serif leading-relaxed focus:ring-1 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Link de Cifras, Partitura ou Referência (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: https://cifraclub.com.br/... ou link de áudio"
              value={form.chordChartUrl}
              onChange={(e) => setForm({ ...form, chordChartUrl: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-[11px]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              {editingItem ? 'Guardar Alterações' : 'Adicionar ao Repertório'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Leitura / Impressão de Cântico */}
      {selectedSongToView && (
        <Modal
          isOpen={Boolean(selectedSongToView)}
          onClose={() => setSelectedSongToView(null)}
          title={`Repertório: ${selectedSongToView.title}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${CATEGORY_COLORS[selectedSongToView.category]}`}>
                  {CATEGORY_LABELS[selectedSongToView.category]}
                </span>
                {selectedSongToView.composer && (
                  <p className="text-slate-600 font-medium italic mt-1">
                    Compositor: {selectedSongToView.composer}
                  </p>
                )}
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Letra</span>
              </button>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl font-serif text-sm whitespace-pre-line leading-relaxed text-slate-900 min-h-[160px]">
              {selectedSongToView.lyrics || 'Nenhuma letra registada para este cântico.'}
            </div>

            {selectedSongToView.chordChartUrl && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                <span>Cifras e Recursos Externos disponíveis</span>
                <a
                  href={selectedSongToView.chordChartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-blue-700"
                >
                  Aceder ao Link Externo →
                </a>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedSongToView(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {itemToDelete && (
        <Modal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          title="Remover Hino do Repertório"
          description="Esta operação remove permanentemente o cântico do acervo musical."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
              Tem certeza que deseja remover o hino <strong>{itemToDelete.title}</strong> do repertório oficial?
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMusicItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

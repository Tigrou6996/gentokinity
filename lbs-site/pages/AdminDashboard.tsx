import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface ContactRequest {
  id: string;
  nome: string;
  email: string;
  telefono: string | null;
  messaggio: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

interface Candidatura {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string | null;
  settore: string | null;
  messaggio: string | null;
  stato: 'nuova' | 'in_lavorazione' | 'completata' | 'rifiutata';
  note_admin: string | null;
  created_at: string;
  // Campi aggiunti dalla candidatura offerta
  offerta_id: string | null;
  offerta_titolo: string | null;
  data_nascita: string | null;
  cittadinanza: string | null;
  paese_residenza: string | null;
  livello_tedesco: string | null;
  livello_inglese: string | null;
  anni_esperienza: string | null;
  patente: string | null;
  disponibilita: string | null;
}

interface Offerta {
  id: string;
  titolo: string;
  azienda: string | null;
  citta: string;
  stato_germania: string;
  settore: string;
  contratto: string;
  stipendio_min: number | null;
  stipendio_max: number | null;
  stipendio_tipo: string;
  stipendio_modalita: string;
  descrizione: string;
  requisiti: string | null;
  attiva: boolean;
  in_evidenza: boolean;
  slug: string | null;
  immagine_url: string | null;
  created_at: string;
}

interface DatoreRichiesta {
  id: string;
  nome_azienda: string;
  nome_referente: string | null;
  email: string;
  telefono: string | null;
  settore_ricerca: string | null;
  num_lavoratori: string | null;
  messaggio: string | null;
  stato: 'nuova' | 'in_lavorazione' | 'completata';
  created_at: string;
}

interface DatoreGestito {
  id: string;
  nome_azienda: string;
  nome_referente: string | null;
  email: string | null;
  telefono: string | null;
  settori: string | null;
  note: string | null;
  created_at: string;
}

const EMPTY_OFFERTA: Omit<Offerta,'id'|'created_at'> = { titolo:'', azienda:'', citta:'', stato_germania:'', settore:'Edilizia e Costruzioni', contratto:'Tempo Indeterminato', stipendio_min:null, stipendio_max:null, stipendio_tipo:'lordo', stipendio_modalita:'range', descrizione:'', requisiti:'', attiva:true, in_evidenza:false, slug:'', immagine_url:null };

const STIPENDIO_TIPO_OPT = ['lordo', 'netto'];
const STIPENDIO_MODALITA_OPT = [
  { value: 'range', label: 'Range (min – max)' },
  { value: 'fisso', label: 'Fisso (importo unico)' },
  { value: 'a_partire_da', label: 'A partire da...' },
  { value: 'concordare', label: 'Da concordare' },
];

const STATO_LABELS: Record<string,{label:string;color:string}> = {
  nuova: { label:'Nuova', color:'#6E4274' },
  in_lavorazione: { label:'In Lavorazione', color:'#FF6B35' },
  completata: { label:'Completata', color:'#25D366' },
  rifiutata: { label:'Rifiutata', color:'#dc2626' },
};

const SETTORI_OPT = ['Edilizia e Costruzioni','Ristorazione e Cucina','Sanitario e Assistenza','Meccanica e Industria','Logistica e Magazzino','Agricoltura','Pulizie e Facilities','Trasporti e Autotrasporto','IT e Tecnologia','Altro'];
const CONTRATTI_OPT = ['Tempo Indeterminato','Tempo Determinato','Stagionale','Apprendistato'];

type AdminTab = 'overview' | 'candidature' | 'requests' | 'offerte' | 'users' | 'datori';

const AdminDashboard: React.FC = () => {
  const { user, profile, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Cambio password admin
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [adminCurrentPwd, setAdminCurrentPwd] = useState('');
  const [adminNewPwd, setAdminNewPwd] = useState('');
  const [adminConfirmPwd, setAdminConfirmPwd] = useState('');
  const [showAdminCurrentPwd, setShowAdminCurrentPwd] = useState(false);
  const [showAdminNewPwd, setShowAdminNewPwd] = useState(false);
  const [showAdminConfirmPwd, setShowAdminConfirmPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);

    if (!adminCurrentPwd) {
      setPwdError('Inserisci la password attuale dell\'amministratore.');
      return;
    }
    if (adminNewPwd.length < 8) {
      setPwdError('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (adminNewPwd === adminCurrentPwd) {
      setPwdError('La nuova password deve essere diversa da quella attuale.');
      return;
    }
    if (adminNewPwd !== adminConfirmPwd) {
      setPwdError('Le password non coincidono.');
      return;
    }

    setPwdLoading(true);
    const { error } = await updatePassword(adminNewPwd, adminCurrentPwd);
    setPwdLoading(false);

    if (error) {
      setPwdError(error);
    } else {
      setPwdSuccess(true);
      setAdminCurrentPwd('');
      setAdminNewPwd('');
      setAdminConfirmPwd('');
    }
  };

  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [candidature, setCandidature] = useState<Candidatura[]>([]);
  const [offerte, setOfferte] = useState<Offerta[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null);
  const [selectedCand, setSelectedCand] = useState<Candidatura | null>(null);
  const [candNote, setCandNote] = useState('');
  const [offerForm, setOfferForm] = useState<Omit<Offerta,'id'|'created_at'>>(EMPTY_OFFERTA);
  const [editingOffer, setEditingOffer] = useState<string | null>(null);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedJooble, setCopiedJooble] = useState(false);

  // Ricerca & filtro candidature
  const [candSearch, setCandSearch] = useState('');
  const [candFiltroStato, setCandFiltroStato] = useState('tutti');

  // Datori di lavoro
  const [datoriRichieste, setDatoriRichieste] = useState<DatoreRichiesta[]>([]);
  const [datoriGestiti, setDatoriGestiti] = useState<DatoreGestito[]>([]);
  const [selectedDatoreReq, setSelectedDatoreReq] = useState<DatoreRichiesta | null>(null);
  const [showAddDatoreForm, setShowAddDatoreForm] = useState(false);
  const [newDatoreForm, setNewDatoreForm] = useState({ nome_azienda:'', nome_referente:'', email:'', telefono:'', settori:'', note:'' });
  const [savingDatore, setSavingDatore] = useState(false);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Admin';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    // Pre-carica i contatori per la panoramica
    fetchRequests();
    fetchCandidature();
    fetchOfferte();
    fetchDatoriRichieste();
    fetchDatoriGestiti();
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'candidature') fetchCandidature();
    if (activeTab === 'offerte') fetchOfferte();
    if (activeTab === 'datori') { fetchDatoriRichieste(); fetchDatoriGestiti(); }
  }, [activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRequests(data as ContactRequest[]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setUsers(data as UserProfile[]);
    setLoading(false);
  };

  const deleteRequest = async (id: string) => {
    await supabase.from('contact_requests').delete().eq('id', id);
    setRequests(prev => prev.filter(r => r.id !== id));
    setSelectedRequest(null);
  };

  const fetchCandidature = async () => {
    setLoading(true);
    const { data } = await supabase.from('candidature').select('*').order('created_at', { ascending: false });
    if (data) setCandidature(data as Candidatura[]);
    setLoading(false);
  };

  const updateCandidatura = async (id: string, stato: string, note: string) => {
    await supabase.from('candidature').update({ stato, note_admin: note }).eq('id', id);
    setCandidature(prev => prev.map(c => c.id === id ? { ...c, stato: stato as Candidatura['stato'], note_admin: note } : c));
    setSelectedCand(null);
  };

  const deleteCandidatura = async (id: string) => {
    await supabase.from('candidature').delete().eq('id', id);
    setCandidature(prev => prev.filter(c => c.id !== id));
    setSelectedCand(null);
  };

  const fetchOfferte = async () => {
    setLoading(true);
    const { data } = await supabase.from('offerte_lavoro').select('*').order('created_at', { ascending: false });
    if (data) setOfferte(data as Offerta[]);
    setLoading(false);
  };

  const openNewOffer = () => {
    setOfferForm(EMPTY_OFFERTA);
    setEditingOffer(null);
    setShowOfferForm(true);
    setImageFile(null);
    setImagePreview(null);
  };

  const openEditOffer = (o: Offerta) => {
    const { id, created_at, ...rest } = o;
    let modalita = rest.stipendio_modalita;
    if (!modalita) {
      if (rest.stipendio_min && rest.stipendio_max) modalita = 'range';
      else if (rest.stipendio_min && !rest.stipendio_max) modalita = 'fisso';
      else if (!rest.stipendio_min && !rest.stipendio_max) modalita = 'concordare';
      else modalita = 'range';
    }
    const tipo = (rest.stipendio_tipo === 'netto' || rest.stipendio_tipo === 'lordo') ? rest.stipendio_tipo : 'lordo';

    setOfferForm({
      ...EMPTY_OFFERTA,
      ...rest,
      stipendio_tipo: tipo,
      stipendio_modalita: modalita,
    });
    setEditingOffer(id);
    setShowOfferForm(true);
    setImageFile(null);
    setImagePreview(o.immagine_url || null);
  };

  // Genera slug dal titolo
  const slugify = (str: string) =>
    str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const handleTitoloChange = (val: string) => {
    setOfferForm(prev => ({
      ...prev,
      titolo: val,
      // Auto-genera slug solo se il campo slug è ancora vuoto o uguale a quello auto-generato
      slug: prev.slug === slugify(prev.titolo) || prev.slug === '' ? slugify(val) : prev.slug,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveOfferta = async () => {
    setSavingOffer(true);
    try {
      let immagine_url = offerForm.immagine_url || null;

      // Upload immagine se selezionata
      if (imageFile) {
        setUploadingImage(true);
        const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `offerta-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('offerte-images')
          .upload(fileName, imageFile, { upsert: true });

        if (uploadError) {
          console.error('Errore upload immagine storage:', uploadError);
          alert(`⚠️ Errore caricamento immagine Supabase Storage: ${uploadError.message}\n\nAssicurati che su Supabase > Storage sia presente il bucket 'offerte-images' impostato come PUBLIC!`);
          setSavingOffer(false);
          setUploadingImage(false);
          return;
        }

        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('offerte-images')
            .getPublicUrl(fileName);
          immagine_url = urlData.publicUrl;
        }
        setUploadingImage(false);
      }

      // Prepara slug pulito o null
      let finalSlug = offerForm.slug ? offerForm.slug.trim() : null;
      if (!finalSlug && offerForm.titolo) {
        finalSlug = slugify(offerForm.titolo);
      }

      const isConcordare = offerForm.stipendio_modalita === 'concordare';
      const isRange = offerForm.stipendio_modalita === 'range';

      const payload: any = {
        titolo: offerForm.titolo.trim(),
        azienda: offerForm.azienda?.trim() || null,
        citta: offerForm.citta.trim(),
        stato_germania: offerForm.stato_germania?.trim() || '',
        settore: offerForm.settore,
        contratto: offerForm.contratto,
        stipendio_min: isConcordare ? null : (offerForm.stipendio_min ? Number(offerForm.stipendio_min) : null),
        stipendio_max: (isRange && !isConcordare && offerForm.stipendio_max) ? Number(offerForm.stipendio_max) : null,
        stipendio_tipo: offerForm.stipendio_tipo || 'lordo',
        stipendio_modalita: offerForm.stipendio_modalita || 'range',
        descrizione: offerForm.descrizione.trim(),
        requisiti: offerForm.requisiti?.trim() || null,
        attiva: offerForm.attiva,
        in_evidenza: offerForm.in_evidenza || false,
        slug: finalSlug,
        immagine_url: immagine_url || null,
        updated_at: new Date().toISOString(),
      };

      let errorRes: any = null;
      if (editingOffer) {
        const { error } = await supabase.from('offerte_lavoro').update(payload).eq('id', editingOffer);
        errorRes = error;
      } else {
        const { error } = await supabase.from('offerte_lavoro').insert([payload]);
        errorRes = error;

        // Se lo slug è duplicato, prova ad aggiungere un suffisso univoco
        if (errorRes && (errorRes.code === '23505' || errorRes.message?.includes('slug'))) {
          const uniqueSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
          payload.slug = uniqueSlug;
          const retry = await supabase.from('offerte_lavoro').insert([payload]);
          if (!retry.error) {
            errorRes = null;
          } else {
            errorRes = retry.error;
          }
        }
      }

      if (errorRes) {
        console.error('Errore salvataggio offerta Supabase:', {
          code: errorRes.code,
          message: errorRes.message,
          details: errorRes.details,
          hint: errorRes.hint,
        });
        const fullMsg = errorRes.message || errorRes.details || JSON.stringify(errorRes);
        if (fullMsg.includes('column') || errorRes.code === 'PGRST204') {
          alert(
            `⚠️ IMPOSSIBILE SALVARE L'OFFERTA!\n\n` +
            `Errore colonna mancante: ${fullMsg}\n\n` +
            `👉 DEVI ESEGUIRE LO SCRIPT SQL SU SUPABASE!\n` +
            `Le colonne 'in_evidenza', 'slug', 'immagine_url' non esistono ancora nella tabella del tuo database Supabase.\n` +
            `Esegui lo script SQL fornito nello SQL Editor di Supabase.`
          );
        } else if (errorRes.code === '23505' || fullMsg.includes('unique constraint') || fullMsg.includes('slug')) {
          alert(`⚠️ Esiste già un'offerta con lo stesso titolo o slug ("/offerte/${finalSlug}").\n\nModifica lo slug per renderlo unico.`);
        } else if (errorRes.code === '42501' || fullMsg.includes('row-level security')) {
          alert(`⚠️ Errore permessi (RLS): Il tuo account non ha i permessi di admin per modificare la tabella offerte_lavoro.`);
        } else {
          alert(`❌ Errore salvataggio offerta:\n\n${fullMsg}\n\n(Codice: ${errorRes.code || 'N/D'})`);
        }
      } else {
        await fetchOfferte();
        setShowOfferForm(false);
        setImageFile(null);
        setImagePreview(null);
      }
    } catch (err: any) {
      console.error('Eccezione imprevista in saveOfferta:', err);
      alert(`❌ Errore imprevisto durante il salvataggio: ${err.message || err}`);
    } finally {
      setSavingOffer(false);
      setUploadingImage(false);
    }
  };

  const [offerToDelete, setOfferToDelete] = useState<Offerta | null>(null);
  const [isDeletingOffer, setIsDeletingOffer] = useState(false);

  const confirmDeleteOffer = async () => {
    if (!offerToDelete) return;
    setIsDeletingOffer(true);
    try {
      try {
        await supabase.from('candidature').delete().eq('offerta_id', offerToDelete.id);
      } catch (e) {
        // Ignora se la colonna offerta_id non esiste
      }

      const { error } = await supabase.from('offerte_lavoro').delete().eq('id', offerToDelete.id);
      if (error) {
        alert(`❌ Impossibile eliminare l'offerta: ${error.message}`);
        console.error('Errore eliminazione offerta:', error);
      } else {
        setOfferte(prev => prev.filter(o => o.id !== offerToDelete.id));
        setOfferToDelete(null);
      }
    } catch (err: any) {
      alert(`❌ Errore: ${err.message || 'Errore eliminazione offerta'}`);
    } finally {
      setIsDeletingOffer(false);
    }
  };

  const toggleAttiva = async (id: string, attiva: boolean) => {
    await supabase.from('offerte_lavoro').update({ attiva: !attiva }).eq('id', id);
    setOfferte(prev => prev.map(o => o.id === id ? { ...o, attiva: !attiva } : o));
  };

  const toggleEvidenza = async (id: string, in_evidenza: boolean) => {
    const { error } = await supabase.from('offerte_lavoro').update({ in_evidenza: !in_evidenza }).eq('id', id);
    if (error) {
      console.error('Errore toggle evidenza:', error);
      alert(`⚠️ Impossibile aggiornare l'evidenza: ${error.message}\nAssicurati di aver eseguito lo script SQL su Supabase per aggiungere la colonna in_evidenza!`);
    } else {
      setOfferte(prev => prev.map(o => o.id === id ? { ...o, in_evidenza: !in_evidenza } : o));
    }
  };

  const copyShareLink = async (offerta: Offerta) => {
    const slug = offerta.slug || offerta.id;
    const url = `${window.location.origin}/offerte/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(offerta.id);
      setTimeout(() => setCopiedSlug(null), 2500);
    } catch {
      window.prompt('Copia questo link:', url);
    }
  };


  // ── Datori di lavoro ─────────────────────────────────────────────────────
  const fetchDatoriRichieste = async () => {
    setLoading(true);
    const { data } = await supabase.from('datori_richieste').select('*').order('created_at', { ascending: false });
    if (data) setDatoriRichieste(data as DatoreRichiesta[]);
    setLoading(false);
  };

  const fetchDatoriGestiti = async () => {
    const { data } = await supabase.from('datori_gestiti').select('*').order('created_at', { ascending: false });
    if (data) setDatoriGestiti(data as DatoreGestito[]);
  };

  const deleteDatoreRichiesta = async (id: string) => {
    await supabase.from('datori_richieste').delete().eq('id', id);
    setDatoriRichieste(prev => prev.filter(d => d.id !== id));
    setSelectedDatoreReq(null);
  };

  const updateDatoreRichiestaStato = async (id: string, stato: string) => {
    await supabase.from('datori_richieste').update({ stato }).eq('id', id);
    setDatoriRichieste(prev => prev.map(d => d.id === id ? { ...d, stato: stato as DatoreRichiesta['stato'] } : d));
    setSelectedDatoreReq(prev => prev ? { ...prev, stato: stato as DatoreRichiesta['stato'] } : null);
  };

  const addDatoreGestito = async () => {
    if (!newDatoreForm.nome_azienda) return;
    setSavingDatore(true);
    await supabase.from('datori_gestiti').insert([{
      nome_azienda: newDatoreForm.nome_azienda,
      nome_referente: newDatoreForm.nome_referente || null,
      email: newDatoreForm.email || null,
      telefono: newDatoreForm.telefono || null,
      settori: newDatoreForm.settori || null,
      note: newDatoreForm.note || null,
    }]);
    await fetchDatoriGestiti();
    setNewDatoreForm({ nome_azienda:'', nome_referente:'', email:'', telefono:'', settori:'', note:'' });
    setShowAddDatoreForm(false);
    setSavingDatore(false);
  };

  const removeDatoreGestito = async (id: string) => {
    if (!window.confirm('Rimuovere questo datore dalla lista gestiti?')) return;
    await supabase.from('datori_gestiti').delete().eq('id', id);
    setDatoriGestiti(prev => prev.filter(d => d.id !== id));
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const candFiltered = candidature.filter(c => {
    const q = candSearch.toLowerCase();
    const matchSearch = !candSearch || `${c.nome} ${c.cognome} ${c.email}`.toLowerCase().includes(q);
    const matchStato = candFiltroStato === 'tutti' || c.stato === candFiltroStato;
    return matchSearch && matchStato;
  });

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Panoramica', icon: 'fa-chart-bar' },
    { key: 'candidature', label: 'Candidature', icon: 'fa-file-alt' },
    { key: 'datori', label: 'Datori', icon: 'fa-building' },
    { key: 'requests', label: 'Contatti', icon: 'fa-envelope' },
    { key: 'offerte', label: 'Offerte', icon: 'fa-briefcase' },
    { key: 'users', label: 'Utenti', icon: 'fa-users' },
  ];

  const sidebarStyle: React.CSSProperties = {
    width: '240px',
    minHeight: '100vh',
    background: 'var(--card-bg)',
    borderRight: '1px solid var(--line-soft)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="dash" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Sidebar — desktop always visible, mobile = slide-in drawer */}
      <aside style={{
        ...sidebarStyle,
        position: isMobileMenuOpen ? 'fixed' : undefined,
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
        transform: typeof window !== 'undefined' && window.innerWidth < 768 && !isMobileMenuOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.3s ease',
        // su desktop non fixed
      }} className={`admin-sidebar${isMobileMenuOpen ? ' open' : ''}`}>
        {/* Brand */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'var(--primary)',
            border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i className="fas fa-shield-alt" style={{ color: '#fff', fontSize: '16px' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '-0.01em', color: 'var(--text-color)' }}>
              LBS Admin
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>
              PANNELLO DI CONTROLLO
            </div>
          </div>
        </div>

        {/* Admin profile */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '44px', height: '44px',
            background: '#FF6B35',
            border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            color: '#fff',
            fontSize: '15px',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#FF6B35',
            }}>
              ★ Administrator
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: activeTab === tab.key ? 'var(--primary)' : 'transparent',
                border: activeTab === tab.key ? '1px solid var(--line)' : '1px solid transparent',
                boxShadow: activeTab === tab.key ? 'var(--shadow-soft)' : 'none',
                color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                marginBottom: '8px',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-inter)',
              }}
            >
              <i className={`fas ${tab.icon}`} style={{ width: '16px', textAlign: 'center' }} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--line-soft)' }}>
          <button
            onClick={() => { setShowPwdModal(true); setPwdError(null); setPwdSuccess(false); setAdminCurrentPwd(''); setAdminNewPwd(''); setAdminConfirmPwd(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '10px 16px',
              background: 'transparent', border: 'none',
              color: 'var(--text-color)', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', marginBottom: '8px', textAlign: 'left',
              fontFamily: 'var(--font-inter)',
            }}
          >
            <i className="fas fa-key" style={{ color: 'var(--primary)' }} /> Cambia Password
          </button>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '10px 16px',
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', marginBottom: '8px', textAlign: 'left',
              fontFamily: 'var(--font-inter)',
            }}>
              <i className="fas fa-globe" /> Vai al Sito
            </button>
          </Link>
          <button
            id="admin-logout-btn"
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '10px 16px',
              background: 'transparent', border: 'none',
              color: '#dc2626', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-inter)',
            }}
          >
            <i className="fas fa-sign-out-alt" /> Disconnetti
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '24px 16px', overflowX: 'hidden', paddingBottom: '80px' }} className="admin-main">

        {/* Mobile top bar */}
        <div className="admin-mobile-topbar" style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--line-soft)',
        }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', textTransform: 'uppercase', color: 'var(--text-color)' }}>
            {tabs.find(t => t.key === activeTab)?.label || 'Dashboard'}
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            style={{ width: '40px', height: '40px', background: 'var(--primary)', border: '1px solid var(--line)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
          >
            <i className="fas fa-bars" />
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ marginBottom: '36px' }}>
              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                color: 'var(--text-color)',
                margin: '0 0 8px',
              }}>
                Benvenuto, {displayName}! 🛡️
              </h1>
              <p style={{ color: 'var(--text-muted)', fontWeight: 500, margin: 0 }}>
                Pannello di amministrazione LBS — Tutto sotto controllo.
              </p>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              {[
                              { icon: 'fa-file-alt', label: 'Candidature', value: candidature.length || '—', color: '#6E4274' },
                { icon: 'fa-envelope', label: 'Messaggi Contatto', value: requests.length || '—', color: 'var(--primary)' },
                { icon: 'fa-briefcase', label: 'Offerte Attive', value: offerte.filter(o => o.attiva).length || '—', color: '#FF6B35' },
                { icon: 'fa-users', label: 'Utenti Registrati', value: users.length || '—', color: '#0066CC' },
              ].map((stat, i) => (
                <div key={i} className="comic-card" style={{ padding: '28px 24px', textAlign: 'center' }}>
                  <div style={{
                    width: '52px', height: '52px',
                    background: stat.color,
                    border: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <i className={`fas ${stat.icon}`} style={{ color: '#fff', fontSize: '20px' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2rem', color: 'var(--text-color)', letterSpacing: '-0.03em' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '4px' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '-0.01em', color: 'var(--text-color)', marginBottom: '20px' }}>
              Azioni Rapide
            </h2>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <button onClick={() => setActiveTab('candidature')} className="comic-button" style={{ background: 'var(--primary)', color: '#fff', padding: '14px 24px', fontSize: '12px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-file-alt" /> Vedi Candidature
              </button>
              <button onClick={() => setActiveTab('offerte')} className="comic-button" style={{ padding: '14px 24px', fontSize: '12px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-briefcase" /> Gestisci Offerte
              </button>
              <button onClick={() => setActiveTab('requests')} className="comic-button" style={{ padding: '14px 24px', fontSize: '12px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-envelope" /> Messaggi
              </button>
              <button onClick={() => setActiveTab('users')} className="comic-button" style={{ padding: '14px 24px', fontSize: '12px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-users" /> Gestisci Utenti
              </button>
              <button onClick={() => { setShowPwdModal(true); setPwdError(null); setPwdSuccess(false); setAdminCurrentPwd(''); setAdminNewPwd(''); setAdminConfirmPwd(''); }} className="comic-button" style={{ background: '#3D2045', color: '#fff', padding: '14px 24px', fontSize: '12px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-key" /> Cambia Password
              </button>
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.03em', color: 'var(--text-color)', margin: '0 0 4px' }}>
                  Richieste di Contatto
                </h1>
                <p style={{ color: 'var(--text-muted)', fontWeight: 500, margin: 0, fontSize: '14px' }}>
                  {requests.length} richieste ricevute
                </p>
              </div>
              <button onClick={fetchRequests} className="comic-button" style={{ padding: '10px 20px', fontSize: '12px', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-sync-alt" /> Aggiorna
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '16px', display: 'block' }} />
                Caricamento...
              </div>
            ) : requests.length === 0 ? (
              <div className="comic-card" style={{ padding: '60px', textAlign: 'center' }}>
                <i className="fas fa-inbox" style={{ fontSize: '48px', color: 'var(--text-muted)', marginBottom: '16px', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontWeight: 700, margin: 0 }}>Nessuna richiesta ricevuta ancora.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {requests.map(req => (
                  <div key={req.id} className="comic-card" style={{
                    padding: '24px 28px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                    onClick={() => setSelectedRequest(req)}
                  >
                    <div style={{
                      width: '48px', height: '48px', flexShrink: 0,
                      background: 'var(--primary)',
                      border: '1px solid var(--line)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-heading)', fontWeight: 700,
                      color: '#fff', fontSize: '16px',
                    }}>
                      {req.nome.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-color)', marginBottom: '4px' }}>{req.nome}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '8px' }}>{req.email} {req.telefono && `• ${req.telefono}`}</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-color)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.messaggio}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatDate(req.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detail Modal */}
            {selectedRequest && (
              <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(6px)',
                zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '24px',
              }} onClick={() => setSelectedRequest(null)}>
                <div className="comic-card" style={{
                  width: '100%', maxWidth: '560px',
                  padding: '40px',
                  background: 'var(--card-bg)',
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', color: 'var(--text-color)', margin: '0 0 4px' }}>
                        {selectedRequest.nome}
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {formatDate(selectedRequest.created_at)}
                      </div>
                    </div>
                    <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px' }}>
                      <i className="fas fa-times" />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <i className="fas fa-envelope" style={{ color: 'var(--primary)', width: '16px' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '14px' }}>{selectedRequest.email}</span>
                    </div>
                    {selectedRequest.telefono && (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <i className="fas fa-phone" style={{ color: 'var(--primary)', width: '16px' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '14px' }}>{selectedRequest.telefono}</span>
                      </div>
                    )}
                    <div style={{ border: '1px solid var(--line)', padding: '20px', marginTop: '8px', background: 'var(--bg-color)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '8px' }}>Messaggio</div>
                      <p style={{ color: 'var(--text-color)', fontWeight: 500, margin: 0, lineHeight: 1.6 }}>{selectedRequest.messaggio}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <a href={`mailto:${selectedRequest.email}`} style={{ textDecoration: 'none', flex: 1 }}>
                      <button className="comic-button" style={{ background: 'var(--primary)', color: '#fff', width: '100%', padding: '14px', fontSize: '12px', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <i className="fas fa-reply" /> RISPONDI
                      </button>
                    </a>
                    <button onClick={() => deleteRequest(selectedRequest.id)} className="comic-button" style={{ background: '#dc2626', border: '1px solid var(--line)', color: '#fff', padding: '14px 20px', fontSize: '12px', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.03em', color: 'var(--text-color)', margin: '0 0 4px' }}>
                Utenti Registrati
              </h1>
              <p style={{ color: 'var(--text-muted)', fontWeight: 500, margin: 0, fontSize: '14px' }}>
                {users.length} utenti totali
              </p>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '16px', display: 'block' }} /> Caricamento...
              </div>
            ) : users.length === 0 ? (
              <div className="comic-card" style={{ padding: '60px', textAlign: 'center' }}>
                <i className="fas fa-user-slash" style={{ fontSize: '48px', color: 'var(--text-muted)', marginBottom: '16px', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontWeight: 700, margin: 0 }}>Nessun utente ancora.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {users.map(u => (
                  <div key={u.id} className="comic-card" style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                      width: '44px', height: '44px', flexShrink: 0,
                      background: u.role === 'admin' ? '#FF6B35' : 'var(--primary)',
                      border: '1px solid var(--line)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-heading)', fontWeight: 700,
                      color: '#fff', fontSize: '14px',
                    }}>
                      {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-color)' }}>{u.full_name || 'Senza nome'}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{u.email}</div>
                    </div>
                    <div style={{
                      padding: '4px 12px',
                      background: u.role === 'admin' ? '#FF6B35' : 'var(--primary)',
                      border: '1px solid var(--line)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}>
                      {u.role}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {u.created_at ? formatDate(u.created_at) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CANDIDATURE TAB ──────────────────────────────── */}
        {activeTab === 'candidature' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'16px' }}>
              <div>
                <h1 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'2rem', textTransform:'uppercase', letterSpacing:'-0.03em', color:'var(--text-color)', margin:'0 0 4px' }}>Candidature</h1>
                <p style={{ color:'var(--text-muted)', fontWeight:500, margin:0, fontSize:'14px' }}>{candidature.length} totali &middot; {candFiltered.length} visualizzate</p>
              </div>
              <button onClick={fetchCandidature} className="comic-button" style={{ padding:'10px 20px', fontSize:'12px', letterSpacing:'0.1em', display:'flex', alignItems:'center', gap:'8px' }}>
                <i className="fas fa-sync-alt" /> Aggiorna
              </button>
            </div>

            {/* Ricerca + Filtri stato */}
            <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
              <div style={{ position:'relative', flex:1, minWidth:'220px' }}>
                <i className="fas fa-search" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'13px', pointerEvents:'none' }} />
                <input
                  type="text"
                  placeholder="Cerca nome, cognome, email..."
                  value={candSearch}
                  onChange={e => setCandSearch(e.target.value)}
                  style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 12px 10px 36px', fontWeight:600, fontSize:'13px', outline:'none', boxSizing:'border-box' }}
                />
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
                {['tutti', 'nuova', 'in_lavorazione', 'completata', 'rifiutata'].map(s => {
                  const info: { label: string; color: string } = s === 'tutti' ? { label:'Tutti', color:'var(--primary)' } : STATO_LABELS[s];
                  return (
                    <button key={s} onClick={() => setCandFiltroStato(s)}
                      style={{ padding:'7px 12px', border:`3px solid ${info.color}`, background: candFiltroStato === s ? info.color : 'transparent', color: candFiltroStato === s ? '#fff' : info.color, fontSize:'10px', fontWeight: 700, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', transition:'all 0.15s' }}>
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" style={{ fontSize:'32px', marginBottom:'16px', display:'block' }} />Caricamento...</div>
            ) : candFiltered.length === 0 ? (
              <div className="comic-card" style={{ padding:'60px', textAlign:'center' }}>
                <i className="fas fa-file-alt" style={{ fontSize:'48px', color:'var(--text-muted)', marginBottom:'16px', display:'block' }} />
                <p style={{ color:'var(--text-muted)', fontWeight:700, margin:0 }}>{candidature.length === 0 ? 'Nessuna candidatura ancora.' : 'Nessun risultato. Modifica i filtri.'}</p>
              </div>
            ) : (
              <div style={{ display:'grid', gap:'12px' }}>
                {candFiltered.map(c => {
                  const s = STATO_LABELS[c.stato] || STATO_LABELS.nuova;
                  return (
                    <div key={c.id} className="comic-card" style={{ padding:'20px 28px', display:'flex', alignItems:'center', gap:'20px', cursor:'pointer' }} onClick={() => { setSelectedCand(c); setCandNote(c.note_admin || ''); }}>
                      <div style={{ width:'48px', height:'48px', flexShrink:0, background:s.color, border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 700, fontSize:'16px' }}>
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight: 700, fontSize:'16px', color:'var(--text-color)', marginBottom:'2px' }}>{c.nome} {c.cognome}</div>
                        <div style={{ fontSize:'13px', color:'var(--text-muted)', fontWeight:500 }}>
                          {c.email}{c.telefono && ` • ${c.telefono}`}
                          {c.offerta_titolo && <span style={{ color:'var(--primary)', fontWeight:700 }}> • 🎯 {c.offerta_titolo}</span>}
                        </div>
                      </div>
                      {!c.offerta_titolo && (
                        <div style={{ padding:'3px 8px', background:'transparent', border:'1px solid #F97316', color:'#F97316', fontSize:'9px', fontWeight: 700, letterSpacing:'0.1em', textTransform:'uppercase', whiteSpace:'nowrap', flexShrink:0 }}>
                          Senza Offerta
                        </div>
                      )}
                      <div style={{ padding:'4px 10px', background:s.color, border:'1px solid var(--line)', color:'#fff', fontSize:'10px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{s.label}</div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:600, whiteSpace:'nowrap' }}>{formatDate(c.created_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Candidatura modal */}
            {selectedCand && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setSelectedCand(null)}>
                <div className="comic-card admin-modal-content" style={{ width:'100%', maxWidth:'700px', maxHeight:'90vh', overflowY:'auto', padding:'40px', background:'var(--card-bg)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
                    <div>
                      <h3 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'1.6rem', textTransform:'uppercase', color:'var(--text-color)', margin:'0 0 4px' }}>{selectedCand.nome} {selectedCand.cognome}</h3>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:600 }}>{formatDate(selectedCand.created_at)}</div>
                    </div>
                    <button onClick={() => setSelectedCand(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'20px' }}><i className="fas fa-times" /></button>
                  </div>

                  {/* Offerta di riferimento */}
                  {selectedCand.offerta_titolo && (
                    <div style={{ border:'1px solid var(--primary)', padding:'12px 16px', marginBottom:'16px', background:'var(--bg-color)', display:'flex', alignItems:'center', gap:'12px' }}>
                      <i className="fas fa-briefcase" style={{ color:'var(--primary)', fontSize:'18px' }} />
                      <div>
                        <div style={{ fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)' }}>Offerta candidata</div>
                        <div style={{ fontWeight: 700, color:'var(--text-color)', fontSize:'14px' }}>{selectedCand.offerta_titolo}</div>
                      </div>
                    </div>
                  )}

                  {/* Contatti */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', gap:'12px' }}><i className="fas fa-envelope" style={{ color:'var(--primary)', width:'16px', marginTop:'2px' }} /><span style={{ fontWeight:600, color:'var(--text-color)', fontSize:'14px' }}>{selectedCand.email}</span></div>
                    {selectedCand.telefono && <div style={{ display:'flex', gap:'12px' }}><i className="fas fa-phone" style={{ color:'var(--primary)', width:'16px', marginTop:'2px' }} /><span style={{ fontWeight:600, color:'var(--text-color)', fontSize:'14px' }}>{selectedCand.telefono}</span></div>}
                  </div>

                  {/* Dati candidato */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
                    {[
                      { icon:'fa-birthday-cake', label:'Data Nascita', value: selectedCand.data_nascita ? new Date(selectedCand.data_nascita + 'T00:00:00').toLocaleDateString('it-IT') : null },
                      { icon:'fa-flag', label:'Cittadinanza', value: selectedCand.cittadinanza },
                      { icon:'fa-map-marker-alt', label:'Paese Residenza', value: selectedCand.paese_residenza },
                      { icon:'fa-industry', label:'Settore', value: selectedCand.settore },
                      { icon:'fa-language', label:'Tedesco', value: selectedCand.livello_tedesco },
                      { icon:'fa-language', label:'Inglese', value: selectedCand.livello_inglese },
                      { icon:'fa-clock', label:'Esperienza', value: selectedCand.anni_esperienza },
                      { icon:'fa-car', label:'Patente', value: selectedCand.patente },
                      { icon:'fa-calendar-check', label:'Disponibilità', value: selectedCand.disponibilita },
                    ].filter(f => f.value).map((f, i) => (
                      <div key={i} style={{ border:'1px solid var(--line)', padding:'8px 12px', background:'var(--bg-color)' }}>
                        <div style={{ fontSize:'9px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'3px' }}>
                          <i className={`fas ${f.icon}`} style={{ marginRight:'5px' }} />{f.label}
                        </div>
                        <div style={{ fontWeight:700, color:'var(--text-color)', fontSize:'13px' }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Lettera di presentazione */}
                  {selectedCand.messaggio && (
                    <div style={{ border:'1px solid var(--line)', padding:'16px', background:'var(--bg-color)', marginBottom:'16px' }}>
                      <div style={{ fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'8px' }}>Lettera di Presentazione</div>
                      <p style={{ color:'var(--text-color)', fontWeight:500, margin:0, lineHeight:1.6 }}>{selectedCand.messaggio}</p>
                    </div>
                  )}

                  <div style={{ marginBottom:'20px' }}>
                    <label style={{ display:'block', fontSize:'11px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'8px' }}>Stato Candidatura</label>
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      {Object.entries(STATO_LABELS).map(([key, val]) => (
                        <button key={key} onClick={() => setSelectedCand({...selectedCand, stato: key as Candidatura['stato']})}
                          style={{ padding:'6px 14px', background: selectedCand.stato === key ? val.color : 'transparent', border:`3px solid ${val.color}`, color: selectedCand.stato === key ? '#fff' : val.color, fontSize:'11px', fontWeight: 700, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                          {val.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom:'24px' }}>
                    <label style={{ display:'block', fontSize:'11px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'8px' }}>Note Admin</label>
                    <textarea value={candNote} onChange={e => setCandNote(e.target.value)} rows={3}
                      style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'12px', fontWeight:600, fontSize:'14px', resize:'none', outline:'none', boxSizing:'border-box' }}
                      placeholder="Note interne (non visibili al candidato)..." />
                  </div>
                  <div style={{ display:'flex', gap:'12px' }}>
                    <button onClick={() => updateCandidatura(selectedCand.id, selectedCand.stato, candNote)} className="comic-button" style={{ flex:1, background:'var(--primary)', color:'#fff', padding:'14px', fontSize:'12px', letterSpacing:'0.15em', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                      <i className="fas fa-save" /> SALVA
                    </button>
                    <a href={`mailto:${selectedCand.email}`} style={{ textDecoration:'none' }}>
                      <button className="comic-button" style={{ padding:'14px 18px', fontSize:'12px', display:'flex', alignItems:'center', gap:'8px' }}><i className="fas fa-reply" /></button>
                    </a>
                    <button onClick={() => deleteCandidatura(selectedCand.id)} className="comic-button" style={{ background:'#dc2626', border:'1px solid var(--line)', color:'#fff', padding:'14px 18px', fontSize:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OFFERTE TAB ───────────────────────────────────── */}
        {activeTab === 'offerte' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'32px', flexWrap:'wrap', gap:'16px' }}>
              <div>
                <h1 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'2rem', textTransform:'uppercase', letterSpacing:'-0.03em', color:'var(--text-color)', margin:'0 0 4px' }}>Offerte di Lavoro</h1>
                <p style={{ color:'var(--text-muted)', fontWeight:500, margin:0, fontSize:'14px' }}>{offerte.length} offerte totali</p>
              </div>
              <button onClick={openNewOffer} className="comic-button" style={{ background:'var(--primary)', color:'#fff', padding:'12px 24px', fontSize:'12px', letterSpacing:'0.15em', display:'flex', alignItems:'center', gap:'10px' }}>
                <i className="fas fa-plus" /> NUOVA OFFERTA
              </button>
            </div>

            {/* Banner Feed XML per Jooble */}
            <div className="comic-card" style={{ padding:'16px 20px', marginBottom:'24px', background:'var(--card-bg)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <div style={{ width:'40px', height:'40px', background:'#25D366', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', border:'1px solid var(--line)', flexShrink:0 }}>
                  <i className="fas fa-rss" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize:'14px', textTransform:'uppercase', color:'var(--text-color)' }}>
                    Feed XML per Jooble (jooble.org / de.jooble.org)
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'monospace', marginTop:'2px' }}>
                    https://www.lbswork.com/jooble.xml
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('https://www.lbswork.com/jooble.xml');
                    setCopiedJooble(true);
                    setTimeout(() => setCopiedJooble(false), 2500);
                  }}
                  className="comic-button"
                  style={{ padding:'8px 16px', fontSize:'11px', letterSpacing:'0.1em', background: copiedJooble ? '#25D366' : 'var(--primary)', color:'#fff' }}
                >
                  <i className={`fas ${copiedJooble ? 'fa-check' : 'fa-copy'}`} style={{ marginRight:'6px' }} />
                  {copiedJooble ? 'COPIATO!' : 'COPIA LINK FEED'}
                </button>
                <a
                  href="/jooble.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="comic-button"
                  style={{ padding:'8px 16px', fontSize:'11px', letterSpacing:'0.1em', background:'transparent', color:'var(--text-color)', border:'1px solid var(--line)', textDecoration:'none' }}
                >
                  <i className="fas fa-external-link-alt" style={{ marginRight:'6px' }} /> APRI XML
                </a>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'60px', color:'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" style={{ fontSize:'32px', marginBottom:'16px', display:'block' }} />Caricamento...</div>
            ) : offerte.length === 0 ? (
              <div className="comic-card" style={{ padding:'60px', textAlign:'center' }}>
                <i className="fas fa-briefcase" style={{ fontSize:'48px', color:'var(--text-muted)', marginBottom:'16px', display:'block' }} />
                <p style={{ color:'var(--text-muted)', fontWeight:700, margin:0 }}>Nessuna offerta ancora. Aggiungine una!</p>
              </div>
            ) : (
              <div style={{ display:'grid', gap:'12px' }}>
                {offerte.map(o => (
                  <div key={o.id} className="comic-card" style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
                    {/* Thumbnail o icona */}
                    {o.immagine_url ? (
                      <img src={o.immagine_url} alt={o.titolo} style={{ width:'56px', height:'56px', objectFit:'cover', border:'1px solid var(--line)', flexShrink:0 }} />
                    ) : (
                      <div style={{ width:'56px', height:'56px', flexShrink:0, background: o.attiva ? '#25D366' : '#999', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'22px' }}>
                        <i className="fas fa-briefcase" />
                      </div>
                    )}

                    {/* Info offerta */}
                    <div style={{ flex:1, minWidth:'160px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'2px' }}>
                        <span style={{ fontWeight: 700, fontSize:'15px', color:'var(--text-color)' }}>{o.titolo}</span>
                        {o.in_evidenza && (
                          <span style={{ background:'#F59E0B', color:'#fff', fontSize:'10px', fontWeight: 700, padding:'2px 8px', border:'1px solid var(--line)', letterSpacing:'0.1em' }}>⭐ EVIDENZA</span>
                        )}
                      </div>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:500, display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginTop:'4px' }}>
                        <span>{o.citta}{o.stato_germania ? `, ${o.stato_germania}` : ''} 🇩🇪 • {o.settore} • {o.contratto}</span>
                        {(o.stipendio_min || o.stipendio_max || o.stipendio_modalita === 'concordare') && (
                          <span style={{
                            fontSize:'10px',
                            fontWeight: 700,
                            padding:'2px 8px',
                            border:'1px solid var(--line)',
                            background: o.stipendio_tipo === 'netto' ? '#dcfce7' : '#fef9c3',
                            color: o.stipendio_tipo === 'netto' ? '#166534' : '#854d0e',
                            textTransform:'uppercase',
                            letterSpacing:'0.05em'
                          }}>
                            {o.stipendio_modalita === 'concordare'
                              ? '🤝 Da concordare'
                              : o.stipendio_modalita === 'range' && o.stipendio_min && o.stipendio_max
                                ? `€${o.stipendio_min.toLocaleString('it-IT')} – €${o.stipendio_max.toLocaleString('it-IT')}/m ${o.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}`
                                : o.stipendio_modalita === 'fisso' && o.stipendio_min
                                  ? `€${o.stipendio_min.toLocaleString('it-IT')}/m ${o.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}`
                                  : o.stipendio_min
                                    ? `Da €${o.stipendio_min.toLocaleString('it-IT')}/m ${o.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}`
                                    : 'Stipendio indicato'}
                          </span>
                        )}
                      </div>
                      {o.slug && (
                        <div style={{ fontSize:'11px', color:'var(--primary)', fontWeight:700, marginTop:'2px', fontFamily:'monospace' }}>/offerte/{o.slug}</div>
                      )}
                    </div>

                    {/* Azioni */}
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                      <button onClick={() => toggleEvidenza(o.id, o.in_evidenza)} title={o.in_evidenza ? 'Rimuovi da evidenza' : 'Metti in evidenza'}
                        style={{ padding:'7px 11px', border:'1px solid var(--line)', background: o.in_evidenza ? '#F59E0B' : 'var(--bg-color)', color: o.in_evidenza ? '#fff' : 'var(--text-muted)', fontSize:'13px', cursor:'pointer', transition:'all 0.15s' }}>
                        <i className="fas fa-star" />
                      </button>
                      <button onClick={() => copyShareLink(o)} title="Copia link condivisibile"
                        style={{ padding:'7px 11px', border:'1px solid var(--line)', background: copiedSlug === o.id ? '#25D366' : 'var(--bg-color)', color: copiedSlug === o.id ? '#fff' : 'var(--text-muted)', fontSize:'13px', cursor:'pointer', transition:'all 0.15s' }}>
                        <i className={`fas ${copiedSlug === o.id ? 'fa-check' : 'fa-share-alt'}`} />
                      </button>
                      <button onClick={() => toggleAttiva(o.id, o.attiva)}
                        style={{ padding:'5px 10px', border:'1px solid var(--line)', background: o.attiva ? '#25D366' : '#dc2626', color:'#fff', fontSize:'10px', fontWeight: 700, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', whiteSpace:'nowrap' }}>
                        {o.attiva ? '● ON' : '○ OFF'}
                      </button>
                      <button onClick={() => openEditOffer(o)} style={{ padding:'7px 12px', border:'1px solid var(--line)', background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:'13px' }}><i className="fas fa-edit" /></button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOfferToDelete(o);
                        }}
                        title="Elimina offerta"
                        style={{ padding:'7px 12px', border:'1px solid var(--line)', background:'#dc2626', color:'#fff', cursor:'pointer', fontSize:'13px' }}
                      >
                        <i className="fas fa-trash" style={{ pointerEvents:'none' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            )}

            {/* Modal conferma eliminazione offerta */}
            {offerToDelete && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
                <div className="comic-card" style={{ width:'100%', maxWidth:'460px', padding:'32px', background:'var(--card-bg)', border:'1px solid var(--line)', boxShadow:'var(--shadow-soft)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
                    <div style={{ width:'44px', height:'44px', background:'#fee2e2', border:'1px solid #dc2626', display:'flex', alignItems:'center', justifyContent:'center', color:'#dc2626', fontSize:'20px', flexShrink:0 }}>
                      <i className="fas fa-trash-alt" />
                    </div>
                    <div>
                      <h3 style={{ margin:0, fontSize:'18px', fontWeight: 700, textTransform:'uppercase', color:'var(--text-color)' }}>Elimina Offerta</h3>
                      <p style={{ margin:0, fontSize:'12px', color:'var(--text-muted)' }}>Operazione irreversibile</p>
                    </div>
                  </div>
                  
                  <p style={{ fontSize:'14px', color:'var(--text-color)', marginBottom:'24px', lineHeight:'1.5' }}>
                    Sei sicuro di voler eliminare definitivamente l'offerta <strong>"{offerToDelete.titolo}"</strong> ({offerToDelete.citta})?
                  </p>

                  <div style={{ display:'flex', gap:'12px' }}>
                    <button
                      type="button"
                      onClick={() => setOfferToDelete(null)}
                      disabled={isDeletingOffer}
                      className="comic-button"
                      style={{ flex:1, padding:'12px', background:'transparent', color:'var(--text-color)', fontSize:'12px' }}
                    >
                      ANNULLA
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteOffer}
                      disabled={isDeletingOffer}
                      className="comic-button"
                      style={{ flex:1, padding:'12px', background:'#dc2626', color:'#fff', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', cursor: isDeletingOffer ? 'not-allowed' : 'pointer' }}
                    >
                      {isDeletingOffer ? <><i className="fas fa-spinner fa-spin" /> Eliminazione...</> : <><i className="fas fa-trash" /> CONFERMA ELIMINA</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Offerta form modal */}
            {showOfferForm && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', overflowY:'auto' }}>
                <div className="comic-card" style={{ width:'100%', maxWidth:'700px', maxHeight:'92vh', overflowY:'auto', padding:'40px', background:'var(--card-bg)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'28px' }}>
                    <h3 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'1.5rem', textTransform:'uppercase', color:'var(--text-color)', margin:0 }}>{editingOffer ? 'Modifica Offerta' : 'Nuova Offerta'}</h3>
                    <button onClick={() => setShowOfferForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'20px' }}><i className="fas fa-times" /></button>
                  </div>

                  {/* Titolo */}
                  <div style={{ marginBottom:'16px' }}>
                    <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>Titolo posizione *</label>
                    <input type="text" value={offerForm.titolo} onChange={e => handleTitoloChange(e.target.value)}
                      style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                      placeholder="es. Muratore Qualificato" />
                  </div>

                  {/* Slug + Condivisione */}
                  <div style={{ marginBottom:'16px' }}>
                    <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>
                      Slug URL (auto-generato, modificabile)
                    </label>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                      <span style={{ color:'var(--text-muted)', fontWeight:700, fontSize:'13px', flexShrink:0 }}>/offerte/</span>
                      <input type="text" value={offerForm.slug || ''} onChange={e => setOfferForm(prev => ({ ...prev, slug: e.target.value }))}
                        style={{ flex:1, border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'monospace' }}
                        placeholder="muratore-qualificato-berlino" />
                    </div>
                    <p style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:600, margin:'4px 0 0' }}>
                      💡 Questo sarà il link pubblico condivisibile dell'offerta
                    </p>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                    {[
                      { label:'Azienda', key:'azienda', span:1 },
                      { label:'Città *', key:'citta', span:1 },
                      { label:'Stato (es. Bavaria)', key:'stato_germania', span:1 },
                    ].map(({ label, key, span }) => (
                      <div key={key} style={{ gridColumn: span === 2 ? '1 / -1' : 'auto' }}>
                        <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>{label}</label>
                        <input type="text" value={(offerForm as any)[key] ?? ''} onChange={e => setOfferForm(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
                      </div>
                    ))}
                  </div>

                  {/* === SEZIONE STIPENDIO === */}
                  <div style={{ marginBottom:'18px', border:'1px solid var(--line)', padding:'18px', background:'var(--card-bg)', boxShadow:'var(--shadow-soft)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', borderBottom:'1px solid var(--line-soft)', paddingBottom:'8px' }}>
                      <label style={{ fontSize:'12px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--primary)', display:'flex', alignItems:'center', gap:'8px', margin:0 }}>
                        <i className="fas fa-money-bill-wave" style={{ color:'#25D366' }} /> Specifiche Stipendio
                      </label>
                      <span style={{ fontSize:'10px', fontWeight:800, textTransform:'uppercase', color:'var(--text-muted)' }}>
                        Configura Range e Tipo
                      </span>
                    </div>

                    {/* 1. SELEZIONE TIPO: LORDO vs NETTO */}
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'6px' }}>
                        1. Tipologia Stipendio (Lordo o Netto) *
                      </label>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        <button
                          type="button"
                          onClick={() => setOfferForm(prev => ({ ...prev, stipendio_tipo: 'lordo' }))}
                          style={{
                            padding:'10px 14px',
                            fontWeight: 700,
                            fontSize:'13px',
                            textTransform:'uppercase',
                            letterSpacing:'0.05em',
                            border:'1px solid var(--line)',
                            cursor:'pointer',
                            transition:'all 0.15s',
                            display:'flex',
                            flexDirection:'column',
                            alignItems:'center',
                            gap:'2px',
                            background: offerForm.stipendio_tipo === 'lordo' ? '#3D2045' : 'var(--bg-color)',
                            color: offerForm.stipendio_tipo === 'lordo' ? '#ffdf20' : 'var(--text-color)',
                            boxShadow: offerForm.stipendio_tipo === 'lordo' ? '3px 3px 0px #ffdf20' : 'none'
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <i className="fas fa-file-invoice-dollar" />
                            <span>Stipendio Lordo</span>
                          </div>
                          <span style={{ fontSize:'10px', opacity:0.8, textTransform:'none', fontWeight:600 }}>Prima delle imposte</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOfferForm(prev => ({ ...prev, stipendio_tipo: 'netto' }))}
                          style={{
                            padding:'10px 14px',
                            fontWeight: 700,
                            fontSize:'13px',
                            textTransform:'uppercase',
                            letterSpacing:'0.05em',
                            border:'1px solid var(--line)',
                            cursor:'pointer',
                            transition:'all 0.15s',
                            display:'flex',
                            flexDirection:'column',
                            alignItems:'center',
                            gap:'2px',
                            background: offerForm.stipendio_tipo === 'netto' ? '#25D366' : 'var(--bg-color)',
                            color: offerForm.stipendio_tipo === 'netto' ? '#fff' : 'var(--text-color)',
                            boxShadow: offerForm.stipendio_tipo === 'netto' ? '3px 3px 0px #3D2045' : 'none'
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <i className="fas fa-wallet" />
                            <span>Stipendio Netto</span>
                          </div>
                          <span style={{ fontSize:'10px', opacity:0.8, textTransform:'none', fontWeight:600 }}>In busta paga effettivo</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. SELEZIONE MODALITÀ: RANGE vs FISSO vs A PARTIRE DA vs CONCORDARE */}
                    <div style={{ marginBottom:'14px' }}>
                      <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'6px' }}>
                        2. Modalità (Range, Importo Fisso o A Partire Da) *
                      </label>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:'6px' }}>
                        {[
                          { value: 'range', label: 'Range Min – Max', icon: 'fa-arrows-alt-h' },
                          { value: 'fisso', label: 'Importo Fisso', icon: 'fa-check' },
                          { value: 'a_partire_da', label: 'A partire da', icon: 'fa-level-up-alt' },
                          { value: 'concordare', label: 'Da concordare', icon: 'fa-handshake' },
                        ].map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setOfferForm(prev => ({ ...prev, stipendio_modalita: m.value }))}
                            style={{
                              padding:'8px 10px',
                              fontWeight: offerForm.stipendio_modalita === m.value ? 900 : 700,
                              fontSize:'11px',
                              textTransform:'uppercase',
                              letterSpacing:'0.05em',
                              border:'1px solid var(--line)',
                              cursor:'pointer',
                              transition:'all 0.15s',
                              display:'flex',
                              alignItems:'center',
                              justifyContent:'center',
                              gap:'6px',
                              background: offerForm.stipendio_modalita === m.value ? 'var(--primary)' : 'var(--bg-color)',
                              color: offerForm.stipendio_modalita === m.value ? '#fff' : 'var(--text-color)'
                            }}
                          >
                            <i className={`fas ${m.icon}`} />
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. CAMPI IMPORTO */}
                    {offerForm.stipendio_modalita !== 'concordare' ? (
                      <div style={{ display:'grid', gridTemplateColumns: offerForm.stipendio_modalita === 'range' ? '1fr 1fr' : '1fr', gap:'12px', marginBottom:'10px' }}>
                        <div>
                          <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>
                            {offerForm.stipendio_modalita === 'range' ? 'Stipendio Minimo (€/mese)' : offerForm.stipendio_modalita === 'fisso' ? 'Importo Fisso (€/mese)' : 'A partire da (€/mese)'}
                          </label>
                          <input
                            type="number"
                            value={offerForm.stipendio_min ?? ''}
                            onChange={e => setOfferForm(prev => ({ ...prev, stipendio_min: e.target.value ? Number(e.target.value) : null }))}
                            style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:700, fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                            placeholder="es. 2000"
                          />
                        </div>

                        {offerForm.stipendio_modalita === 'range' && (
                          <div>
                            <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>
                              Stipendio Massimo (€/mese)
                            </label>
                            <input
                              type="number"
                              value={offerForm.stipendio_max ?? ''}
                              onChange={e => setOfferForm(prev => ({ ...prev, stipendio_max: e.target.value ? Number(e.target.value) : null }))}
                              style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:700, fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                              placeholder="es. 2500"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding:'12px', background:'var(--bg-color)', border:'1px dashed var(--plum-200, #DCCCE0)', textAlign:'center', color:'var(--text-muted)', fontSize:'12px', fontWeight:700, marginBottom:'10px' }}>
                        🤝 Lo stipendio verrà mostrato come <strong>"Da concordare in sede di colloquio"</strong>.
                      </div>
                    )}

                    {/* 4. ANTEPRIMA LIVE */}
                    <div style={{ background:'var(--bg-color)', border:'1px solid var(--line)', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                      <span style={{ fontSize:'11px', fontWeight: 700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-muted)' }}>
                        👁️ Anteprima sul sito:
                      </span>
                      <span style={{ fontSize:'13px', fontWeight: 700, color: offerForm.stipendio_tipo === 'netto' ? '#25D366' : 'var(--primary)', background: offerForm.stipendio_tipo === 'netto' ? 'rgba(37,211,102,0.1)' : 'rgba(110,66,116,0.1)', padding:'4px 10px', border:'1px solid currentColor' }}>
                        {offerForm.stipendio_modalita === 'concordare'
                          ? 'Stipendio da concordare'
                          : offerForm.stipendio_modalita === 'range'
                            ? (offerForm.stipendio_min && offerForm.stipendio_max
                                ? `€${offerForm.stipendio_min.toLocaleString('it-IT')} – €${offerForm.stipendio_max.toLocaleString('it-IT')}/mese ${offerForm.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}`
                                : offerForm.stipendio_min
                                  ? `Da €${offerForm.stipendio_min.toLocaleString('it-IT')}/mese ${offerForm.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}`
                                  : 'Da concordare')
                            : offerForm.stipendio_modalita === 'fisso'
                              ? (offerForm.stipendio_min
                                  ? `€${offerForm.stipendio_min.toLocaleString('it-IT')}/mese ${offerForm.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}`
                                  : 'Da concordare')
                              : (offerForm.stipendio_min
                                  ? `Da €${offerForm.stipendio_min.toLocaleString('it-IT')}/mese ${offerForm.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}`
                                  : 'Da concordare')}
                      </span>
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
                    <div>
                      <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>Settore *</label>
                      <select value={offerForm.settore} onChange={e => setOfferForm(prev => ({ ...prev, settore: e.target.value }))} style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'14px', outline:'none', boxSizing:'border-box' }}>
                        {SETTORI_OPT.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>Contratto *</label>
                      <select value={offerForm.contratto} onChange={e => setOfferForm(prev => ({ ...prev, contratto: e.target.value }))} style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'14px', outline:'none', boxSizing:'border-box' }}>
                        {CONTRATTI_OPT.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom:'16px' }}>
                    <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>Descrizione *</label>
                    <textarea value={offerForm.descrizione} onChange={e => setOfferForm(prev => ({ ...prev, descrizione: e.target.value }))} rows={5}
                      style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'14px', resize:'vertical', outline:'none', boxSizing:'border-box' }}
                      placeholder="Descrivi la posizione, le mansioni, l'ambiente di lavoro..." />
                  </div>

                  <div style={{ marginBottom:'16px' }}>
                    <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>Requisiti</label>
                    <textarea value={offerForm.requisiti || ''} onChange={e => setOfferForm(prev => ({ ...prev, requisiti: e.target.value }))} rows={3}
                      style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'14px', resize:'vertical', outline:'none', boxSizing:'border-box' }}
                      placeholder="Inserisci ogni requisito su una riga separata..." />
                    <p style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:600, margin:'4px 0 0' }}>💡 Un requisito per riga — appariranno come lista nella pagina pubblica</p>
                  </div>

                  {/* Upload Immagine */}
                  <div style={{ marginBottom:'16px', border:'1px dashed var(--plum-200, #DCCCE0)', padding:'16px', background:'var(--bg-color)' }}>
                    <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'10px' }}>
                      <i className="fas fa-image" style={{ marginRight:'6px' }} /> Immagine Annuncio
                    </label>
                    {imagePreview && (
                      <div style={{ marginBottom:'12px', position:'relative' }}>
                        <img src={imagePreview} alt="Anteprima" style={{ width:'100%', height:'160px', objectFit:'cover', border:'1px solid var(--line)' }} />
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImagePreview(null); setOfferForm(prev => ({ ...prev, immagine_url: null })); }}
                          style={{ position:'absolute', top:'8px', right:'8px', background:'#dc2626', border:'1px solid #fff', color:'#fff', width:'28px', height:'28px', cursor:'pointer', fontWeight: 700, fontSize:'12px' }}
                        >✕</button>
                      </div>
                    )}
                    <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', padding:'10px 14px', border:'1px solid var(--line)', background:'var(--card-bg)', fontWeight:700, fontSize:'13px', color:'var(--text-color)' }}>
                      <i className="fas fa-upload" style={{ color:'var(--primary)' }} />
                      {imageFile ? imageFile.name : 'Seleziona immagine (JPG, PNG, WebP)'}
                      <input type="file" accept="image/*" onChange={handleImageChange} style={{ display:'none' }} />
                    </label>
                    {uploadingImage && <p style={{ fontSize:'12px', color:'var(--primary)', fontWeight:700, margin:'8px 0 0' }}>⬆️ Upload in corso...</p>}
                  </div>

                  {/* Toggle Attiva + In Evidenza */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'24px' }}>
                    <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                      <input type="checkbox" id="attiva-check" checked={offerForm.attiva} onChange={e => setOfferForm(prev => ({ ...prev, attiva: e.target.checked }))} style={{ width:'18px', height:'18px', cursor:'pointer' }} />
                      <label htmlFor="attiva-check" style={{ fontWeight:700, color:'var(--text-color)', cursor:'pointer', fontSize:'14px' }}>
                        <i className="fas fa-eye" style={{ marginRight:'8px', color:'var(--primary)' }} />Offerta attiva (visibile sul sito)
                      </label>
                    </div>
                    <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                      <input type="checkbox" id="evidenza-check" checked={offerForm.in_evidenza} onChange={e => setOfferForm(prev => ({ ...prev, in_evidenza: e.target.checked }))} style={{ width:'18px', height:'18px', cursor:'pointer' }} />
                      <label htmlFor="evidenza-check" style={{ fontWeight:700, color:'var(--text-color)', cursor:'pointer', fontSize:'14px' }}>
                        <i className="fas fa-star" style={{ marginRight:'8px', color:'#F59E0B' }} />In Evidenza sulla Homepage (carosello principale)
                      </label>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'12px' }}>
                    <button onClick={saveOfferta} disabled={savingOffer || !offerForm.titolo || !offerForm.citta || !offerForm.descrizione} className="comic-button" style={{ flex:1, background:'var(--primary)', color:'#fff', padding:'14px', fontSize:'12px', letterSpacing:'0.15em', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: savingOffer ? 0.7 : 1 }}>
                      <i className={savingOffer ? 'fas fa-spinner fa-spin' : 'fas fa-save'} /> {savingOffer ? 'SALVATAGGIO...' : 'SALVA OFFERTA'}
                    </button>
                    <button onClick={() => setShowOfferForm(false)} style={{ padding:'14px 24px', border:'1px solid var(--line)', background:'transparent', color:'var(--text-muted)', fontWeight: 700, fontSize:'12px', letterSpacing:'0.1em', cursor:'pointer' }}>
                      ANNULLA
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DATORI DI LAVORO TAB ─────────────────────────────────────── */}
        {activeTab === 'datori' && (
          <div>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'16px' }}>
              <div>
                <h1 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'2rem', textTransform:'uppercase', letterSpacing:'-0.03em', color:'var(--text-color)', margin:'0 0 4px' }}>Datori di Lavoro</h1>
                <p style={{ color:'var(--text-muted)', fontWeight:500, margin:0, fontSize:'14px' }}>{datoriRichieste.length} richieste &middot; {datoriGestiti.length} gestiti</p>
              </div>
              <button onClick={() => { fetchDatoriRichieste(); fetchDatoriGestiti(); }} className="comic-button" style={{ padding:'10px 20px', fontSize:'12px', letterSpacing:'0.1em', display:'flex', alignItems:'center', gap:'8px' }}>
                <i className="fas fa-sync-alt" /> Aggiorna
              </button>
            </div>

            {/* ─── Sezione 1: Nuove Richieste ─────────────────────────── */}
            <div style={{ marginBottom:'40px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
                <div style={{ width:'4px', height:'24px', background:'var(--primary)', flexShrink:0 }} />
                <h2 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'1.1rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-color)', margin:0 }}>Nuove Richieste</h2>
                <span style={{ padding:'2px 10px', background:'var(--primary)', color:'#fff', fontSize:'11px', fontWeight: 700 }}>{datoriRichieste.length}</span>
              </div>

              {datoriRichieste.length === 0 ? (
                <div className="comic-card" style={{ padding:'40px', textAlign:'center' }}>
                  <i className="fas fa-building" style={{ fontSize:'40px', color:'var(--text-muted)', marginBottom:'12px', display:'block' }} />
                  <p style={{ color:'var(--text-muted)', fontWeight:700, margin:0 }}>Nessuna richiesta da datori di lavoro ancora.</p>
                </div>
              ) : (
                <div style={{ display:'grid', gap:'10px' }}>
                  {datoriRichieste.map(d => {
                    const s = STATO_LABELS[d.stato] || STATO_LABELS.nuova;
                    return (
                      <div key={d.id} className="comic-card" style={{ padding:'18px 24px', display:'flex', alignItems:'center', gap:'16px', cursor:'pointer' }} onClick={() => setSelectedDatoreReq(d)}>
                        <div style={{ width:'44px', height:'44px', flexShrink:0, background:'#3D2045', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'16px' }}>
                          <i className="fas fa-building" />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight: 700, fontSize:'15px', color:'var(--text-color)', marginBottom:'2px' }}>{d.nome_azienda}</div>
                          <div style={{ fontSize:'13px', color:'var(--text-muted)', fontWeight:500 }}>
                            {d.email}
                            {d.settore_ricerca && <span style={{ color:'var(--primary)', fontWeight:700 }}> &bull; {d.settore_ricerca}</span>}
                            {d.num_lavoratori && ` \u2022 ${d.num_lavoratori}`}
                          </div>
                        </div>
                        <div style={{ padding:'4px 10px', background:s.color, border:'1px solid var(--line)', color:'#fff', fontSize:'10px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{s.label}</div>
                        <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:600, whiteSpace:'nowrap' }}>{formatDate(d.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Sezione 2: Datori Gestiti ──────────────────────────── */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', marginBottom:'16px', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'4px', height:'24px', background:'#F97316', flexShrink:0 }} />
                  <h2 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'1.1rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-color)', margin:0 }}>Datori Gestiti</h2>
                  <span style={{ padding:'2px 10px', background:'#F97316', color:'#fff', fontSize:'11px', fontWeight: 700 }}>{datoriGestiti.length}</span>
                </div>
                <button onClick={() => setShowAddDatoreForm(v => !v)} className="comic-button"
                  style={{ padding:'10px 18px', fontSize:'11px', letterSpacing:'0.1em', display:'flex', alignItems:'center', gap:'8px', background: showAddDatoreForm ? 'var(--text-muted)' : '#F97316', color:'#fff', borderColor:'var(--comic-border-color)' }}>
                  <i className={`fas ${showAddDatoreForm ? 'fa-times' : 'fa-plus'}`} /> {showAddDatoreForm ? 'Annulla' : 'Aggiungi Datore'}
                </button>
              </div>

              {/* Form aggiunta rapida */}
              {showAddDatoreForm && (
                <div className="comic-card" style={{ padding:'24px', marginBottom:'16px', border:'1px solid #F97316' }}>
                  <h3 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'1rem', textTransform:'uppercase', color:'#F97316', margin:'0 0 16px' }}>Nuovo Datore Gestito</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
                    {[
                      { key:'nome_azienda', label:'Nome Azienda *', placeholder:'Es: Müller GmbH', type:'text' },
                      { key:'nome_referente', label:'Referente', placeholder:'Nome e cognome', type:'text' },
                      { key:'email', label:'Email', placeholder:'azienda@email.de', type:'email' },
                      { key:'telefono', label:'Telefono', placeholder:'+49 000 0000000', type:'tel' },
                      { key:'settori', label:'Settori', placeholder:'Es: Edilizia, Cucina', type:'text' },
                      { key:'note', label:'Note Interne', placeholder:'Note per uso interno...', type:'text' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ display:'block', fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'6px' }}>{f.label}</label>
                        <input
                          type={f.type}
                          value={newDatoreForm[f.key as keyof typeof newDatoreForm]}
                          onChange={e => setNewDatoreForm(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{ width:'100%', border:'1px solid var(--line)', background:'var(--bg-color)', color:'var(--text-color)', padding:'10px 14px', fontWeight:600, fontSize:'13px', outline:'none', boxSizing:'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={addDatoreGestito} disabled={savingDatore || !newDatoreForm.nome_azienda} className="comic-button"
                    style={{ background:'#F97316', color:'#fff', padding:'12px 24px', fontSize:'12px', letterSpacing:'0.15em', display:'flex', alignItems:'center', gap:'8px', borderColor:'var(--comic-border-color)', opacity:(!newDatoreForm.nome_azienda || savingDatore) ? 0.5 : 1 }}>
                    <i className={savingDatore ? 'fas fa-spinner fa-spin' : 'fas fa-plus'} /> {savingDatore ? 'SALVATAGGIO...' : 'AGGIUNGI'}
                  </button>
                </div>
              )}

              {datoriGestiti.length === 0 ? (
                <div className="comic-card" style={{ padding:'40px', textAlign:'center' }}>
                  <i className="fas fa-handshake" style={{ fontSize:'40px', color:'var(--text-muted)', marginBottom:'12px', display:'block' }} />
                  <p style={{ color:'var(--text-muted)', fontWeight:700, margin:0 }}>Nessun datore gestito. Clicca "Aggiungi Datore" per iniziare.</p>
                </div>
              ) : (
                <div style={{ display:'grid', gap:'10px' }}>
                  {datoriGestiti.map(d => (
                    <div key={d.id} className="comic-card" style={{ padding:'18px 24px', display:'flex', alignItems:'center', gap:'16px' }}>
                      <div style={{ width:'44px', height:'44px', flexShrink:0, background:'#F97316', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'16px' }}>
                        <i className="fas fa-handshake" />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight: 700, fontSize:'15px', color:'var(--text-color)', marginBottom:'2px' }}>{d.nome_azienda}</div>
                        <div style={{ fontSize:'13px', color:'var(--text-muted)', fontWeight:500 }}>
                          {d.nome_referente && `${d.nome_referente} \u2022 `}
                          {d.email && `${d.email} \u2022 `}
                          {d.settori && <span style={{ color:'#F97316', fontWeight:700 }}>{d.settori}</span>}
                        </div>
                        {d.note && <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:600, marginTop:'2px', fontStyle:'italic' }}>📝 {d.note}</div>}
                      </div>
                      {d.telefono && (
                        <a href={`tel:${d.telefono}`}
                          style={{ padding:'8px 12px', border:'1px solid var(--primary)', color:'var(--primary)', fontSize:'12px', fontWeight: 700, textDecoration:'none', display:'flex', alignItems:'center', gap:'6px', whiteSpace:'nowrap', flexShrink:0 }}>
                          <i className="fas fa-phone" /> {d.telefono}
                        </a>
                      )}
                      <button onClick={() => removeDatoreGestito(d.id)}
                        style={{ background:'transparent', border:'1px solid #dc2626', color:'#dc2626', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, fontSize:'13px' }}>
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Modal dettaglio richiesta datore ───────────────────── */}
            {selectedDatoreReq && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setSelectedDatoreReq(null)}>
                <div className="comic-card" style={{ width:'100%', maxWidth:'620px', maxHeight:'90vh', overflowY:'auto', padding:'40px', background:'var(--card-bg)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
                    <div>
                      <h3 style={{ fontFamily:'var(--font-heading)', fontWeight: 700, fontSize:'1.6rem', textTransform:'uppercase', color:'var(--text-color)', margin:'0 0 4px' }}>{selectedDatoreReq.nome_azienda}</h3>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:600 }}>{formatDate(selectedDatoreReq.created_at)}</div>
                    </div>
                    <button onClick={() => setSelectedDatoreReq(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'20px' }}><i className="fas fa-times" /></button>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'20px' }}>
                    {[
                      { icon:'fa-user', label:'Referente', value: selectedDatoreReq.nome_referente },
                      { icon:'fa-envelope', label:'Email', value: selectedDatoreReq.email },
                      { icon:'fa-phone', label:'Telefono', value: selectedDatoreReq.telefono },
                      { icon:'fa-industry', label:'Settore Ricerca', value: selectedDatoreReq.settore_ricerca },
                      { icon:'fa-users', label:'Lavoratori Richiesti', value: selectedDatoreReq.num_lavoratori },
                    ].filter(f => f.value).map((f, i) => (
                      <div key={i} style={{ border:'1px solid var(--line)', padding:'8px 12px', background:'var(--bg-color)' }}>
                        <div style={{ fontSize:'9px', fontWeight: 700, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'3px' }}>
                          <i className={`fas ${f.icon}`} style={{ marginRight:'5px' }} />{f.label}
                        </div>
                        <div style={{ fontWeight:700, color:'var(--text-color)', fontSize:'13px' }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedDatoreReq.messaggio && (
                    <div style={{ border:'1px solid var(--line)', padding:'16px', background:'var(--bg-color)', marginBottom:'20px' }}>
                      <div style={{ fontSize:'10px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'8px' }}>Descrizione Esigenze</div>
                      <p style={{ color:'var(--text-color)', fontWeight:500, margin:0, lineHeight:1.6 }}>{selectedDatoreReq.messaggio}</p>
                    </div>
                  )}

                  <div style={{ marginBottom:'20px' }}>
                    <label style={{ display:'block', fontSize:'11px', fontWeight: 700, letterSpacing:'0.2em', textTransform:'uppercase', color:'var(--primary)', marginBottom:'8px' }}>Stato Richiesta</label>
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      {(['nuova', 'in_lavorazione', 'completata'] as const).map(stato => {
                        const info = STATO_LABELS[stato];
                        return (
                          <button key={stato} onClick={() => updateDatoreRichiestaStato(selectedDatoreReq.id, stato)}
                            style={{ padding:'6px 14px', background: selectedDatoreReq.stato === stato ? info.color : 'transparent', border:`3px solid ${info.color}`, color: selectedDatoreReq.stato === stato ? '#fff' : info.color, fontSize:'11px', fontWeight: 700, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer' }}>
                            {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:'12px' }}>
                    <a href={`mailto:${selectedDatoreReq.email}`} style={{ textDecoration:'none', flex:1 }}>
                      <button className="comic-button" style={{ width:'100%', background:'var(--primary)', color:'#fff', padding:'14px', fontSize:'12px', letterSpacing:'0.15em', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                        <i className="fas fa-reply" /> RISPONDI VIA EMAIL
                      </button>
                    </a>
                    <button onClick={() => deleteDatoreRichiesta(selectedDatoreReq.id)} className="comic-button"
                      style={{ background:'#dc2626', border:'1px solid var(--line)', color:'#fff', padding:'14px 18px', fontSize:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Bottom nav — mobile only */}
      <nav className="admin-bottom-nav" style={{
        display: 'none',
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'var(--card-bg)',
        borderTop: '1px solid var(--line-soft)',
        zIndex: 40,
        justifyContent: 'space-around',
        padding: '8px 0',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '9px', letterSpacing: '0.05em', textTransform: 'uppercase',
              padding: '4px 8px',
              fontFamily: 'var(--font-inter)',
            }}
          >
            <i className={`fas ${tab.icon}`} style={{ fontSize: '18px' }} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Modal Cambio Password Admin */}
      {showPwdModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPwdModal(false);
          }}
        >
          <div className="comic-card" style={{
            background: 'var(--card-bg)',
            maxWidth: '460px',
            width: '100%',
            padding: '36px 32px',
            position: 'relative',
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowPwdModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-color)',
                fontSize: '20px',
                cursor: 'pointer',
              }}
              aria-label="Chiudi"
            >
              <i className="fas fa-times" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'var(--primary)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '18px',
              }}>
                <i className="fas fa-shield-alt" />
              </div>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  textTransform: 'uppercase',
                  color: 'var(--text-color)',
                  margin: 0,
                }}>
                  Cambia Password Admin
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  {user?.email}
                </p>
              </div>
            </div>

            {pwdSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  background: 'rgba(37,211,102,0.1)',
                  border: '1px solid #25D366',
                  boxShadow: 'none',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <i className="fas fa-check-circle" style={{ color: '#25D366', fontSize: '20px' }} />
                  <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '14px' }}>
                    Password amministratore aggiornata con successo!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="comic-button"
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    padding: '12px',
                    fontSize: '12px',
                    letterSpacing: '0.15em',
                  }}
                >
                  CHIUDI
                </button>
              </div>
            ) : (
              <form onSubmit={handleAdminPasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {pwdError && (
                  <div style={{
                    background: 'rgba(220,38,38,0.1)',
                    border: '1px solid #dc2626',
                    boxShadow: 'none',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <i className="fas fa-exclamation-triangle" style={{ color: '#dc2626', fontSize: '16px' }} />
                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '13px' }}>{pwdError}</span>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '6px' }}>
                    Password Attuale
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-shield-alt" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }} />
                    <input
                      type={showAdminCurrentPwd ? 'text' : 'password'}
                      value={adminCurrentPwd}
                      onChange={e => setAdminCurrentPwd(e.target.value)}
                      required
                      placeholder="Password attuale dell'amministratore"
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        background: 'var(--bg-color)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-soft)',
                        color: 'var(--text-color)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminCurrentPwd(v => !v)}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }}
                    >
                      <i className={`fas ${showAdminCurrentPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '6px' }}>
                    Nuova Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-lock" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }} />
                    <input
                      type={showAdminNewPwd ? 'text' : 'password'}
                      value={adminNewPwd}
                      onChange={e => setAdminNewPwd(e.target.value)}
                      required
                      placeholder="Almeno 8 caratteri"
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        background: 'var(--bg-color)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-soft)',
                        color: 'var(--text-color)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminNewPwd(v => !v)}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }}
                    >
                      <i className={`fas ${showAdminNewPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '6px' }}>
                    Conferma Nuova Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-check-circle" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: adminConfirmPwd && adminConfirmPwd === adminNewPwd ? '#16a34a' : 'var(--primary)', fontSize: '14px', opacity: 0.7 }} />
                    <input
                      type={showAdminConfirmPwd ? 'text' : 'password'}
                      value={adminConfirmPwd}
                      onChange={e => setAdminConfirmPwd(e.target.value)}
                      required
                      placeholder="Ripeti la password"
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        background: 'var(--bg-color)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-soft)',
                        color: 'var(--text-color)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminConfirmPwd(v => !v)}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }}
                    >
                      <i className={`fas ${showAdminConfirmPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  {adminConfirmPwd && adminConfirmPwd !== adminNewPwd && (
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                      Le password non coincidono
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPwdModal(false)}
                    className="comic-button"
                    style={{ flex: 1, background: 'transparent', color: 'var(--text-color)', padding: '12px', fontSize: '12px', letterSpacing: '0.1em' }}
                  >
                    ANNULLA
                  </button>
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="comic-button"
                    style={{
                      flex: 1,
                      background: pwdLoading ? 'var(--secondary)' : 'var(--primary)',
                      color: '#fff',
                      padding: '12px',
                      fontSize: '12px',
                      letterSpacing: '0.1em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: pwdLoading ? 0.7 : 1,
                      cursor: pwdLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {pwdLoading ? <><i className="fas fa-spinner fa-spin" /> Salvo...</> : <><i className="fas fa-save" /> AGGIORNA</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;

import React, { useState } from 'react';
import ResumePreview from './ResumePreview';
import { initialResumeData, templates, generateUUID, compressImage } from '../services/resumeService';
import { ResumeData, Experience, Education, Skill, Language } from '../types';

const ResumeEditor: React.FC<{ 
  onBack: () => void; 
  initialTemplateId?: string;
  resumeId?: string | null;
}> = ({ onBack, initialTemplateId = 'original', resumeId }) => {
  
  // Initialize state logic
  const [data, setData] = useState<ResumeData>(() => {
    try {
      // 1. Load the collection of resumes
      const savedCollection = localStorage.getItem('cv_collection_data');
      let collection: ResumeData[] = savedCollection ? JSON.parse(savedCollection) : [];

      // 2. If a resumeId is provided (Editing mode), find it
      if (resumeId) {
        const found = collection.find(r => r.id === resumeId);
        if (found) {
            // Garante que o themeMode exista mesmo em dados antigos
            return { ...found, themeMode: found.themeMode || 'dark' };
        }
      }

      // 3. If no ID (New mode) or ID not found, create new data
      if (collection.length === 0) {
        const legacyData = localStorage.getItem('cv_backup_data');
        if (legacyData) {
            // Legacy handling if needed
        }
      }

      // Return a fresh resume object with a new unique ID
      return { 
        ...initialResumeData, 
        id: generateUUID(), 
        templateId: initialTemplateId,
        themeMode: 'dark' // Default for new
      };
    } catch (e) {
      console.error("Erro ao inicializar dados:", e);
      return { ...initialResumeData, id: generateUUID(), templateId: initialTemplateId, themeMode: 'dark' };
    }
  });

  // Handle Text Inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  // Handle Theme Toggle
  const toggleThemeMode = () => {
    setData(prev => ({ ...prev, themeMode: prev.themeMode === 'light' ? 'dark' : 'light' }));
  };

  // Handle Photo Upload (With Compression from Service)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      try {
        const compressedBase64 = await compressImage(file, 400); // Max width 400px
        setData(prev => ({ ...prev, avatarUrl: compressedBase64 }));
      } catch (error) {
        console.error("Erro ao processar imagem:", error);
        alert("Erro ao processar a imagem. Tente um arquivo diferente.");
      }
    }
  };

  // --- SAVE FUNCTIONALITY ---
  const handleSave = () => {
    try {
      const STORAGE_KEY = 'cv_collection_data';
      
      // 1. Prepare data to save
      const dataToSave = {
        ...data,
        lastUpdated: new Date().toISOString()
      };
      
      // Update local state
      setData(dataToSave);

      // 2. Load existing collection
      const savedCollection = localStorage.getItem(STORAGE_KEY);
      let collection: ResumeData[] = savedCollection ? JSON.parse(savedCollection) : [];

      // 3. Find index of current resume
      const index = collection.findIndex(r => r.id === data.id);

      if (index >= 0) {
        // Update existing
        collection[index] = dataToSave;
      } else {
        // Add new
        collection.push(dataToSave);
      }

      // 4. Save back to localStorage with error handling for quota
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
        // Also save legacy key for backward compatibility or simple backup
        localStorage.setItem('cv_backup_data', JSON.stringify(dataToSave));
        
        console.log("Currículo salvo na coleção:", dataToSave.id); 
        alert('Currículo salvo com sucesso! Ele foi adicionado à sua lista no Painel.');
      } catch (storageError: any) {
         if (storageError.name === 'QuotaExceededError') {
             alert('Erro: Espaço de armazenamento cheio. Tente excluir currículos antigos ou usar imagens menores.');
         } else {
             throw storageError;
         }
      }
      
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Houve um erro técnico ao salvar.');
    }
  };

  // --- CRUD HELPERS (Using generateUUID for Secure IDs) ---

  // Experience
  const addExperience = () => {
    const newExp: Experience = { id: generateUUID(), role: 'Novo Cargo', company: 'Empresa', period: 'Periodo', description: 'Descrição da atividade' };
    setData(prev => ({ ...prev, experiences: [...prev.experiences, newExp] }));
  };
  const removeExperience = (id: string) => {
    setData(prev => ({ ...prev, experiences: prev.experiences.filter(e => e.id !== id) }));
  };
  const updateExperience = (id: string, field: keyof Experience, value: string) => {
    setData(prev => ({
      ...prev,
      experiences: prev.experiences.map(e => e.id === id ? { ...e, [field]: value } : e)
    }));
  };

  // Education
  const addEducation = () => {
    const newEdu: Education = { id: generateUUID(), degree: 'Novo Curso', institution: 'Instituição', year: 'Ano', type: 'Certificação' };
    setData(prev => ({ ...prev, education: [...prev.education, newEdu] }));
  };
  const removeEducation = (id: string) => {
    setData(prev => ({ ...prev, education: prev.education.filter(e => e.id !== id) }));
  };
  const updateEducation = (id: string, field: keyof Education, value: string) => {
    setData(prev => ({
      ...prev,
      education: prev.education.map(e => e.id === id ? { ...e, [field]: value } : e)
    }));
  };

  // Skills
  const addSkill = () => {
    const newSkill: Skill = { id: generateUUID(), name: '', level: 50 };
    setData(prev => ({ ...prev, skills: [...prev.skills, newSkill] }));
  };
  const removeSkill = (id: string) => {
    setData(prev => ({ ...prev, skills: prev.skills.filter(s => s.id !== id) }));
  };
  const updateSkill = (id: string, field: keyof Skill, value: any) => {
    setData(prev => ({
      ...prev,
      skills: prev.skills.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  // Languages
  const addLanguage = () => {
    const newLang: Language = { id: generateUUID(), name: '', level: '' };
    setData(prev => ({ ...prev, languages: [...prev.languages, newLang] }));
  };
  const removeLanguage = (id: string) => {
    setData(prev => ({ ...prev, languages: prev.languages.filter(l => l.id !== id) }));
  };
  const updateLanguage = (id: string, field: keyof Language, value: string) => {
    setData(prev => ({
      ...prev,
      languages: prev.languages.map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  // Hobbies
  const addHobby = () => {
    setData(prev => ({ ...prev, hobbies: [...prev.hobbies, 'Novo Hobby'] }));
  };
  const removeHobby = (index: number) => {
    setData(prev => ({ ...prev, hobbies: prev.hobbies.filter((_, i) => i !== index) }));
  };
  const updateHobby = (index: number, value: string) => {
    const newHobbies = [...data.hobbies];
    newHobbies[index] = value;
    setData(prev => ({ ...prev, hobbies: newHobbies }));
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-forest-deep">
      {/* Left Panel: Form */}
      <div className="w-full md:w-2/5 h-full bg-forest-surface border-r border-forest-border flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-forest-border bg-forest-surface flex justify-between items-center">
           <div>
            <button onClick={onBack} className="flex items-center text-stone-400 hover:text-white mb-2 text-sm transition-colors">
                <span className="material-symbols-outlined text-[18px] mr-1">arrow_back</span>
                Voltar
            </button>
            <h2 className="text-xl font-display font-bold text-white">
                {resumeId ? 'Editar Currículo' : 'Novo Currículo'}
            </h2>
           </div>
           <button 
             onClick={handleSave}
             className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
           >
             <span className="material-symbols-outlined text-[18px]">save</span>
             Salvar
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-20">
          
          {/* Template & Theme Selector */}
          <div className="bg-forest-deep p-4 rounded-xl border border-forest-border space-y-4">
             <div>
                <label className="text-xs text-primary font-bold uppercase mb-2 block">Modelo Selecionado</label>
                <select 
                    name="templateId" 
                    value={data.templateId} 
                    onChange={handleInputChange}
                    className="w-full bg-forest-surface border border-forest-border rounded-lg p-2 text-white text-sm focus:outline-none focus:border-primary"
                >
                    {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
             </div>
             
             {/* THEME TOGGLE BUTTON */}
             <div className="flex items-center justify-between bg-forest-surface p-3 rounded-lg border border-forest-border">
                <span className="text-xs text-stone-300 font-bold uppercase">Modo do Currículo</span>
                <button 
                    onClick={toggleThemeMode}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${data.themeMode === 'light' ? 'bg-stone-200 text-stone-900' : 'bg-black text-white'}`}
                >
                    <span className="material-symbols-outlined text-[16px]">
                        {data.themeMode === 'light' ? 'light_mode' : 'dark_mode'}
                    </span>
                    {data.themeMode === 'light' ? 'Claro' : 'Escuro'}
                </button>
             </div>
          </div>

          {/* Personal Data */}
          <section className="space-y-4">
            <h3 className="text-primary font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">person</span> Dados Pessoais
            </h3>
            
            <div className="space-y-1">
                <label className="text-xs text-stone-500 font-bold uppercase">Nome Completo</label>
                <input name="fullName" value={data.fullName} onChange={handleInputChange} className="input-field" />
            </div>
             <div className="space-y-1">
                <label className="text-xs text-stone-500 font-bold uppercase">Cargo</label>
                <input name="role" value={data.role} onChange={handleInputChange} className="input-field" />
            </div>
            
            {/* Photo Upload */}
            <div className="space-y-1">
                <label className="text-xs text-stone-500 font-bold uppercase">Foto (Do computador)</label>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-16 bg-forest-deep rounded overflow-hidden border border-forest-border flex-shrink-0">
                    {data.avatarUrl && <img src={data.avatarUrl} alt="Preview" className="w-full h-full object-cover" />}
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="text-xs text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary"/>
                </div>
                <p className="text-[10px] text-stone-500 mt-1">* A imagem será otimizada automaticamente para economizar espaço.</p>
            </div>

             <div className="space-y-1">
                <label className="text-xs text-stone-500 font-bold uppercase">Resumo Profissional</label>
                <textarea name="summary" value={data.summary} onChange={handleInputChange} rows={6} className="input-field resize-none" />
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-4 pt-4 border-t border-forest-border">
             <h3 className="text-primary font-bold uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">contact_mail</span> Contato
            </h3>
            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-xs text-stone-500 font-bold uppercase">Email</label>
                    <input name="email" value={data.email} onChange={handleInputChange} className="input-field" />
                </div>
                 <div className="space-y-1">
                    <label className="text-xs text-stone-500 font-bold uppercase">Telefone</label>
                    <input name="phone" value={data.phone} onChange={handleInputChange} className="input-field" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-stone-500 font-bold uppercase">LinkedIn</label>
                    <input name="linkedin" value={data.linkedin} onChange={handleInputChange} className="input-field" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-stone-500 font-bold uppercase">Portfólio</label>
                    <input name="portfolio" value={data.portfolio} onChange={handleInputChange} className="input-field" />
                </div>
            </div>
          </section>

          {/* Experience CRUD */}
          <section className="space-y-4 pt-4 border-t border-forest-border">
            <div className="flex justify-between items-center">
               <h3 className="text-primary font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">work</span> Experiência
               </h3>
               <button onClick={addExperience} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">+ Adicionar</button>
            </div>
            {data.experiences.map((exp) => (
              <div key={exp.id} className="bg-forest-deep p-4 rounded-lg border border-forest-border space-y-2 relative group">
                 <button onClick={() => removeExperience(exp.id)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                 <input value={exp.role} onChange={(e) => updateExperience(exp.id, 'role', e.target.value)} placeholder="Cargo" className="input-field font-bold" />
                 <input value={exp.company} onChange={(e) => updateExperience(exp.id, 'company', e.target.value)} placeholder="Empresa" className="input-field text-sm" />
                 <input value={exp.period} onChange={(e) => updateExperience(exp.id, 'period', e.target.value)} placeholder="Período" className="input-field text-sm" />
                 <textarea value={exp.description} onChange={(e) => updateExperience(exp.id, 'description', e.target.value)} placeholder="Descrição" rows={3} className="input-field text-sm resize-none" />
              </div>
            ))}
          </section>

          {/* Education CRUD */}
          <section className="space-y-4 pt-4 border-t border-forest-border">
            <div className="flex justify-between items-center">
               <h3 className="text-primary font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">school</span> Educação
               </h3>
               <button onClick={addEducation} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">+ Adicionar</button>
            </div>
            {data.education.map((edu) => (
              <div key={edu.id} className="bg-forest-deep p-4 rounded-lg border border-forest-border space-y-2 relative group">
                 <button onClick={() => removeEducation(edu.id)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                 <input value={edu.degree} onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)} placeholder="Curso/Grau" className="input-field font-bold" />
                 <input value={edu.institution} onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)} placeholder="Instituição" className="input-field text-sm" />
                 <div className="flex gap-2">
                   <input value={edu.year} onChange={(e) => updateEducation(edu.id, 'year', e.target.value)} placeholder="Ano" className="input-field text-sm flex-1" />
                   <select value={edu.type} onChange={(e) => updateEducation(edu.id, 'type', e.target.value as any)} className="input-field text-sm flex-1">
                      <option>Bacharelado</option>
                      <option>Certificação</option>
                      <option>Mestrado</option>
                      <option>Extensão</option>
                   </select>
                 </div>
              </div>
            ))}
          </section>

          {/* Skills CRUD (Agora Experiências) */}
          <section className="space-y-4 pt-4 border-t border-forest-border">
            <div className="flex justify-between items-center">
               <h3 className="text-primary font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">psychology</span> Experiências
               </h3>
               <button onClick={addSkill} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">+ Adicionar</button>
            </div>
            <div className="space-y-3">
              {data.skills.map((skill) => (
                <div key={skill.id} className="grid grid-cols-12 gap-2 items-center group bg-forest-deep/50 p-2 rounded border border-forest-border/50">
                  <div className="col-span-8">
                     <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">Nome da Experiência / Conhecimento</label>
                     <input value={skill.name} onChange={(e) => updateSkill(skill.id, 'name', e.target.value)} className="input-field w-full" placeholder="Ex: Gestão de Projetos, Java, Photoshop" />
                  </div>
                  <div className="col-span-3">
                     <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">Nível %</label>
                     <input type="number" min="0" max="100" value={skill.level} onChange={(e) => updateSkill(skill.id, 'level', parseInt(e.target.value))} className="input-field w-full text-center" />
                  </div>
                  <div className="col-span-1 flex justify-center mt-5">
                      <button onClick={() => removeSkill(skill.id)} className="text-red-500 hover:text-red-400"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Languages CRUD (Idiomas) */}
          <section className="space-y-4 pt-4 border-t border-forest-border">
            <div className="flex justify-between items-center">
               <h3 className="text-primary font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">language</span> Idiomas
               </h3>
               <button onClick={addLanguage} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">+ Adicionar</button>
            </div>
            <div className="space-y-3">
              {data.languages.map((lang) => (
                <div key={lang.id} className="grid grid-cols-12 gap-2 items-center group bg-forest-deep/50 p-2 rounded border border-forest-border/50">
                   <div className="col-span-6">
                     <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">Idioma</label>
                     <input value={lang.name} onChange={(e) => updateLanguage(lang.id, 'name', e.target.value)} className="input-field w-full" placeholder="Ex: Inglês" />
                   </div>
                   <div className="col-span-5">
                     <label className="text-[10px] text-stone-500 uppercase font-bold block mb-1">Conhecimento na língua</label>
                     <input value={lang.level} onChange={(e) => updateLanguage(lang.id, 'level', e.target.value)} className="input-field w-full" placeholder="Ex: Fluente, Intermediário" />
                   </div>
                   <div className="col-span-1 flex justify-center mt-5">
                      <button onClick={() => removeLanguage(lang.id)} className="text-red-500 hover:text-red-400"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Hobbies CRUD */}
          <section className="space-y-4 pt-4 border-t border-forest-border">
            <div className="flex justify-between items-center">
               <h3 className="text-primary font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">interests</span> Hobbies
               </h3>
               <button onClick={addHobby} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition">+ Adicionar</button>
            </div>
            <div className="space-y-2">
              {data.hobbies.map((hobby, index) => (
                <div key={index} className="flex gap-2 items-center group">
                  <input value={hobby} onChange={(e) => updateHobby(index, e.target.value)} className="input-field flex-1" placeholder="Hobby" />
                  <button onClick={() => removeHobby(index)} className="text-red-500 opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Right Panel: Live Preview */}
      <div className="w-full md:w-3/5 h-full bg-forest-base relative flex flex-col">
         {/* Background pattern */}
         <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(#d97706 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
         
         {/* Scrollable Container for Preview */}
         <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-4 md:p-8 flex justify-center">
            <div className="w-full max-w-4xl bg-transparent min-h-full">
                <ResumePreview data={data} />
            </div>
         </div>
         
         <div className="absolute top-4 right-8 z-50 bg-forest-deep/80 backdrop-blur px-3 py-1 rounded-full border border-forest-border text-[10px] uppercase font-bold text-primary">
            Live Preview ({data.themeMode === 'light' ? 'Light' : 'Dark'})
         </div>
      </div>
      
      {/* Styles injection for input fields reuse */}
      <style>{`
        .input-field {
          width: 100%;
          background-color: #0f1a15;
          border: 1px solid #2d4a3c;
          border-radius: 0.5rem;
          padding: 0.75rem;
          color: #e7e5e4;
          transition: border-color 0.2s;
        }
        .input-field:focus {
          border-color: #d97706;
          outline: none;
        }
      `}</style>
    </div>
  );
};

export default ResumeEditor;
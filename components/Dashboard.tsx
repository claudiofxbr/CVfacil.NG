import React, { useState, useEffect, useRef } from 'react';
import { templates, initialResumeData, generateUUID } from '../services/resumeService';
import { ResumeData, User } from '../types';
import ResumePreview from './ResumePreview';

// Declaração global para evitar erros de TS
declare global {
  interface Window {
    html2canvas: any;
    jspdf: any;
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const Dashboard: React.FC<{ 
  onCreate: (templateId: string) => void;
  onEdit: (resumeId: string) => void;
  userInfo: User; 
}> = ({ onCreate, onEdit, userInfo }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  
  // Estados para Exclusão e Notificação
  const [resumeToDelete, setResumeToDelete] = useState<ResumeData | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'loading'} | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Estado para Geração de PDF
  const [printingResume, setPrintingResume] = useState<ResumeData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Referência para Importação de Arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Recuperação de Falha de API (Robustez Hostinger)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [manualKeyInput, setManualKeyInput] = useState('');

  // Carregar dados salvos ao montar o componente
  useEffect(() => {
    loadResumes();

    // Listener para manter o "Banco de Dados" (LocalStorage) sincronizado entre abas ou alterações externas
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cv_collection_data') {
        loadResumes();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Timer para limpar notificação automaticamente
  useEffect(() => {
    if (notification && notification.type !== 'loading') {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Efeito para detectar quando um currículo está pronto para ser processado
  useEffect(() => {
    if (printingResume && printRef.current) {
      // Pequeno delay para garantir que o React renderizou o conteúdo oculto e imagens
      const timer = setTimeout(() => {
          generatePdfAction();
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [printingResume]);

  const loadResumes = () => {
    const STORAGE_KEY = 'cv_collection_data';
    const savedCollection = localStorage.getItem(STORAGE_KEY);
    
    if (savedCollection) {
        try {
            const parsed = JSON.parse(savedCollection);
            if (Array.isArray(parsed)) {
                sortAndSetResumes(parsed);
            } else {
                setResumes([]);
            }
        } catch (e) {
            console.error("Erro ao carregar coleção (Database Corrupt):", e);
            setResumes([]); 
        }
    } else {
        const legacyData = localStorage.getItem('cv_backup_data');
        if (legacyData) {
             try {
                 const single = JSON.parse(legacyData);
                 if (!single.id) single.id = generateUUID();
                 const newList = [single];
                 localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
                 sortAndSetResumes(newList);
             } catch(e) {}
        }
    }
  };

  const sortAndSetResumes = (list: ResumeData[]) => {
    const sorted = [...list].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateB - dateA;
    });
    setResumes(sorted);
  };

  const getTemplateName = (id: string) => {
    const t = templates.find(temp => temp.id === id);
    return t ? t.name : 'Personalizado';
  };

  const getLastUpdatedText = (dateString?: string) => {
    if (!dateString) return "Não salvo";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Data inválida";

    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return "Agora mesmo";
    if (diffInMinutes < 60) return `Há ${diffInMinutes} minutos`;
    if (diffInMinutes < 1440) return `Há ${Math.floor(diffInMinutes / 60)} horas`;
    return date.toLocaleDateString();
  };

  // Correção de Race Condition: Lê o estado atual do disco antes de alterar
  const handlePin = (idToPin: string) => {
    const STORAGE_KEY = 'cv_collection_data';
    const savedCollection = localStorage.getItem(STORAGE_KEY);
    let currentList: ResumeData[] = savedCollection ? JSON.parse(savedCollection) : [];

    const updatedList = currentList.map(r => {
        if (r.id === idToPin) {
            return { ...r, isPinned: !r.isPinned };
        }
        return r;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    // Atualiza estado local para refletir a mudança imediatamente
    sortAndSetResumes(updatedList);
  };

  const requestDelete = (resume: ResumeData) => {
    setResumeToDelete(resume);
  };

  // Correção de Race Condition: Lê o estado atual do disco antes de excluir
  const confirmDeleteResume = () => {
    if (resumeToDelete) {
        const STORAGE_KEY = 'cv_collection_data';
        const savedCollection = localStorage.getItem(STORAGE_KEY);
        let currentList: ResumeData[] = savedCollection ? JSON.parse(savedCollection) : [];

        const updatedList = currentList.filter(r => r.id !== resumeToDelete.id);
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
        sortAndSetResumes(updatedList);

        setNotification({ 
            message: `O currículo de "${resumeToDelete.fullName}" foi removido permanentemente.`, 
            type: 'success' 
        });
        setResumeToDelete(null);
    }
  };

  // --- Lógica de Geração de PDF ---
  const handleDownloadPdf = (resume: ResumeData) => {
    setNotification({ message: "Gerando visualização para PDF...", type: 'success' });
    setPrintingResume(resume);
  };

  // Função auxiliar para esperar carregamento de imagens
  const waitForImages = async (element: HTMLElement) => {
    const images = Array.from(element.getElementsByTagName('img'));
    const promises = images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; 
        });
    });
    await Promise.all(promises);
  };

  const generatePdfAction = async () => {
    if (!printRef.current) return;

    try {
        await waitForImages(printRef.current);
        const printContent = printRef.current.innerHTML;
        const printWindow = window.open('', '_blank');

        if (printWindow) {
            // Configuração do Tailwind para manter o design original
            const tailwindConfig = `
                <script src="https://cdn.tailwindcss.com"></script>
                <script>
                  tailwind.config = {
                    darkMode: 'class',
                    theme: {
                      extend: {
                        fontFamily: {
                          sans: ['Inter', 'sans-serif'],
                          display: ['Outfit', 'sans-serif'],
                        },
                        colors: {
                          primary: "#d97706", 
                          secondary: "#c2410c", 
                          "forest-deep": "#020617", 
                          "forest-base": "#0f172a", 
                          "forest-surface": "#1e293b", 
                          "forest-border": "#334155", 
                          "stone-200": "#e2e8f0", 
                          "stone-400": "#94a3b8", 
                        }
                      }
                    }
                  }
                </script>
            `;

            printWindow.document.write(`
                <html>
                <head>
                    <title>${printingResume?.fullName || 'Currículo'} - CVFacil.NG</title>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    ${tailwindConfig}
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
                    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
                    <style>
                        body { font-family: 'Inter', sans-serif; }
                        @media print {
                            body { 
                                margin: 0; 
                                -webkit-print-color-adjust: exact !important; 
                                print-color-adjust: exact !important; 
                            }
                            .page-break {
                                page-break-before: always;
                                break-before: page;
                            }
                            .section-container {
                                padding: 2cm;
                                min-height: 100vh;
                            }
                            section, .group, li, tr {
                                break-inside: avoid;
                            }
                        }
                        ::-webkit-scrollbar { display: none; }
                    </style>
                </head>
                <body class="${printingResume?.themeMode === 'dark' ? 'bg-forest-deep text-stone-200' : 'bg-white text-stone-800'}">
                    <div class="section-container">
                        ${printContent}
                    </div>
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                            }, 800);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
            setNotification({ message: "Selecione 'Salvar como PDF' na janela que abriu.", type: 'success' });
        } else {
            setNotification({ message: "Pop-up bloqueado. Permita pop-ups para baixar o PDF.", type: 'error' });
        }

    } catch (error) {
        console.error("Erro:", error);
        setNotification({ message: "Erro ao preparar o PDF.", type: 'error' });
    } finally {
        setPrintingResume(null);
    }
  };

  // --- LÓGICA DE IMPORTAÇÃO DE CURRÍCULO (AI POWERED) ---

  const handleImportClick = async () => {
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
    }
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleRetryWithKey = () => {
      if (!manualKeyInput.trim()) {
          setNotification({ message: "Por favor, insira uma chave válida.", type: 'error' });
          return;
      }
      
      // Salva a chave e fecha o modal
      localStorage.setItem('cv_custom_api_key', manualKeyInput.trim());
      setShowApiKeyModal(false);
      setManualKeyInput('');
      
      // Tenta novamente com o arquivo pendente
      if (pendingFile) {
          setNotification({ message: "Tentando novamente com a nova chave...", type: 'loading' });
          processFile(pendingFile);
          setPendingFile(null);
      }
  };

  const processFile = async (file: File) => {
      if (file.type !== 'application/pdf') {
          setNotification({ message: "Formato inválido. Apenas arquivos PDF são permitidos.", type: 'error' });
          return;
      }
      
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
          setNotification({ message: "O arquivo é muito grande. Máximo permitido: 5MB.", type: 'error' });
          return;
      }

      setNotification({ message: "Analisando currículo com Inteligência Artificial...", type: 'loading' });
      setUploadProgress(0);

      // Simulação de progresso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 10) + 1;
        });
      }, 500);

      let apiKey: string | null = null;

      try {
          const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => {
                  const result = reader.result as string;
                  const base64 = result.split(',')[1];
                  resolve(base64);
              };
              reader.onerror = error => reject(error);
          });

          // LÓGICA ROBUSTA DE RECUPERAÇÃO DE CHAVE
          apiKey = localStorage.getItem('cv_custom_api_key');
          
          if (!apiKey) {
              apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.API_KEY || null;
          }
          
          // Debug para Hostinger
          console.log("Debug API Key Source:", apiKey ? (localStorage.getItem('cv_custom_api_key') ? "Manual (LocalStorage)" : "Ambiente") : "Nenhuma");

          if (!apiKey) {
             if (window.aistudio) {
                await window.aistudio.openSelectKey();
             } 
             throw new Error("Chave de API não encontrada. Vá em Configurações e insira sua chave manualmente.");
          }

          const { generateResumeFromPDF } = await import('../services/resumeService');
          const parsedData = await generateResumeFromPDF(base64Data, apiKey);

          const newResume: ResumeData = {
              ...initialResumeData,
              id: generateUUID(),
              templateId: 'original',
              themeMode: 'dark',
              lastUpdated: new Date().toISOString(),
              fullName: parsedData.fullName || "Novo Currículo",
              role: parsedData.role || "",
              email: parsedData.email || "",
              phone: parsedData.phone || "",
              linkedin: parsedData.linkedin || "",
              portfolio: parsedData.portfolio || "",
              summary: parsedData.summary || "",
              avatarUrl: userInfo.avatar || initialResumeData.avatarUrl,
              experiences: Array.isArray(parsedData.experiences) ? parsedData.experiences.map((exp: any) => ({
                  id: generateUUID(),
                  role: exp.role || "",
                  company: exp.company || "",
                  period: exp.period || "",
                  description: exp.description || ""
              })) : [],
              education: Array.isArray(parsedData.education) ? parsedData.education.map((edu: any) => ({
                  id: generateUUID(),
                  degree: edu.degree || "",
                  institution: edu.institution || "",
                  year: edu.year || "",
                  type: edu.type || "Curso"
              })) : [],
              skills: Array.isArray(parsedData.skills) ? parsedData.skills.map((skill: any) => ({
                  id: generateUUID(),
                  name: skill.name || "",
                  level: skill.level || 70
              })) : [],
              languages: Array.isArray(parsedData.languages) ? parsedData.languages.map((lang: any) => ({
                  id: generateUUID(),
                  name: lang.name || "",
                  level: lang.level || "Básico"
              })) : [],
              hobbies: Array.isArray(parsedData.hobbies) ? parsedData.hobbies : ["Leitura", "Tecnologia"]
          };

          const newResumesList = [...resumes, newResume];
          
          try {
             localStorage.setItem('cv_collection_data', JSON.stringify(newResumesList));
             setResumes(newResumesList);
             clearInterval(progressInterval);
             setUploadProgress(100);
             setNotification({ message: "Currículo importado com sucesso!", type: 'success' });
          } catch (storageError: any) {
             if (storageError.name === 'QuotaExceededError') {
                 setNotification({ message: "Erro: Armazenamento cheio. Não foi possível salvar.", type: 'error' });
             } else {
                 throw storageError;
             }
          }
          
      } catch (error: any) {
          clearInterval(progressInterval);
          setUploadProgress(0);
          console.error("Erro na importação:", error);
          
          const maskedKey = apiKey ? (apiKey.length > 10 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "Inválida") : "Nenhuma";
          console.error(`[Dashboard] Chave usada na falha: ${maskedKey} (Origem: ${localStorage.getItem('cv_custom_api_key') ? "Manual" : "Ambiente"})`);

          let errorMsg = error.message || "Erro ao processar o arquivo.";
          let isApiCriticalError = false;
          
          if (errorMsg.includes("API Key") || errorMsg.includes("Chave de API")) {
              errorMsg = "Chave de API inválida ou não configurada.";
              isApiCriticalError = true;
          }
          else if (errorMsg.includes("API_NOT_ENABLED") || errorMsg.includes("User has not enabled") || errorMsg.includes("consumer has not enabled")) {
              errorMsg = "A API 'Google Generative AI' não está ativada na sua chave.";
              isApiCriticalError = true;
          }
          else if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND")) {
              errorMsg = "Modelo de IA indisponível ou API desativada.";
              isApiCriticalError = true;
          }
          else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
              errorMsg = "Limite de uso da API excedido (Quota). Tente novamente em alguns minutos.";
          }
          else if (errorMsg.includes("400") || errorMsg.includes("INVALID_ARGUMENT")) {
              errorMsg = "A IA não conseguiu processar este PDF. Tente um arquivo diferente.";
          }
          else if (errorMsg.includes("fetch") || errorMsg.includes("network")) {
              errorMsg = "Erro de conexão. Verifique sua internet e tente novamente.";
          }
          else if (error instanceof SyntaxError) {
              errorMsg = "A IA retornou dados inválidos. Tente novamente.";
          }
          
          setNotification({ message: errorMsg, type: 'error' });

          if (isApiCriticalError) {
              setPendingFile(file);
              setShowApiKeyModal(true);
          }
      } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          processFile(file);
      }
  };


  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 relative">
      
      {/* Modal de Recuperação de Chave API (Robustez Hostinger) */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#1a0f0f] border border-red-900/50 rounded-2xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                        <span className="material-symbols-outlined">warning</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Falha na Conexão com IA</h3>
                </div>
                
                <p className="text-stone-300 text-sm mb-4 leading-relaxed">
                    A chave de API configurada no servidor parece estar inválida ou sem permissão (Erro 404/API Not Enabled).
                </p>
                <p className="text-stone-400 text-xs mb-4">
                    Para continuar agora mesmo, insira uma chave válida abaixo. Ela será salva no seu navegador.
                </p>

                <div className="space-y-3">
                    <input 
                        type="text" 
                        value={manualKeyInput}
                        onChange={(e) => setManualKeyInput(e.target.value)}
                        placeholder="Cole sua chave API aqui (AIzaSy...)"
                        className="w-full bg-black/50 border border-red-900/30 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none text-sm font-mono"
                    />
                    
                    <div className="flex justify-between items-center">
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                            Gerar chave no Google <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                        </a>
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button 
                            onClick={() => {
                                setShowApiKeyModal(false);
                                setPendingFile(null);
                            }}
                            className="flex-1 py-3 rounded-xl border border-stone-800 text-stone-500 font-bold hover:text-white hover:bg-stone-800 transition-all text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleRetryWithKey}
                            disabled={!manualKeyInput.trim()}
                            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Salvar e Tentar Novamente
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Sistema de Notificação (Toast) */}
      {notification && (
        <div className={`fixed top-8 right-8 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-5 duration-300 border backdrop-blur-md ${
            notification.type === 'success' ? 'bg-forest-deep/90 border-green-500/30 text-green-400' : 
            notification.type === 'loading' ? 'bg-forest-deep/90 border-blue-500/30 text-blue-400' :
            'bg-red-950/90 border-red-500 text-red-200'
        }`}>
            <div className={`p-2 rounded-full ${
                notification.type === 'success' ? 'bg-green-500/20' : 
                notification.type === 'loading' ? 'bg-blue-500/20' :
                'bg-red-500/20'
            }`}>
                <span className={`material-symbols-outlined ${notification.type === 'loading' ? 'animate-spin' : ''}`}>
                    {notification.type === 'success' ? 'check' : notification.type === 'loading' ? 'sync' : 'warning'}
                </span>
            </div>
            <div>
                <p className="font-bold text-sm">Sistema CVFacil.NG</p>
                <p className="text-xs opacity-90">
                    {notification.message}
                    {notification.type === 'loading' && (
                        <span className="ml-2 font-mono font-bold bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                            {uploadProgress}%
                        </span>
                    )}
                </p>
                {notification.type === 'loading' && (
                    <div className="w-full bg-blue-900/30 h-1 mt-2 rounded-full overflow-hidden">
                        <div 
                            className="bg-blue-500 h-full transition-all duration-500 ease-out" 
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* ÁREA OCULTA DE IMPRESSÃO */}
      {printingResume && (
        <div className="fixed top-0 left-0 z-[-100] w-[210mm] pointer-events-none opacity-0">
             <div ref={printRef} style={{ width: '100%' }}>
                 <ResumePreview data={printingResume} />
             </div>
        </div>
      )}

      {/* INPUT FILE OCULTO PARA IMPORTAÇÃO */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".pdf" 
        className="hidden" 
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {resumeToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative bg-[#1a0f0f] border border-red-900/50 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)] transform scale-100 transition-all">
                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(45deg, #dc2626 0, #dc2626 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px'}}></div>
                
                <div className="relative z-10 p-8 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center mb-6 animate-bounce">
                        <span className="material-symbols-outlined text-3xl text-red-500">delete_forever</span>
                    </div>

                    <h3 className="text-2xl font-display font-bold text-white mb-2">Excluir Currículo?</h3>
                    <p className="text-stone-400 text-sm mb-6 leading-relaxed">
                        Esta ação removerá o currículo do aplicativo <strong className="text-white">CVFacil.NG</strong>. Não será possível recuperá-lo depois.
                    </p>

                    <div className="w-full bg-red-950/20 border border-red-900/30 rounded-xl p-4 flex items-center gap-4 mb-8">
                        <div className="w-10 h-10 rounded-lg bg-red-900/50 flex-shrink-0 overflow-hidden">
                             {resumeToDelete.avatarUrl ? (
                                <img src={resumeToDelete.avatarUrl} alt="User" className="w-full h-full object-cover grayscale opacity-70" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-red-400 font-bold"><span className="material-symbols-outlined">description</span></div>
                             )}
                        </div>
                        <div className="text-left overflow-hidden">
                            <p className="font-bold text-red-100 truncate text-sm">{resumeToDelete.fullName}</p>
                            <p className="text-[10px] text-red-400/80 truncate uppercase tracking-wider">{resumeToDelete.role || "Sem cargo definido"}</p>
                        </div>
                    </div>

                    <div className="flex w-full gap-3">
                        <button 
                            onClick={() => setResumeToDelete(null)}
                            className="flex-1 py-3 rounded-xl border border-stone-700 text-stone-400 font-bold hover:bg-white/5 transition-colors text-xs uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmDeleteResume}
                            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 group"
                        >
                            <span>Excluir</span>
                            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-[16px]">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-forest-deep/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-forest-surface border border-forest-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-display font-bold text-white">Escolha um Modelo</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <button 
                  key={template.id}
                  onClick={() => onCreate(template.id)}
                  className="group relative overflow-hidden rounded-xl border-2 border-forest-border hover:border-primary transition-all duration-300 text-left bg-forest-deep"
                >
                   <div className="h-32 w-full relative" style={{backgroundColor: template.color}}>
                      <div className="absolute inset-0 bg-gradient-to-t from-forest-deep to-transparent opacity-50"></div>
                      <div className="absolute bottom-3 left-3 bg-forest-deep/90 px-2 py-1 rounded text-xs font-bold text-white shadow-lg">
                        {template.name}
                      </div>
                   </div>
                   <div className="p-4">
                      <p className="text-xs text-stone-400">{template.description}</p>
                   </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <header className="flex flex-col md:flex-row gap-6 items-center md:items-center">
        {/* Foto do Cliente no Dashboard */}
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-2 border-forest-border shadow-2xl flex-shrink-0">
             <img src={userInfo.avatar} alt="Profile" className="w-full h-full object-cover" />
        </div>
        
        <div className="flex-1 text-center md:text-left">
             <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                Olá, <span className="text-primary">{userInfo.name}!</span> 👋
             </h1>
             <p className="text-stone-400 max-w-xl">Bem-vindo de volta ao CVFacil.NG. Aqui está o resumo das suas atividades e atalhos rápidos para o seu sucesso profissional.</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-forest-surface border border-forest-border rounded-[1.5rem] p-8 flex flex-col items-center justify-center text-center hover:border-primary/30 transition-all duration-300 group">
             <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[32px]">description</span>
             </div>
             <p className="text-4xl font-display font-bold text-white mb-1">{resumes.length}</p>
             <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Currículos Criados</p>
        </div>

        {/* BOTÃO DE IMPORTAR PDF COM IA */}
        <button onClick={handleImportClick} className="bg-forest-surface border border-forest-border rounded-[1.5rem] p-8 flex flex-col items-center justify-center text-center hover:border-blue-500/50 hover:bg-blue-900/10 transition-all duration-300 group relative overflow-hidden">
             <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest">AI Pro</div>
             <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[32px]">upload_file</span>
             </div>
             <p className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">Importar PDF</p>
             <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Gemini 3 Flash</p>
        </button>

        <button onClick={() => setIsModalOpen(true)} className="bg-transparent border-2 border-dashed border-forest-border rounded-[1.5rem] p-8 flex flex-col items-center justify-center text-center hover:bg-forest-surface hover:border-primary/50 transition-all duration-300 group">
             <div className="w-16 h-16 rounded-full bg-forest-surface flex items-center justify-center text-stone-400 mb-4 group-hover:bg-primary group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-[32px]">add</span>
             </div>
             <p className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">Criar Novo Currículo</p>
             <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Comece do zero</p>
        </button>
      </div>

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Seus Currículos ({resumes.length})</h3>
            <button className="text-xs font-bold text-primary hover:text-white uppercase tracking-wider">Ver tudo</button>
        </div>
        
        <div className="bg-forest-surface border border-forest-border rounded-[1.5rem] overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-forest-deep text-xs font-bold text-stone-500 uppercase tracking-wider">
                    <tr>
                        <th className="px-6 py-4">Nome do Currículo</th>
                        <th className="px-6 py-4">Última Edição</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-forest-border">
                     {resumes.length > 0 ? (
                        resumes.map((resume) => (
                             <tr key={resume.id} className={`group hover:bg-forest-border/20 transition-colors ${resume.isPinned ? 'bg-primary/5' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        {/* FOTO DO CLIENTE - 3x4 Frame */}
                                        <div className="w-12 aspect-[3/4] rounded-lg overflow-hidden border border-forest-border shadow-lg flex-shrink-0 bg-forest-deep">
                                            {resume.avatarUrl ? (
                                                <img src={resume.avatarUrl} alt="Foto" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-stone-600">
                                                    <span className="material-symbols-outlined text-sm">person</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div>
                                            <div className="flex items-center gap-2">
                                               <p className="font-bold text-white">{resume.fullName} - {resume.role || "Sem título"}</p>
                                               {resume.isPinned && <span className="material-symbols-outlined text-[14px] text-primary" title="Fixado">keep</span>}
                                            </div>
                                            <p className="text-xs text-stone-500">Modelo "{getTemplateName(resume.templateId)}"</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-stone-400">{getLastUpdatedText(resume.lastUpdated)}</td>
                                <td className="px-6 py-4"><span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-full border border-green-500/20">Ativo</span></td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleDownloadPdf(resume)}
                                            className="p-2 text-stone-500 hover:text-white hover:bg-forest-deep rounded-full transition-colors"
                                            title="Baixar PDF no seu computador"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">download</span>
                                        </button>

                                        <button 
                                            onClick={() => handlePin(resume.id)} 
                                            className={`p-2 rounded-full transition-colors ${resume.isPinned ? 'text-primary bg-primary/20' : 'text-stone-500 hover:text-primary hover:bg-forest-deep'}`} 
                                            title={resume.isPinned ? "Desafixar" : "Fixar"}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">{resume.isPinned ? 'keep' : 'keep_public'}</span>
                                        </button>

                                        <button onClick={() => onEdit(resume.id)} className="p-2 text-stone-500 hover:text-white hover:bg-forest-deep rounded-full transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">edit</span>
                                        </button>
                                        
                                        <button onClick={() => requestDelete(resume)} className="p-2 text-stone-500 hover:text-red-500 hover:bg-forest-deep rounded-full transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                </td>
                             </tr>
                        ))
                     ) : (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_open</span>
                                <p>Nenhum currículo encontrado. Crie o seu primeiro agora!</p>
                            </td>
                        </tr>
                     )}
                </tbody>
            </table>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
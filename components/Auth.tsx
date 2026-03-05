import React, { useState, useEffect } from 'react';
import { compressImage, generateUUID } from '../services/resumeService';

const Auth: React.FC<{ onLogin: (name: string, photo: string | null, email: string) => void }> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(""); // Estado para capturar o email
  const [userRole, setUserRole] = useState<'Cliente' | 'Administrador'>('Cliente'); // Estado para o tipo de conta
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Estados para o Controle de Acesso ao Admin (Código 7511)
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState("");

  // Timer para limpar notificação automaticamente
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Manipular upload de foto de perfil com compressão
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        // Notifica usuário que está processando
        // setNotification({ message: "Processando imagem...", type: 'success' }); // Opcional
        const compressedBase64 = await compressImage(file, 300); // Max width 300px para perfil
        setAvatarPreview(compressedBase64);
      } catch (error) {
        console.error("Erro ao processar imagem:", error);
        setNotification({ message: "Erro ao processar a imagem. Tente um arquivo menor ou diferente.", type: 'error' });
      }
    }
  };

  const validateEmail = (email: string) => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  };

  // Função para abrir o modal de código de acesso
  const handleAdminSelectionClick = () => {
      // Se já for admin e clicar de novo, não faz nada ou reseta? Vamos assumir que ele quer confirmar.
      // Se estiver mudando de Cliente para Admin:
      if (userRole !== 'Administrador') {
          setAdminCodeInput("");
          setShowAdminCodeModal(true);
      }
  };

  // Função para validar o código digitado
  const confirmAdminCode = () => {
      if (adminCodeInput === '7511') {
          setUserRole('Administrador');
          setNotification({ message: "Acesso de Administrador liberado.", type: 'success' });
          setShowAdminCodeModal(false);
      } else {
          setNotification({ message: "Código inválido. Acesso negado.", type: 'error' });
          setUserRole('Cliente'); // Garante que volta para Cliente
          setShowAdminCodeModal(false);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação de segurança básica de inputs
    if (!validateEmail(email)) {
        setNotification({ message: "Por favor, insira um endereço de e-mail válido.", type: 'error' });
        return;
    }

    // Se for cadastro, exige nome
    if (!isLogin && name.trim().length < 2) {
        setNotification({ message: "O nome deve ter pelo menos 2 caracteres.", type: 'error' });
        return;
    }
    
    // Lógica para salvar/verificar o usuário na lista de configurações
    try {
        const STORAGE_KEY = 'cv_users_data';
        const storedUsers = localStorage.getItem(STORAGE_KEY);
        let users = storedUsers ? JSON.parse(storedUsers) : [];

        // Se a lista estiver vazia, cria o Admin padrão primeiro
        if (users.length === 0) {
            users.push({ 
                id: 999, 
                name: 'Administrador Master', 
                email: 'admin@cvfacil.ng', 
                plan: 'Premium', 
                status: 'Ativo', 
                lastLogin: 'Sempre', 
                isPinned: true, 
                role: 'Administrador' 
            });
        }

        // Verifica se o usuário já existe (pelo email)
        const userExists = users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());

        if (isLogin) {
            // --- FLUXO DE LOGIN ---
            if (userExists) {
                // Usuário encontrado: Atualiza último login
                const updatedUsers = users.map((u: any) => {
                    if (u.email.toLowerCase() === email.trim().toLowerCase()) {
                        return { ...u, lastLogin: "Agora mesmo" };
                    }
                    return u;
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUsers));
                
                setNotification({ message: `Bem-vindo de volta, ${userExists.name}!`, type: 'success' });
                
                // Login com dados do banco (prioridade)
                setTimeout(() => {
                    onLogin(userExists.name, userExists.avatar || null, userExists.email);
                }, 1000);
            } else {
                // Usuário NÃO encontrado no Login
                setNotification({ message: "Usuário não encontrado. Verifique o e-mail ou cadastre-se.", type: 'error' });
            }
        } else {
            // --- FLUXO DE CADASTRO ---
            if (userExists) {
                // Usuário já existe: Bloqueia cadastro
                setNotification({ message: "Este usuário já existe no aplicativo. Por favor, faça login.", type: 'error' });
            } else {
                // Usuário novo: Cria conta com ID seguro usando UUID centralizado
                const newUser = {
                    id: generateUUID(),
                    name: name.trim() || "Novo Usuário",
                    email: email.trim().toLowerCase(),
                    plan: userRole === 'Administrador' ? "Premium" : "Free",
                    status: "Ativo",
                    lastLogin: "Agora mesmo",
                    isPinned: false,
                    role: userRole, 
                    avatar: avatarPreview,
                    credits: userRole === 'Administrador' ? 999999 : 3
                };
                
                // Tenta salvar com tratamento de erro de cota
                try {
                    users.push(newUser);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
                    
                    setNotification({ message: "Cadastro realizado com sucesso!", type: 'success' });
                    
                    setTimeout(() => {
                        onLogin(newUser.name, newUser.avatar || null, newUser.email);
                    }, 1000);
                } catch (storageError: any) {
                    if (storageError.name === 'QuotaExceededError') {
                        setNotification({ message: "Erro: Armazenamento cheio. Tente usar uma foto menor.", type: 'error' });
                    } else {
                        throw storageError;
                    }
                }
            }
        }
    } catch (error) {
        console.error("Erro ao processar autenticação:", error);
        setNotification({ message: "Erro técnico ao processar solicitação.", type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-forest-deep flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-forest-border/20 rounded-full blur-[100px]"></div>

      {/* Sistema de Notificação (Toast) */}
      {notification && (
        <div className={`fixed top-8 right-8 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-5 duration-300 border backdrop-blur-md ${
            notification.type === 'success' ? 'bg-forest-deep/90 border-green-500/30 text-green-400' : 'bg-red-950/90 border-red-500 text-red-200'
        }`}>
            <div className={`p-2 rounded-full ${notification.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <span className="material-symbols-outlined">{notification.type === 'success' ? 'check' : 'warning'}</span>
            </div>
            <div>
                <p className="font-bold text-sm">Autenticação</p>
                <p className="text-xs opacity-90">{notification.message}</p>
            </div>
        </div>
      )}

      {/* Modal de Validação de Administrador (Moldura 1x3 - Código de Acesso) */}
      {showAdminCodeModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-forest-surface border-2 border-primary rounded-2xl w-full max-w-sm p-8 shadow-[0_0_40px_rgba(217,119,6,0.2)] text-center relative overflow-hidden">
                {/* Efeito de fundo */}
                <div className="absolute inset-0 bg-primary/5"></div>
                
                <div className="relative z-10">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/30">
                        <span className="material-symbols-outlined text-3xl text-primary">admin_panel_settings</span>
                    </div>
                    
                    <h3 className="text-xl font-display font-bold text-white mb-2">Acesso Restrito</h3>
                    <p className="text-sm text-stone-400 mb-6">Digite o código de segurança para criar uma conta de Administrador.</p>
                    
                    <input 
                        type="password" 
                        maxLength={4}
                        placeholder="Código (4 dígitos)"
                        value={adminCodeInput}
                        onChange={(e) => setAdminCodeInput(e.target.value)}
                        className="w-full bg-forest-deep border border-forest-border rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-bold text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 mb-6 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                        autoFocus
                    />
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setShowAdminCodeModal(false); setAdminCodeInput(""); }}
                            className="flex-1 py-3 rounded-xl border border-forest-border text-stone-400 font-bold hover:bg-white/5 transition-colors uppercase text-xs"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmAdminCode}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-secondary transition-colors uppercase text-xs shadow-lg shadow-primary/20"
                        >
                            Verificar
                        </button>
                    </div>
                </div>
           </div>
        </div>
      )}

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-2 bg-forest-base border border-forest-border rounded-[2rem] shadow-2xl overflow-hidden min-h-[600px]">
        
        {/* Left Side (Image) */}
        <div className="relative hidden lg:block h-full group">
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVTQjvn5pw7F16NtbZJazism-82cseCfUwf17qtOpD4RSGdSHsZJC3vhz3HVnZXeJNk6KyK45D4s_yqHcIXJSHzOHZnegDU_GyMcOPGqqJ50lhFWxQ2sp2UqRpXk6gssUwoy3ONYkizBSZO-W_K1Ub5NGMihuPr1Ox9UnmQFWUcWbEhSBjgl1VtDHA3nQowx_vYG9y3Souc64Z1bnoExOyNqinXFs9BnCCMAjd4UoCjKCLvbekzd1kEb5-BQFYVHbwP8iXq-0FW0Pd" 
            alt="Abstract Design" 
            className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-deep via-forest-deep/40 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-12 w-full z-10">
            <div className="inline-flex items-center justify-center p-3 rounded-xl bg-forest-surface/30 backdrop-blur-md border border-white/10 shadow-lg mb-6">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
            </div>
            <h2 className="text-4xl font-display font-bold text-white mb-4 leading-tight">
                Construa sua identidade profissional.
            </h2>
            <p className="text-stone-400 text-lg font-light leading-relaxed">
                Crie currículos modernos, únicos e com modo escuro que otimizam sua apresentação com telas eficientes e criativas.
            </p>
          </div>
        </div>

        {/* Right Side (Form) */}
        <div className="flex flex-col h-full bg-forest-surface/30 backdrop-blur-sm p-8 lg:p-12 justify-center">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-display font-bold text-white mb-2">CVFacil.NG</h1>
                <p className="text-stone-500 text-sm">Bem-vindo de volta!</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-forest-border mb-8">
                <button 
                    onClick={() => { setIsLogin(true); setNotification(null); }}
                    className={`flex-1 pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${isLogin ? 'border-primary text-white' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
                >
                    Login
                </button>
                <button 
                    onClick={() => { setIsLogin(false); setNotification(null); }}
                    className={`flex-1 pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${!isLogin ? 'border-primary text-white' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
                >
                    Cadastro
                </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                
                {/* SELETOR DE TIPO DE CONTA (Apenas Cadastro) */}
                {!isLogin && (
                    <div className="space-y-2 animate-in fade-in duration-300">
                         <label className="text-xs font-bold text-stone-400 uppercase">Tipo de Conta</label>
                         <div className="flex bg-forest-deep rounded-lg p-1 border border-forest-border">
                            <button
                                type="button"
                                onClick={() => setUserRole('Cliente')}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${userRole === 'Cliente' ? 'bg-primary text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                            >
                                Cliente
                            </button>
                            <button
                                type="button"
                                onClick={handleAdminSelectionClick}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${userRole === 'Administrador' ? 'bg-primary text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                            >
                                Administrador
                            </button>
                         </div>
                         {/* Indicador visual de seleção segura */}
                         {userRole === 'Administrador' && (
                            <p className="text-[10px] text-primary flex items-center justify-center gap-1 animate-in fade-in">
                                <span className="material-symbols-outlined text-[12px]">lock</span> Acesso Administrativo Autorizado
                            </p>
                         )}
                    </div>
                )}

                {/* FOTO DO PERFIL - Exibida em Login e Cadastro (Moldura 3x4) */}
                <div className="flex flex-col items-center justify-center pt-2 animate-in fade-in duration-300">
                    <label className="relative w-32 aspect-[3/4] bg-forest-deep border-2 border-dashed border-forest-border rounded-xl flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary hover:bg-forest-surface/50 transition-all group shadow-lg">
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-stone-500 group-hover:text-primary transition-colors p-2 text-center">
                                <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                                <span className="text-[10px] font-bold uppercase leading-tight">Carregar Foto<br/>3x4</span>
                            </div>
                        )}
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleAvatarChange} 
                        />
                    </label>
                    <span className="text-[10px] text-stone-500 mt-2 uppercase font-bold tracking-wider">Foto do Perfil (3x4)</span>
                </div>

                {/* NOME COMPLETO - Exibido em Login e Cadastro */}
                <div className="space-y-2 animate-in fade-in duration-300">
                    <label className="text-xs font-bold text-stone-400 uppercase">Nome Completo</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-3 text-stone-500 text-[20px]">person</span>
                        <input 
                            type="text" 
                            placeholder="Seu Nome" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-forest-deep border border-forest-border rounded-lg py-3 pl-10 pr-4 text-stone-200 focus:border-primary focus:outline-none transition-colors" 
                            required={!isLogin} // Obrigatório apenas no cadastro
                        />
                    </div>
                </div>

                {/* EMAIL */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase">Email</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-3 text-stone-500 text-[20px]">mail</span>
                        <input 
                            type="email" 
                            placeholder="seu@email.com" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-forest-deep border border-forest-border rounded-lg py-3 pl-10 pr-4 text-stone-200 focus:border-primary focus:outline-none transition-colors" 
                            required
                        />
                    </div>
                </div>

                {/* SENHA */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase">Senha</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-3 text-stone-500 text-[20px]">lock</span>
                        <input type="password" placeholder="••••••••" className="w-full bg-forest-deep border border-forest-border rounded-lg py-3 pl-10 pr-4 text-stone-200 focus:border-primary focus:outline-none transition-colors" />
                    </div>
                </div>

                <button type="submit" className="w-full bg-primary hover:bg-secondary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4">
                    <span>{isLogin ? 'Entrar' : 'Criar Conta'}</span>
                    <span className="material-symbols-outlined text-[20px]">{isLogin ? 'login' : 'person_add'}</span>
                </button>
            </form>

            <div className="mt-8 text-center">
                 <a href="#" className="text-xs text-primary hover:text-white transition-colors uppercase tracking-wider font-bold">Esqueceu sua senha?</a>
            </div>
        </div>

      </div>
      
      <div className="absolute bottom-6 text-center text-[10px] text-stone-600 uppercase tracking-widest w-full">
         © 2024 CVFacil.NG. Todos os direitos reservados.
      </div>
    </div>
  );
};

export default Auth;
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ResumeEditor from './components/ResumeEditor';
import Auth from './components/Auth';
import Pricing from './components/Pricing';
import Settings from './components/Settings';
import { ViewState, User } from './types';

// Default user image if none uploaded
const DEFAULT_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuBFDOa0So-GTM4KNs4MclOAiCmMJqLn-RdHiDgP2tTgPGxIWS3Nc0-Gt9icezZdh84NOkL2bm0m7pHG9mp1FuZctejj7Ucq4MGjGFDTWkfSQYSGn_W2QJFJVXeO0JG6ukYRvOhm9xzacoddQfTWf_G9BmGvdkUsqMlYacx41dkVJctjg9_vx7nwhYct7_9ZVNN5YzoBCGSmTRMeqaEGFXb3Q0p-Olk4PFWrh7ukUmEdhZwrjfot_fwflHkZjK3dWXJN5KAi33LVeQqi";

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.AUTH);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('original');
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);

  // Estado do Usuário Logado usando a interface centralizada
  const [userInfo, setUserInfo] = useState<User>({
    name: "Visitante",
    avatar: DEFAULT_AVATAR,
    email: ""
  });

  const handleLogin = (name: string, photo: string | null, email: string) => {
    setUserInfo({
      name: name || "Visitante",
      avatar: photo || DEFAULT_AVATAR,
      email: email || ""
    });
    setView(ViewState.DASHBOARD);
  };
  
  const handleLogout = () => {
    setUserInfo({ name: "Visitante", avatar: DEFAULT_AVATAR, email: "" });
    setView(ViewState.AUTH);
  };

  // Função para atualizar o perfil em tempo real quando alterado nas Configurações
  const handleProfileUpdate = (updatedName: string, updatedEmail: string, updatedAvatar?: string) => {
    setUserInfo(prev => ({
        ...prev,
        name: updatedName,
        email: updatedEmail,
        avatar: updatedAvatar || prev.avatar
    }));
  };

  // Criar novo: reseta o ID de edição
  const handleCreateResume = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setEditingResumeId(null);
    setView(ViewState.EDITOR);
  };

  // Editar existente: define o ID de edição
  const handleEditResume = (resumeId: string) => {
    setEditingResumeId(resumeId);
    setView(ViewState.EDITOR);
  };

  if (view === ViewState.AUTH) {
    return <Auth onLogin={handleLogin} />;
  }

  // Resume Editor takes over the full screen, no sidebar
  if (view === ViewState.EDITOR) {
    return (
      <ResumeEditor 
        initialTemplateId={selectedTemplateId} 
        resumeId={editingResumeId}
        onBack={() => setView(ViewState.DASHBOARD)} 
      />
    );
  }

  return (
    <Layout 
      currentView={view} 
      setView={setView} 
      onLogout={handleLogout} 
      userInfo={userInfo}
    >
       {view === ViewState.DASHBOARD && (
         <Dashboard 
            onCreate={handleCreateResume} 
            onEdit={handleEditResume} 
            userInfo={userInfo}
         />
       )}
       {view === ViewState.PRICING && <Pricing />}
       {view === ViewState.SETTINGS && (
         <Settings 
            userInfo={userInfo} 
            onProfileUpdate={handleProfileUpdate}
         />
       )}
    </Layout>
  );
};

export default App;
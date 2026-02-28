import { useState } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import YouTubeChannelDownload from './components/YouTubeChannelDownload';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('chatapp_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return sessionStorage.getItem('chatapp_tab') || 'chat';
    } catch {
      return 'chat';
    }
  });

  const setActiveTabAndPersist = (tab) => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem('chatapp_tab', tab);
    } catch (_) {}
  };

  const handleLogin = (userData) => {
    const toStore = typeof userData === 'string'
      ? { username: userData, firstName: '', lastName: '' }
      : { username: userData.username, firstName: userData.firstName ?? '', lastName: userData.lastName ?? '' };
    localStorage.setItem('chatapp_user', JSON.stringify(toStore));
    setUser(toStore);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  if (user) {
    return (
      <div className="app-tabs">
        <nav className="app-tab-bar">
          <button
            type="button"
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTabAndPersist('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            className={activeTab === 'youtube' ? 'active' : ''}
            onClick={() => setActiveTabAndPersist('youtube')}
          >
            YouTube Channel Download
          </button>
        </nav>
        {activeTab === 'chat' && <Chat user={user} onLogout={handleLogout} />}
        {activeTab === 'youtube' && <YouTubeChannelDownload />}
      </div>
    );
  }
  return <Auth onLogin={handleLogin} />;
}

export default App;

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Home, Settings, BarChart, Store, Gavel } from 'lucide-react';

interface AppContextType {
  user: { id: string; name: string } | null;
  isWalletConnected: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
}

const AppContext = createContext<AppContextType>({
  user: null,
  isWalletConnected: false,
  connectWallet: () => {},
  disconnectWallet: () => {},
});

const useAppContext = () => useContext(AppContext);

const AgentSetup: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Agent Setup</h1>
      <p className="text-gray-600">Configure your AI agents here.</p>
    </div>
  );
};

const Governance: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Governance</h1>
      <p className="text-gray-600">View and vote on proposals.</p>
    </div>
  );
};

const Marketplace: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Marketplace</h1>
      <p className="text-gray-600">Trade AI agents and services.</p>
    </div>
  );
};

const Dashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600">Welcome to your Ontora AI dashboard.</p>
    </div>
  );
};

const NotFound: React.FC = () => {
  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
      <p className="text-gray-600">The requested page does not exist.</p>
      <Link to="/">
        <Button className="mt-4 bg-teal-50 text-teal-700 hover:bg-teal-100">Go Home</Button>
      </Link>
    </div>
  );
};

const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isWalletConnected, connectWallet, disconnectWallet } = useAppContext();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
    { path: '/agent-setup', label: 'Agent Setup', icon: <Settings className="w-5 h-5" /> },
    { path: '/governance', label: 'Governance', icon: <Gavel className="w-5 h-5" /> },
    { path: '/marketplace', label: 'Marketplace', icon: <Store className="w-5 h-5" /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:block w-64 bg-white shadow-md p-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-teal-700">Ontora AI</h2>
        </div>
        <nav className="space-y-2">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 p-2 rounded-md text-sm font-medium ${
                location.pathname === item.path
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Ontora AI Platform</h1>
          <div className="flex items-center gap-3">
            {isWalletConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Wallet Connected</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={disconnectWallet}
                  className="text-red-600 hover:bg-red-50"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={connectWallet}
                className="bg-teal-50 text-teal-700 hover:bg-teal-100"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);

  const connectWallet = () => {
    setIsWalletConnected(true);
    setUser({ id: 'user-123', name: 'Web3 User' });
  };

  const disconnectWallet = () => {
    setIsWalletConnected(false);
    setUser(null);
  };

  return (
    <AppContext.Provider value={{ user, isWalletConnected, connectWallet, disconnectWallet }}>
      <Router>
        <Routes>
          <Route element={<Layout><Dashboard /></Layout>} path="/" />
          <Route element={<Layout><AgentSetup /></Layout>} path="/agent-setup" />
          <Route element={<Layout><Governance /></Layout>} path="/governance" />
          <Route element={<Layout><Marketplace /></Layout>} path="/marketplace" />
          <Route element={<Layout><NotFound /></Layout>} path="*" />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
};

export default App;

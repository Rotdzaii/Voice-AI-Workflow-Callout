import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import WorkflowBuilder from './components/WorkflowBuilder';
import LoginPage from './pages/LoginPage';

function LoginRoute() {
  const navigate = useNavigate();
  const handleBack = () => navigate(-1);
  const handleOpenCredentials = () => navigate('/login?credentials=1');
  return <LoginPage onBack={handleBack} onOpenCredentials={handleOpenCredentials} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkflowBuilder />} />
        <Route path="/login" element={<LoginRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
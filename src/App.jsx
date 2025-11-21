import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Dashboard from './pages/Dashboard';
import Nodes from './pages/Nodes';
import Pods from './pages/Pods';
import PodDetail from './pages/PodDetail';
import Deployments from './pages/Deployments';
import DeploymentDetail from './pages/DeploymentDetail';
import Services from './pages/Services';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="/pods" element={<Pods />} />
          <Route path="/pods/:namespace/:name" element={<PodDetail />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/deployments/:namespace/:name" element={<DeploymentDetail />} />
          <Route path="services" element={<Services />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

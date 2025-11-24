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
import NodeDetail from './pages/NodeDetail';
import StatefulSets from './pages/StatefulSets';
import StatefulSetDetail from './pages/StatefulSetDetail';
import DaemonSets from './pages/DaemonSets';
import DaemonSetDetail from './pages/DaemonSetDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="/nodes/:name" element={<NodeDetail />} />
          <Route path="/pods" element={<Pods />} />
          <Route path="/pods/:namespace/:name" element={<PodDetail />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/deployments/:namespace/:name" element={<DeploymentDetail />} />
          <Route path="/statefulsets" element={<StatefulSets />} />
          <Route path="/statefulsets/:namespace/:name" element={<StatefulSetDetail />} />
          <Route path="/daemonsets" element={<DaemonSets />} />
          <Route path="/daemonsets/:namespace/:name" element={<DaemonSetDetail />} />
          <Route path="services" element={<Services />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

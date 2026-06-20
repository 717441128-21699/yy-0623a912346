import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Project from "@/pages/Project";
import PageWorkspace from "@/pages/PageWorkspace";
import Members from "@/pages/Members";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/project/:projectId" element={<Project />} />
          <Route path="/project/:projectId/page/:pageId" element={<PageWorkspace />} />
          <Route path="/members" element={<Members />} />
        </Routes>
      </Layout>
    </Router>
  );
}

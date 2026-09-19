import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Pages
import Home from './pages/Home/Home';
import Afiliados from './pages/Afiliados/Afiliados';
import RutasAtencion from './pages/Afiliados/RutasAtencion';
import MadresGestantes from './pages/Afiliados/MadresGestantes';
import PreguntasFrecuentes from './pages/Afiliados/PreguntasFrecuentes';
import Medicamentos from './pages/Afiliados/Medicamentos';
import ResultadosLaboratorio from './pages/Afiliados/ResultadosLaboratorio';
import MedicinaDomiciliaria from './pages/Afiliados/MedicinaDomiciliaria';
import Regimen from './pages/Afiliados/Regimen';
import Requisitos from './pages/Afiliados/Requisitos';
import Copagos from './pages/Afiliados/Copagos';
import PlanBeneficios from './pages/Afiliados/PlanBeneficios';
import PuntosAtencion from './pages/Afiliados/PuntosAtencion';
import ConsultaIps from './pages/Afiliados/ConsultaIps';

import Tramites from './pages/Tramites/Tramites';
import AfiliacionSubsidiado from './pages/Tramites/AfiliacionSubsidiado';
import AfiliacionContributivo from './pages/Tramites/AfiliacionContributivo';
import ConsultaAfiliados from './pages/Tramites/ConsultaAfiliados';
import Certificado from './pages/Tramites/Certificado';
import Portabilidad from './pages/Tramites/Portabilidad';
import ActualizaDatos from './pages/Tramites/ActualizaDatos';
import Autorizaciones from './pages/Tramites/Autorizaciones';
import AgendarCita from './pages/Tramites/AgendarCita';
import AsignacionEps from './pages/Tramites/AsignacionEps';
import EstadoPqrsd from './pages/Tramites/EstadoPqrsd';
import RadicarPqrsd from './pages/Tramites/RadicarPqrsd';

import Atencion from './pages/Atencion/Atencion';

import Nosotros from './pages/Nosotros/Nosotros';
import Historia from './pages/Nosotros/Historia';
import MisionVision from './pages/Nosotros/MisionVision';
import Objetivos from './pages/Nosotros/Objetivos';
import Valores from './pages/Nosotros/Valores';
import Trabaja from './pages/Nosotros/Trabaja';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Afiliados */}
        <Route path="/afiliados" element={<Afiliados />} />
        <Route path="/afiliados/rutas-atencion" element={<RutasAtencion />} />
        <Route path="/afiliados/madres-gestantes" element={<MadresGestantes />} />
        <Route path="/afiliados/preguntas-frecuentes" element={<PreguntasFrecuentes />} />
        <Route path="/afiliados/medicamentos" element={<Medicamentos />} />
        <Route path="/afiliados/resultados-laboratorio" element={<ResultadosLaboratorio />} />
        <Route path="/afiliados/medicina-domiciliaria" element={<MedicinaDomiciliaria />} />
        <Route path="/afiliados/regimen" element={<Regimen />} />
        <Route path="/afiliados/requisitos" element={<Requisitos />} />
        <Route path="/afiliados/copagos" element={<Copagos />} />
        <Route path="/afiliados/plan-beneficios" element={<PlanBeneficios />} />
        <Route path="/afiliados/puntos-atencion" element={<PuntosAtencion />} />
        <Route path="/afiliados/consulta-ips" element={<ConsultaIps />} />

        {/* Trámites */}
        <Route path="/tramites" element={<Tramites />} />
        <Route path="/tramites/afiliacion-subsidiado" element={<AfiliacionSubsidiado />} />
        <Route path="/tramites/afiliacion-contributivo" element={<AfiliacionContributivo />} />
        <Route path="/tramites/consulta-afiliados" element={<ConsultaAfiliados />} />
        <Route path="/tramites/certificado" element={<Certificado />} />
        <Route path="/tramites/portabilidad" element={<Portabilidad />} />
        <Route path="/tramites/actualiza-datos" element={<ActualizaDatos />} />
        <Route path="/tramites/autorizaciones" element={<Autorizaciones />} />
        <Route path="/tramites/agendar-cita" element={<AgendarCita />} />
        <Route path="/tramites/asignacion-eps" element={<AsignacionEps />} />
        <Route path="/tramites/estado-pqrsd" element={<EstadoPqrsd />} />
        <Route path="/tramites/radicar-pqrsd" element={<RadicarPqrsd />} />

        {/* Atención */}
        <Route path="/atencion" element={<Atencion />} />

        {/* Nosotros */}
        <Route path="/nosotros" element={<Nosotros />} />
        <Route path="/nosotros/historia" element={<Historia />} />
        <Route path="/nosotros/mision-vision" element={<MisionVision />} />
        <Route path="/nosotros/objetivos" element={<Objetivos />} />
        <Route path="/nosotros/valores" element={<Valores />} />
        <Route path="/nosotros/trabaja" element={<Trabaja />} />
      </Routes>
    </Layout>
  );
}

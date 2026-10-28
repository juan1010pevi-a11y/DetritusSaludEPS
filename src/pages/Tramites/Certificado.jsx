import { useState } from 'react';
import PageHero from '../../components/PageHero/PageHero';
import InfoCard from '../../components/InfoCard/InfoCard';
import StepList from '../../components/StepList/StepList';
import Alert from '../../components/Alert/Alert';
import { CertificateDocument, PrintableModal } from '../../components/Documents/EpsDocuments';
import { useAuth } from '../../context/AuthContext';
import { getProfile } from '../../services/api';
import './Certificado.css';

export default function Certificado() {
  const { user, role, roles, openLogin, switchRole } = useAuth();
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState(null);

  // Por seguridad el certificado solo se genera con la sesión del afiliado (como en una EPS real).
  const handleSubmit = async event => {
    event.preventDefault();
    if (!user) {
      openLogin({ role: 'affiliate', redirect: '/tramites/certificado', notice: 'Ingresa con tu documento para generar tu certificado.' });
      return;
    }
    try {
      if (role !== 'affiliate') {
        if (!roles.includes('affiliate')) { setStatus('Este documento no tiene afiliación activa en la EPS.'); return; }
        await switchRole('affiliate');
      }
      setProfile(await getProfile(user.document));
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <>
      <PageHero
        label="Trámites en línea"
        title="Certificado de afiliación"
        icon="📜"
        description="Descarga tu certificado vigente."
        image="/img/certificado.jpg"
        breadcrumb={[
          { label: 'Trámites', path: '/tramites' },
          { label: 'Certificado de afiliación' }
        ]}
      />
      <section className="content-section">
        <div className="container">
          <div className="certificate-layout">
            <form className="info-card certificate-form" onSubmit={handleSubmit}>
              <h2>Descarga tu certificado</h2>
              <p className="certificate-form__intro">
                {user ? `Generaremos el certificado de ${user.name} (CC ${user.document}) con código de verificación.` : 'Ingresa con tu documento y contraseña para generar un certificado vigente con código de verificación.'}
              </p>
              <button className="btn btn--primary" type="submit">{user ? 'Generar certificado' : 'Ingresar y generar certificado'}</button>
              {status && <p className="form-status" role="status">{status}</p>}
            </form>
            {profile && (
              <PrintableModal title="Certificado de afiliación" onClose={() => setProfile(null)}>
                <CertificateDocument profile={profile} />
              </PrintableModal>
            )}
            <div className="certificate-steps"><span className="section-label">Proceso digital</span><h2 className="section-heading">Obtén tu certificado en tres pasos</h2><StepList steps={[{title:"Ingresa a tu cuenta",text:"Usa el documento y la contraseña de tu afiliación."},{title:"Genera el certificado",text:"Se crea con tus datos actuales y un código de verificación."},{title:"Imprímelo o guárdalo en PDF",text:"Tiene vigencia de 30 días."}]} /></div>
          </div>
          <Alert type="gold">También puedes solicitarlo gratis en cualquier punto de atención.</Alert>
        </div>
      </section>
    </>
  );
}

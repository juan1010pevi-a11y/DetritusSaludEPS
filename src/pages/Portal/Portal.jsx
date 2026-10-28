import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { initials, ROLE_ORDER, ROLES, RoleIcon } from '../../lib/roles';
import AffiliatePortal from './AffiliatePortal';
import DoctorPortal from './DoctorPortal';
import AdminPortal from './AdminPortal';
import './Portal.css';

export default function Portal() {
  const { user, role, roles, switchRole, openLogin } = useAuth();
  const [error, setError] = useState('');

  if (!user) {
    return (
      <section className="portal-page">
        <div className="container">
          <div className="portal-locked">
            <span className="section-label">Portal Detritus Salud</span>
            <h1 className="section-heading">Ingresa para continuar</h1>
            <p>Afiliados, médicos y administradores acceden a su portal con su documento y contraseña.</p>
            <div className="portal-locked__roles">
              {ROLE_ORDER.map(key => (
                <button key={key} type="button" className={`portal-locked__role role-${key}`} onClick={() => openLogin({ role: key })}>
                  <RoleIcon role={key} />
                  <strong>{ROLES[key].label}</strong>
                  <span>{ROLES[key].description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const change = async next => {
    setError('');
    try { await switchRole(next); } catch (err) { setError(err.message); }
  };

  return (
    <section className={`portal-page role-${role}`}>
      <div className="portal-hero">
        <div className="container portal-hero__inner">
          <div className="portal-hero__avatar">{initials(user.name)}</div>
          <div className="portal-hero__text">
            <span className="role-badge portal-hero__badge"><RoleIcon role={role} /> {ROLES[role].label}</span>
            <h1>{ROLES[role].portalTitle}</h1>
            <p>
              {user.name} · CC {user.document}
              {role === 'doctor' && user.doctor && ` · ${user.doctor.specialty} · ${user.doctor.site || ''}`}
            </p>
          </div>
          {roles.length > 1 && (
            <div className="portal-hero__switch">
              <span>Tus perfiles</span>
              <div>
                {ROLE_ORDER.filter(item => roles.includes(item)).map(item => (
                  <button key={item} type="button" className={`role-${item} ${item === role ? 'is-active' : ''}`} onClick={() => item !== role && change(item)}>
                    <RoleIcon role={item} /> {ROLES[item].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="container portal-body">
        {error && <p className="form-status form-status--error">{error}</p>}
        {role === 'affiliate' && <AffiliatePortal key={`a-${user.id}`} user={user} />}
        {role === 'doctor' && <DoctorPortal key={`d-${user.id}`} user={user} />}
        {role === 'administrator' && <AdminPortal key={`x-${user.id}`} />}
      </div>
    </section>
  );
}

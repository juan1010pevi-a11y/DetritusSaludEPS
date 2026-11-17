const PASSWORD_ENV_BY_ROLE = {
  affiliate: 'DEMO_AFFILIATE_PASSWORD',
  doctor: 'DEMO_DOCTOR_PASSWORD',
  administrator: 'DEMO_ADMIN_PASSWORD',
};

const KNOWN_DEMO_PASSWORDS = new Set(['demo123', 'doctor123', 'medico123', 'admin123']);

function isValidProductionPassword(password) {
  return typeof password === 'string'
    && password.length >= 16
    && password.trim() === password
    && /[A-Za-z]/.test(password)
    && /\d/.test(password)
    && !KNOWN_DEMO_PASSWORDS.has(password);
}

function roleForPerson(person) {
  if (person.roles.includes('administrator')) return 'administrator';
  if (person.roles.includes('doctor')) return 'doctor';
  return 'affiliate';
}

export function resolveDemoPeople(people, { production = false, seedDemo = false, env = process.env } = {}) {
  if (production && !seedDemo) return [];
  if (!production) {
    return people.map(person => ({ ...person, legacyPassword: person.password }));
  }

  const missingOrWeak = Object.values(PASSWORD_ENV_BY_ROLE)
    .filter(key => !isValidProductionPassword(env[key]));
  if (missingOrWeak.length) {
    throw new Error(
      `SEED_DEMO=1 en producción requiere contraseñas distintas de al menos 16 caracteres en: ${missingOrWeak.join(', ')}.`,
    );
  }

  const passwords = Object.values(PASSWORD_ENV_BY_ROLE).map(key => env[key]);
  if (new Set(passwords).size !== passwords.length) {
    throw new Error('Las contraseñas demo de afiliado, médico y administrador deben ser diferentes.');
  }

  return people.map(person => {
    const role = roleForPerson(person);
    return {
      ...person,
      legacyPassword: person.password,
      password: env[PASSWORD_ENV_BY_ROLE[role]],
    };
  });
}

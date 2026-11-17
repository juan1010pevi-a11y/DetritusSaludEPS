import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDemoPeople } from '../src/demo-credentials.js';

const people = [
  { document: '123456789', password: 'demo123', roles: ['affiliate'] },
  { document: '900000001', password: 'doctor123', roles: ['doctor'] },
  { document: '900000002', password: 'admin123', roles: ['administrator'] },
  { document: '1010101010', password: 'demo123', roles: ['affiliate', 'doctor'] },
];

const productionPasswords = {
  DEMO_AFFILIATE_PASSWORD: 'Affiliates-Pass-2026',
  DEMO_DOCTOR_PASSWORD: 'Doctors-Pass-2026-Unique',
  DEMO_ADMIN_PASSWORD: 'Administrator-Pass-2026',
};

test('production leaves demo users disabled unless explicitly enabled', () => {
  assert.deepEqual(resolveDemoPeople(people, { production: true, seedDemo: false }), []);
});

test('development keeps local demo passwords unchanged', () => {
  const resolved = resolveDemoPeople(people, { production: false, seedDemo: false });
  assert.deepEqual(resolved.map(person => person.password), people.map(person => person.password));
});

test('production uses distinct private passwords for each demo role', () => {
  const resolved = resolveDemoPeople(people, {
    production: true,
    seedDemo: true,
    env: productionPasswords,
  });

  assert.deepEqual(resolved.map(person => person.password), [
    productionPasswords.DEMO_AFFILIATE_PASSWORD,
    productionPasswords.DEMO_DOCTOR_PASSWORD,
    productionPasswords.DEMO_ADMIN_PASSWORD,
    productionPasswords.DEMO_DOCTOR_PASSWORD,
  ]);
  assert.deepEqual(resolved.map(person => person.legacyPassword), people.map(person => person.password));
});

test('production rejects missing, weak, duplicate, and published demo passwords', () => {
  assert.throws(() => resolveDemoPeople(people, {
    production: true,
    seedDemo: true,
    env: {},
  }), /DEMO_AFFILIATE_PASSWORD/);

  assert.throws(() => resolveDemoPeople(people, {
    production: true,
    seedDemo: true,
    env: {
      ...productionPasswords,
      DEMO_ADMIN_PASSWORD: 'admin123',
    },
  }), /DEMO_ADMIN_PASSWORD/);

  assert.throws(() => resolveDemoPeople(people, {
    production: true,
    seedDemo: true,
    env: {
      ...productionPasswords,
      DEMO_ADMIN_PASSWORD: productionPasswords.DEMO_DOCTOR_PASSWORD,
    },
  }), /deben ser diferentes/);
});

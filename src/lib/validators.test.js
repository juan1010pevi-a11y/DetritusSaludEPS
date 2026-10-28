// Pruebas del frontend: node --test (no requiere navegador ni dependencias extra).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitsOnly, documentError, maskContact, passwordError, phoneError } from './validators.js';

test('digitsOnly limpia lo que se escribe en campos numéricos', () => {
  assert.equal(digitsOnly('1.020.304.050'), '1020304050');
  assert.equal(digitsOnly('300 123 45 67', 10), '3001234567');
  assert.equal(digitsOnly('abc'), '');
});

test('el documento solo admite números', () => {
  assert.equal(documentError('1020304050'), null);
  assert.ok(documentError('1020-304'));
  assert.ok(documentError('12'));
});

test('celular y contraseña', () => {
  assert.equal(phoneError('3001234567'), null);
  assert.ok(phoneError('6011234567'));
  assert.equal(passwordError('Detritus2026'), null);
  assert.ok(passwordError('12345678'));
});

test('enmascara datos de contacto', () => {
  assert.equal(maskContact('3157654321'), '******4321');
});

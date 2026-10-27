// Catálogo de motores disponibles. Para agregar un motor nuevo basta con crear su módulo
// (exportando `info` y `build`) e incluirlo en esta lista.
import * as jaula from '../motors/induccion-jaula.js';
import * as rotorDevanado from '../motors/induccion-rotor-devanado.js';
import * as sincrono from '../motors/sincrono.js';
import * as ccCampo from '../motors/cc-campo-devanado.js';
import * as ccIman from '../motors/cc-iman-permanente.js';
import * as bldc from '../motors/bldc.js';

export const MOTORS = [jaula, rotorDevanado, sincrono, ccCampo, ccIman, bldc];

export function findMotor(id) {
  return MOTORS.find((m) => m.info.id === id) || MOTORS[0];
}

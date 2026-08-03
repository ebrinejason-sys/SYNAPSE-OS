/**
 * Deterministic clinical calculators — client-side only.
 * Version shown in UI; formulas are standard references (not AI).
 */

export const CALCULATOR_PACK_VERSION = 'synapse-calc-2026.08.1'

export function round(n: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** BMI = weight(kg) / height(m)^2 */
export function calcBmi(weightKg: number, heightCm: number): {
  bmi: number
  category: string
} | null {
  if (!(weightKg > 0 && heightCm > 0)) return null
  const m = heightCm / 100
  const bmi = round(weightKg / (m * m), 1)
  let category = 'Normal weight'
  if (bmi < 18.5) category = 'Underweight'
  else if (bmi < 25) category = 'Normal weight'
  else if (bmi < 30) category = 'Overweight'
  else category = 'Obesity'
  return { bmi, category }
}

/** Ideal body weight (Devine) in kg */
export function calcIbw(sex: 'male' | 'female', heightCm: number): number | null {
  if (!(heightCm > 0)) return null
  const inches = heightCm / 2.54
  const over5ft = Math.max(0, inches - 60)
  const base = sex === 'male' ? 50 : 45.5
  return round(base + 2.3 * over5ft, 1)
}

/**
 * Cockcroft–Gault creatinine clearance (mL/min).
 * serumCreatinine in µmol/L (common in UG labs) or mg/dL when unit='mgdl'.
 */
export function calcCrCl(params: {
  ageYears: number
  weightKg: number
  sex: 'male' | 'female'
  serumCreatinine: number
  unit: 'umol' | 'mgdl'
}): number | null {
  const { ageYears, weightKg, sex, serumCreatinine, unit } = params
  if (!(ageYears > 0 && weightKg > 0 && serumCreatinine > 0)) return null
  const scrMgDl = unit === 'mgdl' ? serumCreatinine : serumCreatinine / 88.4
  if (!(scrMgDl > 0)) return null
  const sexFactor = sex === 'female' ? 0.85 : 1
  return round(((140 - ageYears) * weightKg * sexFactor) / (72 * scrMgDl), 1)
}

/** Pediatric / weight-based dose: total = mgPerKg * weight */
export function calcWeightDose(
  weightKg: number,
  mgPerKg: number,
  dosesPerDay: number,
): { doseMg: number; dailyMg: number } | null {
  if (!(weightKg > 0 && mgPerKg > 0 && dosesPerDay > 0)) return null
  const doseMg = round(mgPerKg * weightKg, 1)
  return { doseMg, dailyMg: round(doseMg * dosesPerDay, 1) }
}

/** IV drip rate (drops/min) = (volume_mL * dropFactor) / time_min */
export function calcDripRate(
  volumeMl: number,
  timeMinutes: number,
  dropFactor: number,
): number | null {
  if (!(volumeMl > 0 && timeMinutes > 0 && dropFactor > 0)) return null
  return round((volumeMl * dropFactor) / timeMinutes, 0)
}

/** eGFR CKD-EPI 2021 (creatinine-only) approx — creatinine µmol/L */
export function calcEgfrCkdEpi(params: {
  ageYears: number
  sex: 'male' | 'female'
  serumCreatinineUmol: number
}): number | null {
  const { ageYears, sex, serumCreatinineUmol } = params
  if (!(ageYears > 0 && serumCreatinineUmol > 0)) return null
  const scr = serumCreatinineUmol / 88.4 // → mg/dL
  const kappa = sex === 'female' ? 0.7 : 0.9
  const alpha = sex === 'female' ? -0.241 : -0.302
  const minScr = Math.min(scr / kappa, 1)
  const maxScr = Math.max(scr / kappa, 1)
  const sexCoeff = sex === 'female' ? 1.012 : 1
  const egfr =
    142 * minScr ** alpha * maxScr ** -1.2 * 0.9938 ** ageYears * sexCoeff
  return round(egfr, 1)
}

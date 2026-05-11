// Step definitions
export const CHATBOT_STEPS = [
  { id: 1,  key: 'symptom',       question: 'What is your main symptom today?',         type: 'select',    options: ['Fever','Headache','Chest Pain','Difficulty Breathing','Cough','Abdominal Pain','Nausea/Vomiting','Joint Pain','Skin Rash','Diarrhoea','Dizziness','Fatigue','Sore Throat','Other'] },
  { id: 2,  key: 'duration',      question: 'How long have you had this symptom?',       type: 'select',    options: ['A few hours','1–3 days','4–7 days','More than a week'] },
  { id: 3,  key: 'severity',      question: 'How severe is it? (1 = mild, 10 = unbearable)', type: 'scale', min: 1, max: 10 },
  { id: 4,  key: 'extraSymptoms', question: 'Do you have any of these additional symptoms?', type: 'multiselect', options: ['Nausea','Vomiting','Diarrhoea','Rash','Swelling','Bleeding','Confusion','Neck stiffness','Light sensitivity','None'] },
  { id: 5,  key: 'medications',   question: 'Are you currently taking any medications?',  type: 'text',     placeholder: 'List them or type "None"' },
  { id: 6,  key: 'allergies',     question: 'Do you have any known allergies?',           type: 'text',     placeholder: 'List them or type "None"' },
  { id: 7,  key: 'conditions',    question: 'Do you have any of these conditions?',       type: 'multiselect', options: ['Diabetes','Hypertension','Heart disease','Asthma','HIV','Cancer','Pregnancy','None'] },
  { id: 8,  key: 'age',           question: 'What is your age?',                          type: 'number',   min: 0, max: 120 },
  { id: 9,  key: 'sex',           question: 'What is your sex?',                          type: 'select',   options: ['Male','Female'] },
  { id: 10, key: 'pregnant',      question: 'Are you pregnant or could you be?',          type: 'select',   options: ['Yes','No','Not applicable'], condition: (answers: any) => answers.sex === 'Female' && answers.age >= 15 && answers.age <= 55 },
  { id: 11, key: 'district',      question: 'Which district are you in?',                 type: 'select',   options: ['Kampala','Wakiso','Mukono','Jinja','Mbale','Gulu','Lira','Mbarara','Fort Portal','Other'] },
  { id: 12, key: 'urgency',       question: 'How soon do you need to see a doctor?',      type: 'select',   options: ['Immediately','Within a few hours','Today','Within 2–3 days','Not urgent'] },
  { id: 13, key: 'insurance',     question: 'Do you have health insurance?',              type: 'select',   options: ['Yes — I have insurance','No — I will pay cash'] },
];

// Calculate triage score from answers
export function calculateTriage(answers: Record<string, any>): {
  level: 'emergency' | 'urgent' | 'routine';
  score: number;
  explanation: string;
} {
  let score = 0;

  // Severity contributes up to 6 points
  const severityVal = parseInt(answers.severity) || 0;
  score += Math.min(severityVal / 10 * 6, 6);

  // Duration contributes
  if (answers.duration === 'A few hours') score += 4;
  else if (answers.duration === '1–3 days') score += 2;

  // Emergency symptoms
  const emergencySymptoms = ['Chest Pain','Difficulty Breathing','Neck stiffness','Confusion','Bleeding'];
  const extraSymptoms = answers.extraSymptoms || [];
  let hasEmergencySymptom = false;
  for (const s of emergencySymptoms) {
    if (answers.symptom === s || (Array.isArray(extraSymptoms) && extraSymptoms.includes(s))) {
      hasEmergencySymptom = true;
      break;
    }
  }
  if (hasEmergencySymptom) score += 4;

  // Urgency declaration
  if (answers.urgency === 'Immediately') score += 3;
  else if (answers.urgency === 'Within a few hours') score += 2;

  // Age extremes
  const ageVal = parseInt(answers.age) || 30;
  if (ageVal > 65 || ageVal < 2) score += 1;

  // Determine level
  let level: 'emergency' | 'urgent' | 'routine';
  let explanation: string;

  if (score >= 8) {
    level = 'emergency';
    explanation = 'Your symptoms suggest you need immediate medical attention. Please go to the nearest emergency room or call emergency services now.';
  } else if (score >= 5) {
    level = 'urgent';
    explanation = 'You should see a doctor today. We have same-day appointments available.';
  } else {
    level = 'routine';
    explanation = 'Your symptoms can be safely assessed in a scheduled appointment within the next few days.';
  }

  return { level, score: Math.round(score * 10) / 10, explanation };
}

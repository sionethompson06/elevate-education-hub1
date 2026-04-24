/**
 * Centralised OpenAI model + temperature config for all AI routes.
 *
 * Models resolve at module load time from env vars, falling back to safe
 * defaults so the server never crashes on a missing variable.
 *
 * To change models without a code deploy, update in Vercel:
 *   OPENAI_MODEL_FAST    → small/fast tasks  (default: gpt-4o-mini)
 *   OPENAI_MODEL_QUALITY → full-lesson tasks (default: gpt-4o)
 */

const FAST_MODEL    = process.env.OPENAI_MODEL_FAST    || 'gpt-4o-mini';
const QUALITY_MODEL = process.env.OPENAI_MODEL_QUALITY || 'gpt-4o';

const TASK_CONFIG = {
  // Active tasks
  support_enhancement:    { model: FAST_MODEL,    temperature: 0.3 },
  full_lesson_enhancement:{ model: QUALITY_MODEL, temperature: 0.4 },

  // Reserved — plug in new route handlers when these features are built
  worksheet_generation:   { model: FAST_MODEL,    temperature: 0.4 }, // TODO: worksheet generator
  assessment_generation:  { model: FAST_MODEL,    temperature: 0.3 }, // TODO: assessment builder
  exit_ticket_generation: { model: FAST_MODEL,    temperature: 0.3 }, // TODO: exit ticket generator
  // unit_planner:        { model: QUALITY_MODEL, temperature: 0.5 }, // TODO: unit planner
};

const FALLBACK_CONFIG = TASK_CONFIG.support_enhancement;

/**
 * @param {string} taskType
 * @returns {string}
 */
export function getOpenAIModelForTask(taskType) {
  return (TASK_CONFIG[taskType] ?? FALLBACK_CONFIG).model;
}

/**
 * @param {string} taskType
 * @returns {number}
 */
export function getOpenAITemperatureForTask(taskType) {
  return (TASK_CONFIG[taskType] ?? FALLBACK_CONFIG).temperature;
}

import { listEduAiModels } from './eduaiClient.js';
import { SYSTEM_SETTING_KEYS, getSystemSetting, setSystemSetting } from './systemSettings.js';

export const DEFAULT_TUTOR_MODEL = 'google:gemini-2.5-flash';
export const DEFAULT_MAX_SUPERVISOR_ITERATIONS = 3;
const MIN_SUPERVISOR_ITERATIONS = 1;
const MAX_SUPERVISOR_ITERATIONS = 5;

function getPreferredDefaultModelId(modelIds) {
  if (modelIds.includes(DEFAULT_TUTOR_MODEL)) return DEFAULT_TUTOR_MODEL;
  return modelIds[0] ?? null;
}

function inferCostTier(modelId = '', modelName = '') {
  const normalized = `${modelId} ${modelName}`.toLowerCase();
  if (/(flash|mini|haiku)/.test(normalized)) return 'LOW';
  if (/(pro|opus|o1|reasoning)/.test(normalized)) return 'HIGH';
  return 'MEDIUM';
}

function inferSummary(modelId = '', modelName = '') {
  const normalized = `${modelId} ${modelName}`.toLowerCase();
  if (/(flash|mini|haiku)/.test(normalized)) {
    return 'Fast response with lower cost; good for everyday guidance and short feedback loops.';
  }
  if (/(pro|opus|o1|reasoning)/.test(normalized)) {
    return 'Higher quality reasoning with higher cost; best when you want stricter review or more nuanced tutoring.';
  }
  return 'Balanced model that trades cost and quality evenly for general tutoring tasks.';
}

export function clampSupervisorIterations(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MAX_SUPERVISOR_ITERATIONS;
  return Math.max(
    MIN_SUPERVISOR_ITERATIONS,
    Math.min(MAX_SUPERVISOR_ITERATIONS, Math.trunc(numeric)),
  );
}

export function normalizeStoredAiModelPolicy(rawPolicy = {}) {
  return {
    allowedTutorModelIds: Array.isArray(rawPolicy.allowedTutorModelIds)
      ? Array.from(
          new Set(
            rawPolicy.allowedTutorModelIds.filter(
              (value) => typeof value === 'string' && value.trim(),
            ),
          ),
        )
      : [],
    defaultTutorModelId:
      typeof rawPolicy.defaultTutorModelId === 'string' && rawPolicy.defaultTutorModelId.trim()
        ? rawPolicy.defaultTutorModelId.trim()
        : null,
    defaultSupervisorModelId:
      typeof rawPolicy.defaultSupervisorModelId === 'string' &&
      rawPolicy.defaultSupervisorModelId.trim()
        ? rawPolicy.defaultSupervisorModelId.trim()
        : null,
    dualLoopEnabled: rawPolicy.dualLoopEnabled !== false,
    maxSupervisorIterations: clampSupervisorIterations(rawPolicy.maxSupervisorIterations),
  };
}

export function resolveAiModelPolicy(rawPolicy = {}, availableModelIds = []) {
  const normalized = normalizeStoredAiModelPolicy(rawPolicy);
  const normalizedModelIds = Array.from(new Set(availableModelIds.filter(Boolean)));

  const allowedTutorModelIds =
    normalized.allowedTutorModelIds.length > 0
      ? normalized.allowedTutorModelIds.filter(
          (modelId) => normalizedModelIds.length === 0 || normalizedModelIds.includes(modelId),
        )
      : normalizedModelIds;

  const fallbackTutorModelId = getPreferredDefaultModelId(allowedTutorModelIds);
  const defaultTutorModelId =
    normalized.defaultTutorModelId &&
    (normalizedModelIds.length === 0 ||
      allowedTutorModelIds.includes(normalized.defaultTutorModelId))
      ? normalized.defaultTutorModelId
      : fallbackTutorModelId;

  const fallbackSupervisorModelId =
    defaultTutorModelId ?? getPreferredDefaultModelId(normalizedModelIds);
  const defaultSupervisorModelId =
    normalized.defaultSupervisorModelId &&
    (normalizedModelIds.length === 0 ||
      normalizedModelIds.includes(normalized.defaultSupervisorModelId))
      ? normalized.defaultSupervisorModelId
      : fallbackSupervisorModelId;

  return {
    allowedTutorModelIds,
    defaultTutorModelId,
    defaultSupervisorModelId,
    dualLoopEnabled: normalized.dualLoopEnabled,
    maxSupervisorIterations: normalized.maxSupervisorIterations,
  };
}

function mapCatalogModel(model) {
  const modelId = `${model.provider.name}:${model.modelId}`;
  const costTier = inferCostTier(modelId, model.name);
  return {
    id: model.id,
    modelId,
    modelName: model.name,
    provider: model.provider.name,
    costTier,
    summary: inferSummary(modelId, model.name),
    roleHint:
      costTier === 'HIGH'
        ? 'Stronger supervisor candidate when you want stricter review quality.'
        : 'Good tutor candidate when you want a responsive student-facing experience.',
  };
}

export async function loadAiModelCatalog() {
  const eduAiModels = await listEduAiModels();
  return eduAiModels
    .filter((model) => model.isActive)
    .map(mapCatalogModel)
    .toSorted((a, b) => a.modelName.localeCompare(b.modelName));
}

export async function getStoredAiModelPolicy() {
  const stored = await getSystemSetting(SYSTEM_SETTING_KEYS.AI_MODEL_POLICY);
  if (!stored?.value) return normalizeStoredAiModelPolicy();

  try {
    return normalizeStoredAiModelPolicy(JSON.parse(stored.value));
  } catch (error) {
    console.error('Failed to parse stored AI model policy:', error);
    return normalizeStoredAiModelPolicy();
  }
}

export async function getAiModelPolicyState() {
  const storedPolicy = await getStoredAiModelPolicy();

  try {
    const availableModels = await loadAiModelCatalog();
    const policy = resolveAiModelPolicy(
      storedPolicy,
      availableModels.map((model) => model.modelId),
    );

    return {
      policy,
      availableModels: availableModels.map((model) => ({
        ...model,
        isAllowedForTutor: policy.allowedTutorModelIds.includes(model.modelId),
        isDefaultTutor: policy.defaultTutorModelId === model.modelId,
        isDefaultSupervisor: policy.defaultSupervisorModelId === model.modelId,
      })),
      availableModelsError: null,
    };
  } catch (error) {
    console.error('Failed to load AI model catalog:', error);
    return {
      policy: resolveAiModelPolicy(storedPolicy, []),
      availableModels: [],
      availableModelsError: String(error),
    };
  }
}

export async function setAiModelPolicy(policyInput) {
  const availableModels = await loadAiModelCatalog();
  const availableModelIds = availableModels.map((model) => model.modelId);
  const nextPolicy = resolveAiModelPolicy(policyInput, availableModelIds);

  if (nextPolicy.allowedTutorModelIds.length === 0) {
    throw new Error('At least one tutor model must be allowed');
  }

  if (
    !nextPolicy.defaultTutorModelId ||
    !nextPolicy.allowedTutorModelIds.includes(nextPolicy.defaultTutorModelId)
  ) {
    throw new Error('defaultTutorModelId must be one of the allowed tutor models');
  }

  if (
    !nextPolicy.defaultSupervisorModelId ||
    !availableModelIds.includes(nextPolicy.defaultSupervisorModelId)
  ) {
    throw new Error('defaultSupervisorModelId must reference an available model');
  }

  await setSystemSetting(SYSTEM_SETTING_KEYS.AI_MODEL_POLICY, JSON.stringify(nextPolicy));
  return getAiModelPolicyState();
}

export async function resolveTutorModelSelection(requestedModelId) {
  const storedPolicy = await getStoredAiModelPolicy();
  const allowedTutorModelIds = storedPolicy.allowedTutorModelIds;

  if (
    requestedModelId &&
    allowedTutorModelIds.length > 0 &&
    !allowedTutorModelIds.includes(requestedModelId)
  ) {
    const error = new Error('Selected tutor model is not allowed');
    error.status = 403;
    throw error;
  }

  return requestedModelId || storedPolicy.defaultTutorModelId || DEFAULT_TUTOR_MODEL;
}

export async function resolveSupervisorSettings() {
  const storedPolicy = await getStoredAiModelPolicy();
  return {
    dualLoopEnabled: storedPolicy.dualLoopEnabled,
    maxSupervisorIterations: storedPolicy.maxSupervisorIterations,
    supervisorModelId:
      storedPolicy.defaultSupervisorModelId ||
      storedPolicy.defaultTutorModelId ||
      DEFAULT_TUTOR_MODEL,
  };
}

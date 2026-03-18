import { auth } from '../auth.js';

export const EDUAI_PROVIDER_ID = 'eduai';

function createStatusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeAuthApiError(error) {
  const message = error?.message || 'Failed to get a valid EduAI access token';

  if (
    message.includes('UNAUTHORIZED') ||
    message.includes('ACCOUNT_NOT_FOUND') ||
    message.includes('REFRESH_TOKEN_NOT_FOUND') ||
    message.includes('Failed to get a valid access token')
  ) {
    return createStatusError('EduAI account is not linked for this user', 401);
  }

  return createStatusError(message, Number.isInteger(error?.status) ? error.status : 502);
}

export async function getEduAiAccessTokenForUser(userId) {
  if (!userId) {
    throw createStatusError('Authentication required', 401);
  }

  try {
    const tokens = await auth.api.getAccessToken({
      body: {
        providerId: EDUAI_PROVIDER_ID,
        userId,
      },
    });

    const accessToken = typeof tokens?.accessToken === 'string' ? tokens.accessToken.trim() : '';

    if (!accessToken) {
      throw createStatusError('EduAI token endpoint returned an invalid access token', 502);
    }

    return accessToken;
  } catch (error) {
    throw normalizeAuthApiError(error);
  }
}

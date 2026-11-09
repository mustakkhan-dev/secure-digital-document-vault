import { CONFIG } from './config.js';

const COGNITO_ENDPOINT = `https://cognito-idp.${CONFIG.awsRegion}.amazonaws.com/`;

/**
 * Sign up a new user with Cognito
 */
export async function register(email, password, fullName) {
  if (CONFIG.enableDemoMode && CONFIG.cognito.userPoolId.includes('XXXX')) {
    // Demo Mock Registration
    const mockUser = { email, fullName, sub: 'demo-user-sub-12345' };
    localStorage.setItem('demo_registered_user', JSON.stringify(mockUser));
    return { success: true, userConfirmed: false, isDemo: true };
  }

  const response = await fetch(COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
    },
    body: JSON.stringify({
      ClientId: CONFIG.cognito.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: fullName },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.__type || 'Registration failed');
  }
  return { success: true, userSub: data.UserSub, userConfirmed: data.UserConfirmed };
}

/**
 * Confirm user email registration with 6-digit verification code
 */
export async function confirmRegistration(email, confirmationCode) {
  if (CONFIG.enableDemoMode && CONFIG.cognito.userPoolId.includes('XXXX')) {
    return { success: true, isDemo: true };
  }

  const response = await fetch(COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp',
    },
    body: JSON.stringify({
      ClientId: CONFIG.cognito.clientId,
      Username: email,
      ConfirmationCode: confirmationCode,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Confirmation failed');
  }
  return { success: true };
}

/**
 * Log in using Cognito USER_PASSWORD_AUTH flow
 */
export async function login(email, password) {
  if (CONFIG.enableDemoMode && CONFIG.cognito.userPoolId.includes('XXXX')) {
    // Simulated demo token for testing
    const demoPayload = {
      sub: 'demo-student-uuid-9876',
      email: email || 'student@university.edu',
      name: 'BTech Candidate',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const mockToken = `demo_header.${btoa(JSON.stringify(demoPayload))}.demo_signature`;
    sessionStorage.setItem('vault_id_token', mockToken);
    sessionStorage.setItem('vault_user', JSON.stringify(demoPayload));
    return { success: true, token: mockToken, user: demoPayload };
  }

  const response = await fetch(COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CONFIG.cognito.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Authentication failed. Please verify your credentials.');
  }

  const authResult = data.AuthenticationResult;
  sessionStorage.setItem('vault_id_token', authResult.IdToken);
  sessionStorage.setItem('vault_access_token', authResult.AccessToken);
  sessionStorage.setItem('vault_refresh_token', authResult.RefreshToken);

  // Decode JWT payload to retrieve user info
  const payloadBase64 = authResult.IdToken.split('.')[1];
  const userClaims = JSON.parse(atob(payloadBase64));
  sessionStorage.setItem('vault_user', JSON.stringify(userClaims));

  return { success: true, token: authResult.IdToken, user: userClaims };
}

/**
 * Check if session is active
 */
export function isAuthenticated() {
  const token = sessionStorage.getItem('vault_id_token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      logout();
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get current authenticated user details
 */
export function getCurrentUser() {
  const userJson = sessionStorage.getItem('vault_user');
  return userJson ? JSON.parse(userJson) : null;
}

/**
 * Get active JWT token for API headers
 */
export function getAuthToken() {
  return sessionStorage.getItem('vault_id_token');
}

/**
 * Log out and clear session
 */
export function logout() {
  sessionStorage.removeItem('vault_id_token');
  sessionStorage.removeItem('vault_access_token');
  sessionStorage.removeItem('vault_refresh_token');
  sessionStorage.removeItem('vault_user');
  window.location.href = 'index.html';
}

export function readStoredAuth() {
  try {
    const sessionAuth = JSON.parse(sessionStorage.getItem("uatAuth") || "null");
    if (sessionAuth?.token && sessionAuth?.user) return sessionAuth;
  } catch {
    // ignore malformed auth cache
  }

  try {
    const localAuth = JSON.parse(localStorage.getItem("uatAuth") || "null");
    if (localAuth?.token && localAuth?.user) return localAuth;
  } catch {
    // ignore malformed auth cache
  }

  return null;
}

export function persistAuth(result, rememberMe) {
  const serialized = JSON.stringify(result);
  const storage = rememberMe ? localStorage : sessionStorage;
  const alternateStorage = rememberMe ? sessionStorage : localStorage;

  alternateStorage.removeItem("uatAuth");
  alternateStorage.removeItem("uatToken");
  alternateStorage.removeItem("uatUserName");
  alternateStorage.removeItem("uatUserRole");

  storage.setItem("uatAuth", serialized);
  storage.setItem("uatToken", result.token);
  storage.setItem("uatUserName", result.user.username);
  storage.setItem("uatUserRole", result.user.role);
}

export function clearStoredAuth() {
  localStorage.removeItem("uatAuth");
  localStorage.removeItem("uatToken");
  localStorage.removeItem("uatUserName");
  localStorage.removeItem("uatUserRole");
  sessionStorage.removeItem("uatAuth");
  sessionStorage.removeItem("uatToken");
  sessionStorage.removeItem("uatUserName");
  sessionStorage.removeItem("uatUserRole");
}
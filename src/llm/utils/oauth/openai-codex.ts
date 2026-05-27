import type {
  OAuthCredentials,
  OAuthLoginCallbacks,
  OAuthProviderInterface,
} from "./types.js";
import type { RuntimeEnv } from "../../../runtime.js";
import type { WizardPrompter } from "../../../wizard/prompts.js";

const OPENAI_CODEX_PROVIDER_ID = "openai-codex";

function createLegacyRuntime(callbacks: OAuthLoginCallbacks): RuntimeEnv {
  return {
    log: (message) => callbacks.onProgress?.(String(message)),
    error: (message) => callbacks.onProgress?.(String(message)),
    exit: (code) => {
      throw new Error(`exit:${code}`);
    },
  };
}

function createLegacyPrompter(callbacks: OAuthLoginCallbacks): WizardPrompter {
  const progress = {
    update: (message: string) => callbacks.onProgress?.(message),
    stop: (message?: string) => {
      if (message) {
        callbacks.onProgress?.(message);
      }
    },
  };
  return {
    intro: async () => {},
    outro: async () => {},
    note: async (message) => callbacks.onProgress?.(message),
    select: async (params) => params.options[0]?.value,
    multiselect: async (params) => params.initialValues ?? [],
    text: async (prompt) =>
      callbacks.onManualCodeInput
        ? await callbacks.onManualCodeInput()
        : await callbacks.onPrompt({
            message: prompt.message,
            placeholder: prompt.placeholder,
          }),
    confirm: async () => false,
    progress: () => progress,
  } as WizardPrompter;
}

async function refreshViaProviderRuntime(refreshToken: string): Promise<OAuthCredentials> {
  const { refreshProviderOAuthCredentialWithPlugin } = await import(
    "../../../plugins/provider-runtime.runtime.js"
  );
  const refreshed = await refreshProviderOAuthCredentialWithPlugin({
    provider: OPENAI_CODEX_PROVIDER_ID,
    context: {
      type: "oauth",
      provider: OPENAI_CODEX_PROVIDER_ID,
      access: "",
      refresh: refreshToken,
      expires: 0,
    },
  });
  if (!refreshed) {
    throw new Error("OpenAI Codex OAuth refresh is unavailable until the OpenAI plugin loads.");
  }
  const credentials: Record<string, unknown> = { ...refreshed };
  delete credentials.type;
  delete credentials.provider;
  return credentials as OAuthCredentials;
}

export async function loginOpenAICodex(
  callbacks: OAuthLoginCallbacks,
): Promise<OAuthCredentials> {
  const { loginOpenAICodexOAuth } = await import("../../../plugins/provider-openai-codex-oauth.js");
  const credentials = await loginOpenAICodexOAuth({
    prompter: createLegacyPrompter(callbacks),
    runtime: createLegacyRuntime(callbacks),
    isRemote: false,
    openUrl: async (url) => {
      await callbacks.onAuth({ url });
    },
  });
  if (!credentials) {
    throw new Error("OpenAI Codex OAuth login did not return credentials.");
  }
  return credentials;
}

export async function refreshOpenAICodexToken(
  refreshToken: string,
): Promise<OAuthCredentials> {
  return await refreshViaProviderRuntime(refreshToken);
}

export const openaiCodexOAuthProvider: OAuthProviderInterface = {
  id: OPENAI_CODEX_PROVIDER_ID,
  name: "ChatGPT Plus/Pro (Codex Subscription)",
  usesCallbackServer: true,

  async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
    return await loginOpenAICodex(callbacks);
  },

  async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
    return await refreshOpenAICodexToken(credentials.refresh);
  },

  getApiKey(credentials: OAuthCredentials): string {
    return credentials.access;
  },
};

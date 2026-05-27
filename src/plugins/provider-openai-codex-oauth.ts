import type { OAuthCredentials } from "../llm/oauth.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { createVpsAwareOAuthHandlers } from "./provider-oauth-flow.js";
import { resolveProviderRuntimePlugin } from "./provider-hook-runtime.js";

const OPENAI_CODEX_PROVIDER_ID = "openai-codex";
const OPENAI_CODEX_OAUTH_METHOD_ID = "oauth";

function isOAuthCredential(value: unknown): value is OAuthCredentials {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.type === "oauth" &&
    record.provider === OPENAI_CODEX_PROVIDER_ID &&
    typeof record.access === "string" &&
    typeof record.refresh === "string" &&
    typeof record.expires === "number"
  );
}

/** @deprecated OpenAI Codex OAuth is owned by the OpenAI plugin auth hook. */
export async function loginOpenAICodexOAuth(params: {
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  isRemote: boolean;
  openUrl: (url: string) => Promise<void>;
  localBrowserMessage?: string;
}): Promise<OAuthCredentials | null> {
  const provider = resolveProviderRuntimePlugin({
    provider: OPENAI_CODEX_PROVIDER_ID,
    config: {},
    bundledProviderVitestCompat: true,
  });
  const oauth = provider?.auth?.find((method) => method.id === OPENAI_CODEX_OAUTH_METHOD_ID);
  if (!oauth) {
    throw new Error("OpenAI Codex OAuth is unavailable until the OpenAI plugin loads.");
  }

  const result = await oauth.run({
    config: {},
    prompter: params.prompter,
    runtime: params.runtime,
    isRemote: params.isRemote,
    openUrl: params.openUrl,
    oauth: {
      createVpsAwareHandlers: createVpsAwareOAuthHandlers,
    },
  });
  const credential = result.profiles[0]?.credential;
  return isOAuthCredential(credential) ? credential : null;
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";

const providerRuntimeMocks = vi.hoisted(() => ({
  runOAuth: vi.fn(),
}));

vi.mock("./provider-hook-runtime.js", () => ({
  resolveProviderRuntimePlugin: vi.fn(() => ({
    auth: [
      {
        id: "oauth",
        run: providerRuntimeMocks.runOAuth,
      },
    ],
  })),
}));

import { loginOpenAICodexOAuth } from "./provider-openai-codex-oauth.js";

function createPrompter(): WizardPrompter {
  const spin = { update: vi.fn(), stop: vi.fn() };
  return {
    intro: vi.fn(async () => {}),
    outro: vi.fn(async () => {}),
    note: vi.fn(async () => {}),
    select: vi.fn(),
    multiselect: vi.fn(),
    text: vi.fn(async () => "http://localhost:1455/auth/callback?code=test"),
    confirm: vi.fn(),
    progress: vi.fn(() => spin),
  } as unknown as WizardPrompter;
}

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn((code: number) => {
      throw new Error(`exit:${code}`);
    }),
  };
}

function createCredential() {
  return {
    type: "oauth" as const,
    provider: "openai-codex",
    access: "access-token",
    refresh: "refresh-token",
    expires: Date.now() + 60_000,
    email: "user@example.com",
  };
}

describe("loginOpenAICodexOAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates OAuth login to the OpenAI provider auth hook", async () => {
    const credential = createCredential();
    const prompter = createPrompter();
    const runtime = createRuntime();
    const openUrl = vi.fn(async () => {});
    providerRuntimeMocks.runOAuth.mockResolvedValueOnce({
      profiles: [{ profileId: "openai-codex:user@example.com", credential }],
    });

    const result = await loginOpenAICodexOAuth({
      prompter,
      runtime,
      isRemote: true,
      openUrl,
      localBrowserMessage: "Complete sign-in in browser...",
    });

    expect(result).toEqual(credential);
    expect(providerRuntimeMocks.runOAuth).toHaveBeenCalledOnce();
    expect(providerRuntimeMocks.runOAuth).toHaveBeenCalledWith({
      config: {},
      prompter,
      runtime,
      isRemote: true,
      openUrl,
      oauth: {
        createVpsAwareHandlers: expect.any(Function),
      },
    });
  });

  it("returns null when the provider hook does not create an OAuth credential", async () => {
    providerRuntimeMocks.runOAuth.mockResolvedValueOnce({ profiles: [] });

    await expect(
      loginOpenAICodexOAuth({
        prompter: createPrompter(),
        runtime: createRuntime(),
        isRemote: false,
        openUrl: async () => {},
      }),
    ).resolves.toBeNull();
  });
});

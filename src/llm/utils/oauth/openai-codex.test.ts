import { beforeEach, describe, expect, it, vi } from "vitest";

type LoginOpenAICodexOAuth =
  typeof import("../../../plugins/provider-openai-codex-oauth.js").loginOpenAICodexOAuth;

const mocks = vi.hoisted(() => ({
  loginOpenAICodexOAuth: vi.fn<LoginOpenAICodexOAuth>(),
  refreshProviderOAuthCredentialWithPlugin: vi.fn(),
}));

vi.mock("../../../plugins/provider-openai-codex-oauth.js", () => ({
  loginOpenAICodexOAuth: mocks.loginOpenAICodexOAuth,
}));

vi.mock("../../../plugins/provider-runtime.runtime.js", () => ({
  refreshProviderOAuthCredentialWithPlugin: mocks.refreshProviderOAuthCredentialWithPlugin,
}));

import { loginOpenAICodex, refreshOpenAICodexToken } from "./openai-codex.js";

function createCredential() {
  return {
    type: "oauth" as const,
    provider: "openai-codex",
    access: "access-token",
    refresh: "refresh-token",
    expires: 1_700_000_000_000,
    accountId: "acct_123",
  };
}

describe("OpenAI Codex OAuth compatibility provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes legacy login callbacks through the OpenAI provider auth hook", async () => {
    const credential = createCredential();
    const onAuth = vi.fn();
    const onPrompt = vi.fn(async () => "manual-code");
    mocks.loginOpenAICodexOAuth.mockImplementationOnce(async (params) => {
      await params.openUrl("https://auth.openai.com/oauth/authorize?state=abc");
      await expect(params.prompter.text({ message: "Paste code" })).resolves.toBe("manual-code");
      return credential;
    });

    await expect(loginOpenAICodex({ onAuth, onPrompt })).resolves.toEqual(credential);

    expect(onAuth).toHaveBeenCalledWith({
      url: "https://auth.openai.com/oauth/authorize?state=abc",
    });
    expect(onPrompt).toHaveBeenCalledWith({ message: "Paste code", placeholder: undefined });
    expect(mocks.loginOpenAICodexOAuth).toHaveBeenCalledWith({
      prompter: expect.any(Object),
      runtime: expect.any(Object),
      isRemote: false,
      openUrl: expect.any(Function),
    });
  });

  it("refreshes through the provider runtime hook without returning auth-profile fields", async () => {
    mocks.refreshProviderOAuthCredentialWithPlugin.mockResolvedValueOnce(createCredential());

    await expect(refreshOpenAICodexToken("old-refresh-token")).resolves.toEqual({
      access: "access-token",
      refresh: "refresh-token",
      expires: 1_700_000_000_000,
      accountId: "acct_123",
    });

    expect(mocks.refreshProviderOAuthCredentialWithPlugin).toHaveBeenCalledWith({
      provider: "openai-codex",
      context: {
        type: "oauth",
        provider: "openai-codex",
        access: "",
        refresh: "old-refresh-token",
        expires: 0,
      },
    });
  });
});

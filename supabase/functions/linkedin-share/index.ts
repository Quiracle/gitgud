import { createClient } from "npm:@supabase/supabase-js@2.76.1";

/**
 * Posts a player's result card to LinkedIn through the "Share on LinkedIn" API product.
 * The player connects once (OAuth 2.0 authorization code flow, `w_member_social`); the
 * client secret and member tokens never leave this function. Every post is an explicit
 * request from the signed-in player, who has seen the image and caption first.
 *
 * Actions (POST JSON, signed-in user JWT required):
 *   status      -> { configured, connected, name?, expired? }
 *   start       { returnPath, redirectUri } -> { url }
 *   finish      { code, state } -> { name, returnPath }
 *   post        { puzzleId, puzzleVersion, text, image } -> { postUrl }
 *   disconnect  -> { connected: false }
 */

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "content-type": "application/json; charset=utf-8" };

const SCOPE = "openid profile w_member_social";
const STATE_TTL_MS = 10 * 60_000;
/** LinkedIn allows 150 member requests a day; a few posts a day is plenty for results. */
const DAILY_POST_LIMIT = 10;
const MAX_TEXT_LENGTH = 3000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

class FriendlyError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response({ error: "LinkedIn sharing isn't available right now." }, 503);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return response({ error: "Log in to post to LinkedIn.", code: "signed_out" }, 401);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const config = readConfig();

  try {
    if (body.action === "status") {
      if (!config) return response({ configured: false, connected: false });
      return response({ configured: true, ...(await status(supabase, user.id)) });
    }
    if (!config) throw new FriendlyError("LinkedIn sharing isn't available right now.", 503, "unavailable");

    switch (body.action) {
      case "start":
        return response(await start(supabase, config, user.id, body));
      case "finish":
        return response(await finish(supabase, config, user.id, body));
      case "post":
        return response(await post(supabase, config, user.id, body));
      case "disconnect":
        await disconnect(supabase, config, user.id);
        return response({ connected: false });
      default:
        return response({ error: "Unknown action." }, 400);
    }
  } catch (error) {
    if (error instanceof FriendlyError) return response({ error: error.message, code: error.code }, error.status);
    console.error(safeError(error));
    return response({ error: "LinkedIn didn't respond as expected. Please try again." }, 502);
  }
});

type Config = NonNullable<ReturnType<typeof readConfig>>;
type Supabase = ReturnType<typeof createClient>;

async function status(supabase: Supabase, userId: string) {
  const { data, error } = await supabase.from("linkedin_connections")
    .select("display_name, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { connected: false };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return { connected: false, expired: true };
  return { connected: true, name: data.display_name ?? undefined };
}

async function start(supabase: Supabase, config: Config, userId: string, body: Record<string, unknown>) {
  const returnPath = safeReturnPath(body.returnPath);
  const redirectUri = typeof body.redirectUri === "string" ? body.redirectUri : "";
  if (!config.redirectUris.includes(redirectUri)) {
    throw new FriendlyError("LinkedIn isn't set up for this address.", 400, "redirect_not_allowed");
  }

  // Old states are useless; clearing them here keeps the table small without a cron job.
  await supabase.from("linkedin_oauth_states").delete().lt("expires_at", new Date().toISOString());

  const state = randomToken();
  const inserted = await supabase.from("linkedin_oauth_states").insert({
    state_hash: await sha256(state),
    user_id: userId,
    return_path: returnPath,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  });
  if (inserted.error) throw inserted.error;

  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPE);
  return { url: url.toString() };
}

async function finish(supabase: Supabase, config: Config, userId: string, body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code : "";
  const state = typeof body.state === "string" ? body.state : "";
  if (!code || !state || code.length > 2000 || state.length > 200) {
    throw new FriendlyError("LinkedIn didn't send back a valid connection.", 400, "invalid_callback");
  }

  // Single use: the row is deleted as it's read, and it must belong to this user.
  const consumed = await supabase.from("linkedin_oauth_states")
    .delete()
    .eq("state_hash", await sha256(state))
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .select("return_path, redirect_uri")
    .maybeSingle();
  if (consumed.error) throw consumed.error;
  if (!consumed.data) throw new FriendlyError("This LinkedIn connection expired. Please try again.", 400, "invalid_state");

  const exchange = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: consumed.data.redirect_uri as string,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  const tokens = await exchange.json().catch(() => ({}));
  if (!exchange.ok || typeof tokens.access_token !== "string") {
    throw new Error(`LinkedIn token exchange ${exchange.status}: ${tokens.error_description ?? tokens.error ?? "failed"}`);
  }
  const grantedScopes = String(tokens.scope ?? "").split(/[\s,]+/);
  if (!grantedScopes.includes("w_member_social")) {
    throw new FriendlyError("GitGud needs permission to post for you. Please allow it on LinkedIn.", 403, "missing_scope");
  }

  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || typeof profile.sub !== "string") {
    throw new Error(`LinkedIn userinfo ${profileResponse.status}`);
  }

  const expiresIn = Number(tokens.expires_in);
  const saved = await supabase.from("linkedin_connections").upsert({
    user_id: userId,
    member_urn: `urn:li:person:${profile.sub}`,
    display_name: typeof profile.name === "string" ? profile.name.slice(0, 120) : null,
    token_ciphertext: await encrypt(config.tokenKey, tokens.access_token),
    scope: grantedScopes.join(" "),
    expires_at: new Date(Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 60 * 86_400) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (saved.error) throw saved.error;

  return { name: typeof profile.name === "string" ? profile.name : undefined, returnPath: consumed.data.return_path };
}

async function post(supabase: Supabase, config: Config, userId: string, body: Record<string, unknown>) {
  const puzzleId = typeof body.puzzleId === "string" ? body.puzzleId.trim() : "";
  const puzzleVersion = Number(body.puzzleVersion);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!puzzleId || puzzleId.length > 120 || !Number.isInteger(puzzleVersion) || puzzleVersion < 1) {
    throw new FriendlyError("This result can't be posted.", 400, "invalid_request");
  }
  if (!text || text.length > MAX_TEXT_LENGTH) {
    throw new FriendlyError(`Write a caption of up to ${MAX_TEXT_LENGTH} characters.`, 400, "invalid_text");
  }
  const image = decodePng(body.image);

  const recent = await supabase.from("linkedin_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "posted")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (recent.error) throw recent.error;
  if ((recent.count ?? 0) >= DAILY_POST_LIMIT) {
    throw new FriendlyError(`You can post ${DAILY_POST_LIMIT} results a day. Try again tomorrow.`, 429, "rate_limited");
  }

  const connection = await supabase.from("linkedin_connections")
    .select("member_urn, token_ciphertext, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (connection.error) throw connection.error;
  if (!connection.data || new Date(connection.data.expires_at as string).getTime() <= Date.now()) {
    throw new FriendlyError("Connect LinkedIn to post.", 401, "not_connected");
  }
  const accessToken = await decrypt(config.tokenKey, connection.data.token_ciphertext as string);
  const author = connection.data.member_urn as string;

  try {
    const asset = await uploadImage(accessToken, author, image);
    const created = await linkedIn(accessToken, "https://api.linkedin.com/v2/ugcPosts", {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "IMAGE",
          media: [{
            status: "READY",
            media: asset,
            title: { text: "GitGud daily result" },
            description: { text: "A spoiler-free GitGud result card." },
          }],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    });
    const postUrn = created.headers.get("x-restli-id") ?? "";
    await supabase.from("linkedin_posts").insert({
      user_id: userId,
      puzzle_id: puzzleId,
      puzzle_version: puzzleVersion,
      post_urn: postUrn || null,
      status: "posted",
    });
    return { postUrl: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : "https://www.linkedin.com/feed/" };
  } catch (error) {
    await supabase.from("linkedin_posts").insert({
      user_id: userId,
      puzzle_id: puzzleId,
      puzzle_version: puzzleVersion,
      status: "failed",
      error_summary: safeError(error),
    });
    if (error instanceof LinkedInAuthError) {
      // Revoked or expired on LinkedIn's side: forget the token so the player reconnects.
      await supabase.from("linkedin_connections").delete().eq("user_id", userId);
      throw new FriendlyError("LinkedIn asked to reconnect. Connect again to post.", 401, "not_connected");
    }
    throw error;
  }
}

async function disconnect(supabase: Supabase, config: Config, userId: string) {
  const { data } = await supabase.from("linkedin_connections")
    .select("token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    // Best effort: revoke on LinkedIn too, but always forget the token here.
    try {
      await fetch("https://www.linkedin.com/oauth/v2/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          token: await decrypt(config.tokenKey, data.token_ciphertext as string),
        }),
      });
    } catch (error) {
      console.error(safeError(error));
    }
  }
  const deleted = await supabase.from("linkedin_connections").delete().eq("user_id", userId);
  if (deleted.error) throw deleted.error;
}

/** Register, then upload: the documented two-step image flow for member shares. */
async function uploadImage(accessToken: string, owner: string, image: Uint8Array): Promise<string> {
  const registered = await linkedIn(accessToken, "https://api.linkedin.com/v2/assets?action=registerUpload", {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner,
      serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
    },
  });
  const value = (await registered.json())?.value;
  const uploadUrl = value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const asset = value?.asset;
  if (typeof uploadUrl !== "string" || typeof asset !== "string" || !uploadUrl.startsWith("https://")) {
    throw new Error("LinkedIn registerUpload returned no upload URL.");
  }

  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "image/png" },
    body: image,
  });
  if (uploaded.status === 401) throw new LinkedInAuthError();
  if (!uploaded.ok) throw new Error(`LinkedIn image upload ${uploaded.status}`);
  return asset;
}

class LinkedInAuthError extends Error {
  constructor() {
    super("LinkedIn rejected the access token.");
  }
}

async function linkedIn(accessToken: string, url: string, payload: unknown): Promise<Response> {
  const result = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });
  if (result.status === 401) throw new LinkedInAuthError();
  if (!result.ok) {
    const detail = await result.text().catch(() => "");
    throw new Error(`LinkedIn ${new URL(url).pathname} ${result.status}: ${detail.slice(0, 500)}`);
  }
  return result;
}

function decodePng(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) {
    throw new FriendlyError("The result image is missing or too large.", 400, "invalid_image");
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    throw new FriendlyError("The result image couldn't be read.", 400, "invalid_image");
  }
  if (bytes.length > MAX_IMAGE_BYTES || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new FriendlyError("The result image couldn't be read.", 400, "invalid_image");
  }
  return bytes;
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.length > 200) {
    return "/";
  }
  return value;
}

/** Missing secrets mean the feature is off, not broken: status reports `configured: false`. */
function readConfig() {
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID");
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET");
  const redirectUris = (Deno.env.get("LINKEDIN_REDIRECT_URIS") ?? "").split(",").map((uri) => uri.trim()).filter(Boolean);
  const tokenKey = Deno.env.get("LINKEDIN_TOKEN_KEY");
  if (!clientId || !clientSecret || !redirectUris.length || !tokenKey) return undefined;
  return { clientId, clientSecret, redirectUris, tokenKey };
}

// --- Token encryption: AES-256-GCM with a 32-byte base64 key from LINKEDIN_TOKEN_KEY. ---

async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0));
  if (raw.length !== 32) throw new Error("LINKEDIN_TOKEN_KEY must be 32 bytes, base64 encoded.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(secret: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), new TextEncoder().encode(plain)));
  return `v1.${toBase64(iv)}.${toBase64(sealed)}`;
}

async function decrypt(secret: string, stored: string): Promise<string> {
  const [version, iv, sealed] = stored.split(".");
  if (version !== "v1" || !iv || !sealed) throw new Error("Unknown token format.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await aesKey(secret), fromBase64(sealed));
  return new TextDecoder().decode(plain);
}

function randomToken(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

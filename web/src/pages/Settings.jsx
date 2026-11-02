import { useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, X } from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { api } from "../lib/api.js";
import { useAction, useHealth, useLimits, useUsage } from "../lib/queries.js";
import { dateLong, dateTime, num } from "../lib/format.js";
import ApiKeyForm from "../components/ApiKeyForm.jsx";
import { Avatar, Empty, ErrorNotice, PageHead, Skeleton, useConfirm } from "../components/ui.jsx";

// Plain names for the Instagram scopes the provider reports.
const SCOPES = {
  instagram_business_basic: "Read profile",
  instagram_business_content_publish: "Publish posts",
  instagram_business_manage_insights: "Read analytics",
  instagram_business_manage_comments: "Reply to and hide comments",
  instagram_business_manage_messages: "Send DMs",
};

const daysUntil = (iso) => Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 86400_000));

export default function Settings() {
  const { hasKey, account, accounts, accountId, profileId, select } = useAccount();
  const usage = useUsage(hasKey);
  const limits = useLimits(hasKey ? accountId : null, profileId);
  const qc = useQueryClient();
  const [ask, dialog] = useConfirm();
  const removeKey = useAction(() => api.del("/session/key"), {
    success: "API key removed from this computer",
    onSuccess: (data) => {
      qc.setQueryData(["session"], data);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    },
  });

  const pub = limits.data?.publishing;

  return (
    <div className="page">
      {dialog}
      <PageHead title="Settings" sub={account ? `Your connection and the health of @${account.username}` : "Connect your account"} />

      <div className="grid halves equal-row">
        <section className="card" style={{ gap: 16 }}>
          <div>
            <h2>API key</h2>
            <span className="card-sub" style={{ fontFamily: "var(--font)", fontSize: 13 }}>
              Stored in this project's .env file and only used by the local server. The browser never sees it
            </span>
          </div>
          {hasKey && (
            <span className="status">
              <span className="dot on" /> Connected{usage.data?.plan ? ` · ${usage.data.plan} plan` : ""}
            </span>
          )}
          <ApiKeyForm submitLabel={hasKey ? "Save key" : "Connect"} />
          {hasKey && (
            <button
              className="btn ghost sm danger"
              style={{ alignSelf: "flex-start" }}
              onClick={async () =>
                (await ask({
                  title: "Remove the API key?",
                  body: "The app stops loading data until you add a key again. Nothing changes on Instagram.",
                  confirmLabel: "Remove key",
                  danger: true,
                })) && removeKey.mutate()
              }
            >
              <LogOut size={14} strokeWidth={1.5} /> Remove key from this computer
            </button>
          )}
        </section>

        <section className="card" style={{ gap: 16 }}>
          <div>
            <h2>Instagram publishing limit</h2>
            <span className="card-sub" style={{ fontFamily: "var(--font)", fontSize: 13 }}>
              Instagram caps how many posts an app can publish per account each day
            </span>
          </div>
          {!hasKey ? (
            <p className="muted">Connect a key to see limits</p>
          ) : limits.isLoading ? (
            <Skeleton h={100} />
          ) : limits.isError ? (
            <ErrorNotice error={limits.error} />
          ) : (
            <>
              {pub ? (
                <>
                  <div className="figure">
                    <b>{num(pub.used)}</b>
                    <span className="secondary">
                      of {num(pub.total)} in the last {Math.round(pub.windowSeconds / 3600)} hours
                    </span>
                  </div>
                  <div className="meter">{pub.used > 0 && <div style={{ width: `${Math.min(100, (pub.used / pub.total) * 100)}%` }} />}</div>
                </>
              ) : (
                <p className="muted">Instagram did not report a limit</p>
              )}
              <div>
                <div className="kv">
                  <span>Posting queue</span>
                  <span className={limits.data.queue ? "" : "muted"}>
                    {limits.data.queue ? `Next slot ${dateTime(limits.data.queue.nextSlot)}` : "Not set up"}
                  </span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {hasKey && <Health accountId={accountId} account={account} />}

      {accounts.length > 1 && (
        <section className="card section">
          <h2 style={{ marginBottom: 12 }}>Instagram accounts</h2>
          {accounts.map((a) => (
            <div className="row" key={a.id}>
              <Avatar src={a.avatarUrl} name={a.username} />
              <div className="grow">
                <div>@{a.username}</div>
                <div className="mono muted">{num(a.followers)} followers</div>
              </div>
              {a.id === accountId ? (
                <span className="status">
                  <span className="dot on" /> In use
                </span>
              ) : (
                <button className="btn sm" onClick={() => select(a.id)}>
                  Use this account
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Health({ accountId, account }) {
  const health = useHealth(accountId);
  const h = health.data;
  const dot = h?.status === "healthy" ? "on" : h?.status === "warning" ? "warn" : "off";
  return (
    <section className="card section" style={{ marginTop: 16 }}>
      <h2 style={{ marginBottom: 16 }}>Account health</h2>
      {health.isLoading ? (
        <Skeleton h={200} />
      ) : health.isError ? (
        <ErrorNotice error={health.error} onRetry={health.refetch} />
      ) : !h ? (
        <Empty title="No health data" />
      ) : (
        <>
          <div className="row" style={{ borderBottom: 0, marginBottom: 8 }}>
            <Avatar src={account?.avatarUrl} name={account?.username} size="lg" />
            <div className="grow">
              <div style={{ fontWeight: 500 }}>
                {account?.displayName ? `${account.displayName} · ` : ""}@{account?.username}
              </div>
              <div className="mono muted">Instagram professional account · {num(account?.followers)} followers</div>
            </div>
            <span className="status" style={{ color: "var(--text)" }}>
              <span className={`dot ${dot}`} /> {h.status === "healthy" ? "Healthy" : h.status === "warning" ? "Needs attention" : "Broken"}
            </span>
          </div>
          {(h.issues.length > 0 || h.messagingRestriction) && (
            <div className="notice error" style={{ marginBottom: 16 }}>
              <X size={16} strokeWidth={1.5} />
              <div>
                {[...h.issues, h.messagingRestriction].filter(Boolean).map((i) => (
                  <div key={i}>{i}</div>
                ))}
                {h.recommendations.map((r) => (
                  <div key={r} className="muted">
                    {r}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid halves" style={{ gap: 32 }}>
            <div>
              <div className="kv">
                <span>Access token</span>
                <span className={h.tokenValid ? "positive" : "negative"}>{h.tokenValid ? "Valid" : "Invalid"}</span>
              </div>
              <div className="kv">
                <span>Expires</span>
                <span>{h.tokenExpiresAt ? `${dateLong(h.tokenExpiresAt)}, in ${daysUntil(h.tokenExpiresAt)} days` : "Not reported"}</span>
              </div>
              <div className="kv">
                <span>Analytics sync</span>
                <span>
                  {h.analyticsSync === "ok" ? "OK" : h.analyticsSync || "Unknown"}
                  {h.analyticsSyncedAt ? `, ${dateTime(h.analyticsSyncedAt)}` : ""}
                </span>
              </div>
              <div className="kv">
                <span>Messaging limits</span>
                <span>{h.messagingRestriction ? "Restricted" : "None"}</span>
              </div>
            </div>
            <div>
              <span className="secondary" style={{ fontSize: 13 }}>
                Permissions
              </span>
              <div style={{ marginTop: 8 }}>
                {h.permissions.map((p) => (
                  <div className="perm" key={p.scope}>
                    {p.granted ? <Check size={14} strokeWidth={1.5} className="positive" /> : <X size={14} strokeWidth={1.5} className="negative" />}
                    <span className="grow">{SCOPES[p.scope] || p.scope}</span>
                    <span className="mono muted" style={{ fontSize: 11 }}>
                      {p.scope}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

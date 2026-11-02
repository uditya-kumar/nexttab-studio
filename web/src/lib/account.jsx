import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAccounts, useSession } from "./queries.js";

const AccountContext = createContext(null);
const STORAGE_KEY = "nexttab.accountId";

export function AccountProvider({ children }) {
  const session = useSession();
  const hasKey = !!session.data?.hasKey;
  const accountsQuery = useAccounts(hasKey);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(STORAGE_KEY));

  const accounts = accountsQuery.data || [];
  const account = accounts.find((a) => a.id === selectedId) || accounts[0] || null;

  useEffect(() => {
    if (account?.id) localStorage.setItem(STORAGE_KEY, account.id);
  }, [account?.id]);

  const value = useMemo(
    () => ({
      session,
      hasKey,
      dashboardUrl: session.data?.dashboardUrl || null,
      accounts,
      accountsQuery,
      account,
      accountId: account?.id || null,
      profileId: account?.profileId || null,
      select: setSelectedId,
    }),
    [session, hasKey, accounts, accountsQuery, account],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export const useAccount = () => useContext(AccountContext);

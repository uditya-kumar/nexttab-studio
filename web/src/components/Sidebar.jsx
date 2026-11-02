import { NavLink } from "react-router-dom";
import {
  ChartLine,
  Clapperboard,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  Settings,
  Zap,
} from "lucide-react";
import { useAccount } from "../lib/account.jsx";
import { useAutomations } from "../lib/queries.js";
import { num } from "../lib/format.js";
import { Avatar, ICON } from "./ui.jsx";

export default function Sidebar() {
  const { account, hasKey } = useAccount();
  const automations = useAutomations(hasKey);
  const live = (automations.data || []).filter((a) => a.active).length;

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span>Nexttab Studio</span>
      </div>

      {hasKey && (
        <>
          <div className="nav-label">Account</div>
          <div className="nav">
            <Item to="/" icon={LayoutDashboard} end>
              Overview
            </Item>
            <Item to="/analytics" icon={ChartLine}>
              Analytics
            </Item>
          </div>

          <div className="nav-label">Publish</div>
          <div className="nav">
            <Item to="/content" icon={Clapperboard}>
              Content
            </Item>
            <Item to="/compose" icon={PenLine}>
              New post
            </Item>
          </div>

          <div className="nav-label">Engage</div>
          <div className="nav">
            <Item to="/inbox" icon={Inbox}>
              Messages
            </Item>
            <Item to="/comments" icon={MessageSquare}>
              Comments
            </Item>
            <Item to="/automations" icon={Zap} count={automations.data ? `${live} live` : null}>
              Automations
            </Item>
          </div>
        </>
      )}

      <div className="sidebar-foot">
        <div className="nav">
          <Item to="/settings" icon={Settings}>
            Settings
          </Item>
        </div>
        {account && (
          <a
            className="account-chip"
            href={`https://www.instagram.com/${account.username}/`}
            target="_blank"
            rel="noreferrer"
            title="Open on Instagram"
          >
            <Avatar src={account.avatarUrl} name={account.username} />
            <span className="who">
              <b>@{account.username}</b>
              <span className="mono muted">{num(account.followers)} followers</span>
            </span>
          </a>
        )}
      </div>
    </nav>
  );
}

function Item({ to, icon: Icon, children, count, end }) {
  return (
    <NavLink to={to} end={end}>
      <Icon {...ICON} />
      <span>{children}</span>
      {count && <span className="count">{count}</span>}
    </NavLink>
  );
}

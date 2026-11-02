// The Zernio provider. Every export here is part of the provider contract that routes rely on.
// A replacement provider must export the same areas and functions with the same domain shapes.
import * as accounts from "./accounts.js";
import * as analytics from "./analytics.js";
import * as posts from "./posts.js";
import * as inbox from "./inbox.js";
import * as comments from "./comments.js";
import * as automations from "./automations.js";

export default {
  name: "zernio",
  dashboardUrl: "https://zernio.com/dashboard",
  accounts,
  analytics,
  posts,
  inbox,
  comments,
  automations,
};

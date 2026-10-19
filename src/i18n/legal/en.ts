import { LEGAL_DOMAIN, LEGAL_EMAIL, LEGAL_OWNER, LEGAL_REPOSITORY, type LegalDocument } from "./types";

export const en: LegalDocument = {
  title: "Legal",
  updated: "Last updated {date}",
  jumpTo: "Jump to section",
  sections: [
    {
      id: "privacy",
      chip: "Privacy",
      title: "Privacy policy",
      blocks: [
        { kind: "h3", text: "Who is responsible for your data" },
        {
          kind: "p",
          text: `GitGud (${LEGAL_DOMAIN}) is run by ${LEGAL_OWNER}, based in Spain, who is the controller of your personal data under the EU General Data Protection Regulation (GDPR) and Spain's data protection law (LOPDGDD). For anything about your data, write to <mail>${LEGAL_EMAIL}</mail>.`,
        },
        { kind: "h3", text: "Play without an account" },
        {
          kind: "p",
          text: "You can play every puzzle as a guest. Guest progress, attempts and settings stay in your browser's storage on your device and are not sent to us, unless you choose to join a daily leaderboard as a guest.",
        },
        { kind: "h3", text: "What we collect and why" },
        {
          kind: "table",
          head: ["Data", "Why", "Legal basis", "Kept"],
          rows: [
            [
              "Email, name, avatar and account ID from Google or GitHub",
              "Create your account and sign you in",
              "Providing the service you asked for (Art. 6.1.b GDPR)",
              "Until you delete your account",
            ],
            [
              "Leaderboard name and avatar",
              "Show you on the daily leaderboard",
              "Providing the service (Art. 6.1.b)",
              "Until you change it or delete your account",
            ],
            [
              "If you join a leaderboard as a guest: the name you choose, your solve time, restarts and commands, a random guest code, and a one-way code made from your network address",
              "Show you on the daily leaderboard without an account, and limit how many guest names one network can add",
              "Providing the service you asked for (Art. 6.1.b) and our legitimate interest in preventing abuse (Art. 6.1.f)",
              "Until you log in on that device, or ask us to remove it",
            ],
            [
              "Puzzle attempts: solve time, restarts, commands, hints, dates",
              "Sync progress across devices, rank you, count streaks and achievements",
              "Providing the service (Art. 6.1.b)",
              "Until you delete your account",
            ],
            [
              "What you type into AI practice (up to 200 characters) and the puzzle created",
              "Generate your practice puzzle and limit how often it can be used",
              "Providing the service (Art. 6.1.b)",
              "Until you delete your account",
            ],
            [
              "LinkedIn member ID, name, an encrypted access token and a record of posts made from GitGud",
              "Post a result to LinkedIn when you confirm it",
              "Your consent (Art. 6.1.a), which you withdraw by disconnecting LinkedIn",
              "Until you disconnect, the token expires or you delete your account",
            ],
            [
              "Usage statistics from Google Analytics: pages visited, device and browser type, approximate location and a random cookie ID",
              "Understand how GitGud is played and improve it",
              "Your consent (Art. 6.1.a), which you can withdraw at any time in Account settings",
              "Up to 14 months",
            ],
            [
              "IP address and browser details in our providers' technical logs",
              "Keep the service running and secure",
              "Legitimate interest (Art. 6.1.f)",
              "The short periods our providers set",
            ],
          ],
        },
        {
          kind: "p",
          text: "We don't sell your data, show ads, or make automated decisions with legal or similarly significant effects about you. We only use analytics if you accept analytics cookies.",
        },
        { kind: "h3", text: "What other players see" },
        {
          kind: "p",
          text: "The daily leaderboard is public. It shows your leaderboard name, avatar, rank, solve time and restarts. It never shows your email. You can choose a different leaderboard name in Account settings. Guest names are marked as guests.",
        },
        { kind: "h3", text: "Who helps us run GitGud" },
        {
          kind: "list",
          items: [
            "<b>Supabase</b>: database, sign-in and server functions.",
            "<b>Vercel</b>: hosts the website.",
            "<b>Google Analytics</b>: usage statistics, only if you accept analytics cookies.",
            "<b>OpenAI</b>: generates puzzles. It receives only your practice text, never your name or email.",
            "<b>Google and GitHub</b>: sign you in under their own privacy policies.",
            "<b>LinkedIn</b>: only if you connect it, under its own privacy policy.",
          ],
        },
        {
          kind: "p",
          text: "Some of these companies are based in the United States. Transfers rely on the EU–US Data Privacy Framework or the European Commission's Standard Contractual Clauses.",
        },
        { kind: "h3", text: "Your rights" },
        {
          kind: "p",
          text: `You can ask to access, correct, delete or export your data, to restrict or object to its use, and to withdraw any consent you gave. Write to <mail>${LEGAL_EMAIL}</mail> from the email of your account; we answer within one month. Until in-app account deletion is ready, email us and we will delete your account and data within 30 days. If you're unhappy with our answer, you can complain to the Spanish Data Protection Agency (AEPD) at <url>https://www.aepd.es</url>.`,
        },
        { kind: "h3", text: "Minimum age" },
        {
          kind: "p",
          text: "You must be at least 14 to create an account. Younger players can play as guests, or create an account with a parent or guardian's consent.",
        },
        { kind: "h3", text: "Security" },
        {
          kind: "p",
          text: "Connections use HTTPS. Database rules let each player read and change only their own records, and LinkedIn tokens are stored encrypted.",
        },
        { kind: "h3", text: "Changes" },
        {
          kind: "p",
          text: "When this page changes, we update the date at the top. We'll tell you in the app about important changes.",
        },
      ],
    },
    {
      id: "cookies",
      chip: "Cookies",
      title: "Cookies and local storage",
      blocks: [
        {
          kind: "p",
          text: "GitGud uses no advertising cookies. It saves a few items in your browser's storage that the game needs to work, so they don't require consent:",
        },
        {
          kind: "table",
          code: true,
          head: ["Item", "Purpose", "Kept"],
          rows: [
            ["gitgud:progress:v1", "Your progress, attempts and best times", "Until you clear it"],
            ["gitgud:daily:v1:…", "Copies of daily puzzles for offline play", "Until you clear it"],
            ["gitgud:guided-lessons:v1", "Your recent AI practice puzzles", "Until you clear it"],
            ["gitgud:auth:v1", "Keeps you signed in", "Until you log out"],
            ["gitgud:locale:v1", "Your chosen language", "Until you clear it"],
            ["gitgud:consent:v1", "Remembers your cookie choice", "24 months"],
            ["gitgud:welcome-seen:v1", "Remembers you've seen the welcome", "Until you clear it"],
            ["gitgud:guided-goal-draft:v1, gitgud:linkedin:resume-share", "Keeps an unsent practice goal or LinkedIn post while you're away", "Until you close the tab"],
          ],
        },
        {
          kind: "p",
          text: "You can delete these at any time in your browser's site settings. Deleting them as a guest erases your guest progress.",
        },
        { kind: "h3", text: "Analytics cookies, only if you accept" },
        {
          kind: "p",
          text: "If you accept, Google Analytics sets these cookies so we can count visits and see which parts of GitGud are used. Google Signals and advertising features are off. If you reject, Google Analytics isn't loaded at all.",
        },
        {
          kind: "table",
          code: true,
          head: ["Cookie", "Purpose", "Kept"],
          rows: [
            ["_ga", "Google Analytics: tells visits apart with a random ID", "2 years"],
            ["_ga_WVGCJVZ0HG", "Google Analytics: keeps the state of your visit", "2 years"],
          ],
        },
        {
          kind: "p",
          text: "You can change your choice at any time in Account settings or with the button below. Rejecting later deletes these cookies.",
        },
        { kind: "consent" },
      ],
    },
    {
      id: "terms",
      chip: "Terms",
      title: "Terms of use",
      blocks: [
        {
          kind: "p",
          text: "By using GitGud you agree to these terms. GitGud is a free game for learning Git.",
        },
        { kind: "h3", text: "Play fair" },
        {
          kind: "list",
          items: [
            "Don't tamper with the game, scores or leaderboard, or submit results automatically.",
            "Don't misuse AI practice, try to make it produce harmful content, or overload it.",
            "Choose a leaderboard name that isn't offensive, misleading or someone else's.",
          ],
        },
        {
          kind: "p",
          text: "We may remove leaderboard entries or names, or suspend accounts, that break these rules. Scores are calculated in your browser, so the leaderboard is for fun, not an official ranking.",
        },
        { kind: "h3", text: "The service" },
        {
          kind: "p",
          text: "GitGud is provided as it is, without guarantees that it will always be available or error-free. We may change, pause or end features. GitGud simulates Git; it isn't a real Git client, so don't rely on it for decisions about real repositories.",
        },
        { kind: "h3", text: "Intellectual property" },
        {
          kind: "p",
          text: `GitGud's source code is free software under the GNU General Public License v3 at <url>${LEGAL_REPOSITORY}</url>. Git and the Git logo are trademarks of Software Freedom Conservancy; GitGud isn't affiliated with or endorsed by the Git project. Google, GitHub and LinkedIn are trademarks of their owners.`,
        },
        { kind: "h3", text: "Liability and law" },
        {
          kind: "p",
          text: "As far as the law allows, we aren't liable for indirect losses or lost progress from using GitGud. Nothing here limits your rights as a consumer. These terms are governed by Spanish law; if you're a consumer, you may also go to the courts where you live.",
        },
      ],
    },
    {
      id: "ai",
      chip: "AI",
      title: "AI-generated content",
      blocks: [
        {
          kind: "p",
          text: "Most daily puzzles and every AI practice puzzle are generated by an AI model from OpenAI. Before you see one, GitGud's simulator checks that it can be solved. The Learn Basics course is written by people.",
        },
        {
          kind: "p",
          text: `AI-written stories, hints and commit messages can still contain mistakes. If you spot something wrong or inappropriate, tell us at <mail>${LEGAL_EMAIL}</mail>.`,
        },
        {
          kind: "p",
          text: "Daily puzzles are generated without any player data. For AI practice, only the text you type is sent to OpenAI, so please don't include personal information. Under OpenAI's API terms, it isn't used to train their models.",
        },
      ],
    },
    {
      id: "notice",
      chip: "Legal notice",
      title: "Legal notice",
      blocks: [
        {
          kind: "p",
          text: "Information required by Spain's Information Society Services Act (LSSI-CE, Law 34/2002):",
        },
        {
          kind: "list",
          items: [
            `<b>Owner</b>: ${LEGAL_OWNER}`,
            `<b>Website</b>: ${LEGAL_DOMAIN}`,
            `<b>Email</b>: <mail>${LEGAL_EMAIL}</mail>`,
            "<b>Country</b>: Spain",
            "<b>Activity</b>: a free, non-commercial educational game",
          ],
        },
      ],
    },
  ],
};

export function detectLoginWall(input: {
  url: string;
  title: string;
  html: string;
  bodyText: string;
}) {
  const combined = `${input.url}\n${input.title}\n${input.bodyText}\n${input.html.slice(0, 6000)}`.toLowerCase();

  const indicators = [
    "sign in",
    "log in",
    "login",
    "create account",
    "continue with google",
    "password",
    "forgot password",
    "auth",
    "sso",
  ];

  const score = indicators.reduce((acc, indicator) => {
    return acc + (combined.includes(indicator) ? 1 : 0);
  }, 0);

  return score >= 3;
}

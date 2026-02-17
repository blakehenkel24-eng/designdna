export default function PolicyPage() {
  return (
    <main className="page-shell">
      <section className="card">
        <h1>Acceptable use policy</h1>
        <ul>
          <li>Only extract pages you have the right to analyze.</li>
          <li>DesignDNA blocks private/internal hosts and disallowed robots paths.</li>
          <li>Login-protected pages are not supported in MVP.</li>
          <li>Captured artifacts auto-expire after 24 hours.</li>
          <li>Asset binaries are not redistributed; only metadata and source URLs are stored.</li>
        </ul>
      </section>
    </main>
  );
}

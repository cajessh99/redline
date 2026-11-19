import Link from "next/link";
import FlaggedPage from "./flagged-page";
import { defaultRedLines, flags, receipt } from "./sample";

export default function Landing() {
  return (
    <>
      <header className="masthead">
        <Link href="/" className="wordmark">
          Redline
        </Link>
        <Link href="/sign-in" className="quiet-link">
          Sign in
        </Link>
      </header>

      <main>
        <section className="opening" aria-labelledby="headline">
          <div className="pitch">
            <h1 id="headline">See which sentences in a client contract cross your red lines.</h1>
            <p className="support">
              Upload a contract you haven&apos;t signed. Redline flags each clause that matches one
              of your red lines, ranks it by what you couldn&apos;t get back, and quotes the sentence
              word for word so you can find it in your own copy.
            </p>
            <Link href="/sign-up" className="action">
              Check a contract
            </Link>
            <p className="types">
              Reads client contracts, vendor and supplier contracts, employment offers and
              non-competes, and leases.
            </p>
          </div>
          <div className="desk">
            <FlaggedPage />
          </div>
        </section>

        <section className="band" aria-labelledby="answer">
          <div className="band-text">
            <h2 id="answer">Every red line gets an answer</h2>
            <p>
              Flags come first, Severe before Moderate before Minor. A red line with no match still
              gets a line of its own, showing the sentence that covers it or &ldquo;the document
              does not mention this.&rdquo;
            </p>
          </div>
          <ol className="result" aria-label="Result for the sample contract">
            {flags.map((f) => (
              <li key={f.key} className="result-row" data-tier={f.tier.toLowerCase()}>
                <span className="stamp">{f.tier}</span>
                <span className="result-line">{f.redLine}</span>
                <q className="result-source">{f.source}</q>
              </li>
            ))}
            {receipt.map((r) => (
              <li key={r} className="result-row result-receipt">
                <span className="stamp stamp-plain">No flag</span>
                <span className="result-line">{r}</span>
                <span className="result-source">The document does not mention this.</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="band band-split" aria-labelledby="rules">
          <div className="band-text">
            <h2 id="rules">You decide what gets flagged</h2>
            <p>
              Redline flags only clauses that match a red line on your list. Five are on when you
              start. You can edit them, switch them off, or add your own.
            </p>
          </div>
          <div className="red-lines-sheet">
            <p className="sheet-note" id="red-lines-note">
              Switched on when you start
            </p>
            <ul className="red-lines" aria-labelledby="red-lines-note">
              {defaultRedLines.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="band band-split" aria-labelledby="reads">
          <h2 id="reads">What Redline reads, and what it won&apos;t</h2>
          <div className="reads">
            <div>
              <h3>Reads</h3>
              <ul>
                <li>Client contracts</li>
                <li>Vendor and supplier contracts</li>
                <li>Employment offers and non-competes</li>
                <li>Leases</li>
              </ul>
            </div>
            <div>
              <h3>Won&apos;t read</h3>
              <ul>
                <li>
                  Scanned or photographed documents. A sentence Redline can&apos;t read exactly, it
                  can&apos;t quote exactly.
                </li>
                <li>
                  Terms of service and memberships. There&apos;s no one on the other side to take a
                  counter-offer.
                </li>
              </ul>
            </div>
          </div>
          <p className="legal">
            Redline isn&apos;t legal advice. It reports what your contract says. It doesn&apos;t say
            what the law allows where you live, or whether you should sign.
          </p>
        </section>

        <section className="close" aria-labelledby="close">
          <h2 id="close">Have a contract you haven&apos;t signed yet?</h2>
          <Link href="/sign-up" className="action">
            Check a contract
          </Link>
          <p className="close-note">Your file is read in your browser, and only its text is kept.</p>
        </section>
      </main>
    </>
  );
}

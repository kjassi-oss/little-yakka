import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Support — Little Yakka',
  description: 'Get help with Little Yakka — the family chore and reward app.',
}

// Public, non-authenticated page. URL: https://www.littleyakka.com/support
// Used as the App Store "Support URL".
export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-black text-gray-900">Little Yakka Support</h1>
        <p className="mt-1 text-sm text-gray-500">We usually reply within a couple of days.</p>

        <section className="mt-6 space-y-3 text-[15px] leading-relaxed">
          <p>
            Need a hand with Little Yakka? Email us at{' '}
            <a href="mailto:kjassi@gmail.com" className="text-pink-600 font-semibold underline">kjassi@gmail.com</a>{' '}
            and include a short description of the problem, plus the device you&rsquo;re using.
          </p>
        </section>

        <Section title="Common questions">
          <ul className="list-disc pl-5 space-y-2 mt-1">
            <li>
              <strong>How do I add a child?</strong> Go to <em>Settings &rarr; Children &rarr; + Add Child</em>. You can
              set a name, photo or avatar, and colour.
            </li>
            <li>
              <strong>How do kids tick off tasks?</strong> From Home, tap a child&rsquo;s tile to open their Kids Zone,
              then tap <em>DONE</em> on a task. Stars are added automatically.
            </li>
            <li>
              <strong>What is the Bonus Wheel?</strong> A weekly (or monthly) bonus spin that awards extra stars based on
              how much of the week&rsquo;s work is done. Configure it in <em>Settings &rarr; Bonus Wheel</em>.
            </li>
            <li>
              <strong>How do I turn notifications on or off?</strong> Use <em>Settings &rarr; Notifications</em> in the
              app, or your device&rsquo;s notification settings.
            </li>
            <li>
              <strong>How do I delete my account?</strong> Go to <em>Settings &rarr; Delete Account</em>. This permanently
              removes your family&rsquo;s data. You can also email us and we&rsquo;ll do it for you.
            </li>
          </ul>
        </Section>

        <Section title="Privacy">
          <p>
            Our privacy policy explains what we collect and why:{' '}
            <a href="/privacy" className="text-pink-600 font-semibold underline">littleyakka.com/privacy</a>.
          </p>
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-black text-gray-900">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

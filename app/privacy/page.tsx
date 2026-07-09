import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Little Yakka',
  description: 'How Little Yakka collects, uses, and protects your family’s information.',
}

// Public, non-authenticated page. URL: https://www.littleyakka.com/privacy
// NOTE: This is a plain-language policy tailored to the app. Have it reviewed before
// launch if you want legal certainty (kids' data = COPPA/GDPR-K/APP scrutiny).
export default function PrivacyPolicy() {
  const updated = '7 July 2026'
  return (
    <main className="min-h-screen bg-white text-gray-800">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-black text-gray-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-gray-500">Last updated: {updated}</p>

        <section className="mt-6 space-y-3 text-[15px] leading-relaxed">
          <p>
            Little Yakka (&ldquo;Little Yakka&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a chore-and-reward app
            that helps parents and guardians organise tasks and rewards for their children. This policy explains what
            information we collect, how we use it, and the choices you have. Little Yakka is operated from Australia by
            Kiran Jassi.
          </p>
          <p>
            Little Yakka is designed to be set up and managed by a parent or guardian. Children do not create accounts
            or provide information to us directly &mdash; a parent or guardian enters and controls any information about
            a child.
          </p>
        </section>

        <Section title="Information we collect">
          <p>We keep the data we collect to the minimum needed to run the app:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li><strong>Parent/guardian account:</strong> your email address, and your name if you provide it. If you sign in with Google or Apple, we receive your name and email from that service.</li>
            <li><strong>Children’s profiles (entered by you):</strong> the child’s first name or nickname, an optional profile photo, and an optional age. This is provided by the parent/guardian, not by the child.</li>
            <li><strong>App content:</strong> the chores, rewards, stars, and related activity you create in the app.</li>
            <li><strong>Technical data:</strong> basic information needed to operate and secure the service (for example, log and device data such as a push-notification token if you enable notifications).</li>
          </ul>
          <p className="mt-2">We do <strong>not</strong> collect payment information, and we do <strong>not</strong> use third-party advertising or tracking/analytics SDKs.</p>
        </Section>

        <Section title="How we use information">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To provide and personalise the app (create profiles, track chores and rewards).</li>
            <li>To sign you in and keep your account secure.</li>
            <li>To send notifications you have opted into (e.g. chore reminders).</li>
            <li>To maintain, troubleshoot, and improve the service.</li>
          </ul>
          <p className="mt-2">We do not sell your information, and we do not use children’s information for advertising or profiling.</p>
        </Section>

        <Section title="Children’s privacy">
          <p>
            Little Yakka is intended for use by parents and guardians. Any information about a child is entered and
            controlled by the adult who set up the account. As the parent/guardian, you can view, edit, or delete a
            child’s profile and data at any time from within the app. If you believe a child has provided us information
            directly, contact us and we will delete it.
          </p>
        </Section>

        <Section title="How your information is stored and shared">
          <p>We use a small number of trusted service providers to run the app. They process data on our behalf and are not permitted to use it for their own purposes:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li><strong>Supabase</strong> — database, authentication, and photo storage (hosted in the Asia-Pacific / Sydney region).</li>
            <li><strong>Vercel</strong> — application hosting and delivery.</li>
            <li><strong>Google and Apple</strong> — only if you choose to sign in with them, to authenticate you.</li>
          </ul>
          <p className="mt-2">
            Data is transmitted over encrypted connections (HTTPS). We do not sell or rent your information, and we only
            share it as needed to operate the service or where required by law.
          </p>
        </Section>

        <Section title="Data retention and deletion">
          <p>
            We keep your information for as long as your account is active. You can delete individual children, content,
            or your entire account at any time from the app’s settings. Deleting your account removes your family’s data
            from the app; residual copies in backups are removed in the ordinary course. To request deletion or ask a
            question about your data, contact us using the details below.
          </p>
        </Section>

        <Section title="Your choices and rights">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Access, correct, or delete your data from within the app.</li>
            <li>Turn notifications on or off at any time.</li>
            <li>Depending on where you live (e.g. Australia or the EU/UK), you may have additional rights to access, correct, or erase your data, or to lodge a complaint with your local privacy regulator.</li>
          </ul>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy from time to time. We will change the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you in the app.</p>
        </Section>

        <Section title="Contact us">
          <p>
            If you have any questions about this policy or your data, contact us at{' '}
            <a href="mailto:contact@littleyakka.com" className="text-pink-600 font-semibold underline">contact@littleyakka.com</a>.
          </p>
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-black text-gray-900">{title}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  )
}

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui";
import { BrainCircuit } from "lucide-react";
import Link from "next/link";
import { SUPPORT_EMAIL } from '@/lib/site'

// app/privacy-policy/page.tsx
export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <span>ContentFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign up</Button>
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <section className="space-y-8 text-gray-800">
            <h1 className="text-4xl font-bold text-primary">Privacy Policy</h1>

            <p>
            <strong>Beacon Capital Management</strong> understands that your privacy is important
            to you. We are committed to protecting the privacy of your personally identifiable
            information as you use this website.
            </p>

            <p>
            By using this website, you consent to the terms outlined in the most recent version of
            this Privacy Policy. You should also read our Terms of Use. “We,” “our,” and “us”
            refer to Beacon Capital Management and its affiliates. “You,” “your,” “visitor,” or
            “user” refer to the individual accessing this site.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">Personal and Non-Personal Information</h2>
            <p>Our Privacy Policy distinguishes between how we treat your personal and non-personal information.</p>

            <h3 className="text-xl font-medium text-gray-900">What Is Non-Personal Information?</h3>
            <p>
            Non-personal information does not identify you. It may include IP address, browser type,
            device data, and website activity. We may use or share it without restriction.
            </p>

            <h3 className="text-xl font-medium text-gray-900">What Is Personal Information?</h3>
            <p>
            Personal information identifies you directly—such as your name, email, phone number, or
            mailing address. We may collect it when:
            </p>
            <ul className="list-disc ml-6 space-y-1">
            <li>You complete an application or form</li>
            <li>You transact with us or our affiliates</li>
            <li>You provide payment details</li>
            <li>You voluntarily use interactive features</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900">Cookies & Tracking</h2>
            <p>
            We may use cookies and web beacons to personalize your experience. These technologies
            help track anonymous data and optimize site performance. Third-party analytics and
            advertisers may also use cookies.
            </p>
            <p>
            You can manage cookies in your browser settings, but disabling them may affect site
            functionality.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">How We Use Personal Information</h2>
            <ul className="list-disc ml-6 space-y-1">
            <li>Provide website access and services</li>
            <li>Respond to inquiries and fulfill requests</li>
            <li>Process transactions and notify you</li>
            <li>Send relevant offers or updates</li>
            <li>Conduct analysis and improve our platform</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900">Sharing Personal Information</h2>
            <p>We do not sell or share your information except when:</p>
            <ul className="list-disc ml-6 space-y-1">
            <li>Working with vendors on our behalf</li>
            <li>Undergoing mergers or acquisitions</li>
            <li>Required by law or legal order</li>
            <li>Necessary to protect rights or safety</li>
            </ul>

            <h2 id="connected-social-accounts" className="text-2xl font-semibold text-gray-900">
            Connected Social Accounts
            </h2>
            <p>
            If you connect a social account (Facebook Pages, Instagram professional accounts, LinkedIn, X,
            TikTok or YouTube) to publish posts, we store only what we need to publish for you and to show
            your post performance:
            </p>
            <ul className="list-disc ml-6 space-y-1">
            <li>The account&apos;s id, name, username, profile picture and account type</li>
            <li>
                The access and refresh tokens the platform issues to us, encrypted at rest (AES-256-GCM) and
                readable only by our servers — never shown to you or anyone else
            </li>
            <li>The ids and links of posts we publish for you and their public metrics (likes, comments, views)</li>
            </ul>
            <p>
            We use this data only to publish the content you schedule and to report its performance. We do not
            sell it, use it for advertising, or share it with third parties other than the platform itself. Our
            use of information received from Google APIs adheres to the{" "}
            <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
            >
                Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. YouTube uploads are subject to the{" "}
            <a href="https://www.youtube.com/t/terms" className="underline" target="_blank" rel="noopener noreferrer">
                YouTube Terms of Service
            </a>{" "}
            and the{" "}
            <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">
                Google Privacy Policy
            </a>
            .
            </p>
            <p>
            <strong>Disconnecting and deleting:</strong> disconnect an account at any time in Settings →
            Connected accounts; its tokens are deleted immediately (you can also revoke access in the
            platform&apos;s own settings). Deleting your account in Settings → Danger zone permanently deletes
            all of your data, including connected accounts, posts and media files, and cancels your
            subscription. If you remove our app from Facebook, you can request deletion there and check its
            status on our{" "}
            <Link href="/data-deletion" className="underline">
                data deletion page
            </Link>
            , which also explains every way to delete your data.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">Communications</h2>
            <p>
            We may contact you regarding services, updates, or events. If you reach out via a form or
            email, we may respond using the provided details.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">Information Security</h2>
            <p>
            We follow standard security practices, but no system is completely secure. Use the site
            at your own risk.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">External Links</h2>
            <p>
            Our site may link to external websites. Beacon Capital Management is not responsible for
            their privacy practices or content.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">Public Forums</h2>
            <p>
            Information shared in public forums is visible to others. Please exercise caution before
            posting personal data.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">Access & Control</h2>
            <p>
            To access, update, or delete your information—or to unsubscribe—contact us at:
            </p>
            {SUPPORT_EMAIL && <p className="font-medium text-primary"><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>}

            <h2 className="text-2xl font-semibold text-gray-900">Children’s Privacy</h2>
            <p>
            We do not knowingly collect data from children under 13. Contact us if you believe we
            have unintentionally done so.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900">Policy Updates</h2>
            <p>
            We may update this Privacy Policy at any time. Material changes will be highlighted on
            our homepage.
            </p>

            <p>
            If you have any questions about this Privacy Policy or our practices, contact us at:
            </p>
            {SUPPORT_EMAIL && <p className="font-medium text-primary"><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>}
        </section>
      </main>
        
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:h-16">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ContentFlow. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
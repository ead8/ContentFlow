import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui";
import { BrainCircuit } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <span>Intuity Sync</span>
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
        <div className="max-w-4xl mx-auto px-4 py-12 text-gray-800">
        <h1 className="text-4xl font-bold mb-6 text-primary">Terms of Service</h1>

        <Section title="General">
            <p>
            This website (the “Site”) is owned and operated by Beacon Capital Management (“COMPANY,” “we,” or “us”).
            By using the Site, you agree to be bound by these Terms of Service and to use the Site in accordance with
            these Terms, our Privacy Policy, and any additional terms that may apply to certain sections or offerings.
            </p>
            <p>
            We reserve the right to update these Terms at any time. Your continued use of the Site means you accept
            the revised terms.
            </p>
        </Section>

        <Section title="Intellectual Property Rights">
            <SubSection title="Our Limited License to You">
            <p>
                All content on the Site is owned by us or our licensors. You may use it for personal, non-commercial
                purposes only. Reproduction or distribution without consent is prohibited.
            </p>
            </SubSection>
            <SubSection title="Your License to Us">
            <p>
                By submitting content to us (via the Site or platforms like email/social media), you grant us a
                royalty-free, global, irrevocable license to use, display, and distribute it. You affirm you're
                legally authorized to do so and are at least 13 years old.
            </p>
            </SubSection>
        </Section>

        <Section title="Linking & Framing">
            <p>
            You may link to our Site provided it does not misrepresent your relationship with us. Framing or copying
            our content is not allowed without permission.
            </p>
        </Section>

        <Section title="Disclaimers">
            <p>
            Third-party links on the Site are for convenience only and are not endorsements. We do not warrant the
            accuracy, completeness, or availability of the Site and its contents.
            </p>
            <p>
            All content and services are provided “as is” with no warranties, including those of merchantability or
            fitness for a particular purpose.
            </p>
        </Section>

        <Section title="Online Commerce">
            <p>
            Transactions may involve third-party vendors. We are not responsible for their practices or offerings.
            You agree to provide accurate billing details and comply with all applicable laws.
            </p>
        </Section>

        <Section title="Interactive Features">
            <p>
            If the Site includes forums or comment sections, you are solely responsible for your posts. Unlawful,
            offensive, or infringing content is prohibited and may be removed.
            </p>
        </Section>

        <Section title="Registration and Security">
            <p>
            You may be required to register to access certain features. Keep your login credentials secure. You’re
            responsible for all activity under your account.
            </p>
        </Section>

        <Section title="Limitation of Liability">
            <p>
            Beacon Capital Management is not liable for any damages arising from your use of the Site. Your sole
            remedy is to stop using the Site.
            </p>
        </Section>

        <Section title="Financial and Legal Disclaimer">
            <p>
            All content is for educational purposes only and should not be taken as investment, tax, or legal advice.
            Consult a qualified professional before acting.
            </p>
        </Section>

        <Section title="Termination">
            <p>
            We reserve the right to terminate access at any time. Sections regarding intellectual property, limitations
            of liability, and disclaimers will remain in effect after termination.
            </p>
        </Section>

        <Section title="Refund Policy">
            <p>
            Each product or service has its own refund policy, which will be clearly stated at the time of purchase.
            </p>
        </Section>

        <Section title="DMCA Notice">
            <p>
            If you believe any content infringes your copyright, please contact 📧 <a
                href="mailto:Griffin@intuityai.com" className="text-blue-600 underline">Griffin@intuityai.com</a>. We
            will respond in accordance with the DMCA.
            </p>
        </Section>

        <Section title="Legal Governance">
            <p>
            These Terms are governed by the laws of the State of Wyoming, USA. Disputes will be resolved through
            arbitration in Wyoming. If any provision is unenforceable, it will not affect the rest of the agreement.
            </p>
        </Section>

        <Section title="Changes">
            <p>
            We may revise these Terms at any time, with updates posted on this page. If you have questions, contact us
            at 📧 <a href="mailto:Griffin@intuityai.com" className="text-blue-600 underline">Griffin@intuityai.com</a>.
            </p>
        </Section>
        </div>
        
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:h-16">
          <p className="text-sm text-muted-foreground">
            © 2025 Intuity Sync. All rights reserved.
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
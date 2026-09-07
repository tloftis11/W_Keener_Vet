import ChatWidget from "@/components/ChatWidget";
import PawMark from "@/components/PawMark";

const SERVICES = [
  {
    name: "Wellness Exams",
    description: "Annual checkups and preventive care to catch small issues before they become big ones.",
  },
  {
    name: "Vaccinations",
    description: "Core and lifestyle vaccines scheduled around your pet's age, risk, and routine.",
  },
  {
    name: "Dental Care",
    description: "Cleanings, exams, and extractions to keep their teeth healthy for the long run.",
  },
  {
    name: "Surgery & Spay/Neuter",
    description: "Spay, neuter, and soft-tissue procedures in a fully monitored surgical suite.",
  },
  {
    name: "Diagnostics & Lab Work",
    description: "In-house bloodwork and imaging, so you're rarely waiting long for answers.",
  },
  {
    name: "Sick & Urgent Visits",
    description: "Same-day appointments when something doesn't seem right and it can't wait.",
  },
];

const HOURS = [
  { day: "Monday – Friday", time: "8:00 AM – 6:00 PM" },
  { day: "Saturday", time: "8:00 AM – 1:00 PM" },
  { day: "Sunday", time: "Closed" },
];

export default function HomePage() {
  const year = new Date().getFullYear();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-2">
            <PawMark className="h-6 w-6 text-accent" />
            <span className="font-display text-lg font-semibold text-ink">
              W. Keener Veterinary
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-ink-soft md:flex">
            <a href="#services" className="hover:text-ink">Services</a>
            <a href="#about" className="hover:text-ink">About</a>
            <a href="#hours" className="hover:text-ink">Hours &amp; Location</a>
          </nav>
          <a
            href="#chat"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark"
          >
            Chat With Us
          </a>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-28">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Now accepting new patients
            </span>
            <h1 className="mt-3 text-balance font-display text-4xl leading-tight text-ink md:text-5xl">
              Compassionate care for every member of your family — the four-legged ones too.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              From wellness exams to same-day sick visits, our team treats your pet like our
              own. Not sure if something&apos;s worth a trip in? Just ask.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#chat"
                className="rounded-md bg-accent px-5 py-3 font-medium text-white transition hover:bg-accent-dark"
              >
                Chat With Us
              </a>
              <a
                href="tel:+15552018890"
                className="rounded-md border border-line px-5 py-3 font-medium text-ink transition hover:bg-accent-soft"
              >
                Call (555) 201-8890
              </a>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              {["Same-day sick visits", "Weekend hours", "In-house lab & imaging"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-accent-soft">
            <PawMark className="absolute -bottom-10 -right-10 h-72 w-72 text-accent opacity-10" />
            <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-line bg-surface p-5 shadow-sm">
              <p className="font-display text-base italic text-ink">
                &ldquo;They treated our old boy like family, right up to the end. Can&apos;t
                imagine going anywhere else.&rdquo;
              </p>
              <p className="mt-3 text-xs text-ink-faint">— A Keener client, Springdale</p>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="border-t border-line bg-surface px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              What we treat
            </span>
            <h2 className="mt-3 font-display text-3xl text-ink">How we care for your pet</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((service) => (
                <div key={service.name} className="rounded-xl border border-line p-6">
                  <span className="block h-1 w-8 rounded-full bg-accent" />
                  <h3 className="mt-4 font-display text-lg text-ink">{service.name}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="border-t border-line px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.3fr_0.7fr] md:items-start">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                Our approach
              </span>
              <h2 className="mt-3 font-display text-3xl text-ink">
                Straightforward, unhurried care
              </h2>
              <p className="mt-5 max-w-xl text-ink-soft">
                We keep our schedule realistic so appointments don&apos;t feel rushed, and
                we&apos;d rather explain your options plainly than talk over your head. If
                your pet needs something we don&apos;t do in-house, we&apos;ll tell you and
                help you get there.
              </p>
              <p className="mt-4 max-w-xl text-ink-soft">
                Most questions don&apos;t need an office visit to answer — that&apos;s what
                the chat is for. Anything that does need a closer look, we&apos;ll say so.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft font-display text-lg text-accent">
                WK
              </div>
              <p className="mt-4 font-display text-lg text-ink">Dr. W. Keener, DVM</p>
              <p className="mt-1 text-sm text-ink-soft">
                Practice founder — 15+ years in small-animal medicine.
              </p>
            </div>
          </div>
        </section>

        {/* Hours & Location */}
        <section id="hours" className="border-t border-line bg-surface px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl text-ink">Hours</h2>
              <dl className="mt-6 divide-y divide-line">
                {HOURS.map((row) => (
                  <div key={row.day} className="flex justify-between py-3 text-sm">
                    <dt className="text-ink-soft">{row.day}</dt>
                    <dd className="font-medium text-ink">{row.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="font-display text-2xl text-ink">Location</h2>
              <p className="mt-6 text-sm text-ink-soft">214 Maple Street</p>
              <p className="text-sm text-ink-soft">Springdale, OH 45501</p>
              <p className="mt-4 text-sm text-ink-soft">
                <a href="tel:+15552018890" className="text-accent hover:underline">
                  (555) 201-8890
                </a>
              </p>
              <p className="mt-4 text-sm text-ink-faint">
                Free parking behind the building — for urgent visits, enter through the side
                door.
              </p>
            </div>
          </div>
        </section>

        {/* Chat */}
        <section id="chat" className="border-t border-line bg-accent-soft/50 px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Talk to us anytime
            </span>
            <h2 className="mt-3 font-display text-3xl text-ink">
              Not sure if it&apos;s something to worry about? Ask.
            </h2>
            <p className="mt-4 text-ink-soft">
              Describe what&apos;s going on and we&apos;ll help where we can — anything
              that needs a vet&apos;s judgment gets routed to our team right in this same
              conversation.
            </p>
          </div>
          <div className="mx-auto mt-10 h-[600px] max-w-2xl rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <ChatWidget showHeader={false} />
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-ink px-6 py-12 text-bg">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 md:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <PawMark className="h-5 w-5 text-accent" />
              <span className="font-display text-base font-semibold">W. Keener Veterinary</span>
            </div>
            <p className="mt-3 text-sm text-bg/70">214 Maple Street, Springdale, OH 45501</p>
            <p className="text-sm text-bg/70">(555) 201-8890</p>
          </div>
          <nav className="flex gap-6 text-sm text-bg/70">
            <a href="#services" className="hover:text-bg">Services</a>
            <a href="#about" className="hover:text-bg">About</a>
            <a href="#hours" className="hover:text-bg">Hours &amp; Location</a>
            <a href="#chat" className="hover:text-bg">Chat With Us</a>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-xs text-bg/40">
          © {year} W. Keener Veterinary. All rights reserved.
        </p>
      </footer>
    </>
  );
}
